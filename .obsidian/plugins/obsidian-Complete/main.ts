import { Plugin, PluginSettingTab, App, Setting, Notice, Editor, EditorPosition } from 'obsidian';
import MODELS from './models.json';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

const MAX_PREFIX_LENGTH = 1000;
const MAX_FIM_TOKENS = 4096;
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

// 补全高亮：StateEffect 用于设置/清除补全高亮范围
const setHighlight = StateEffect.define<{ from: number; to: number } | null>();

const highlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(decorations, tr) {
		for (const e of tr.effects) {
			if (e.is(setHighlight)) {
				if (e.value === null) return Decoration.none;
				return Decoration.set([
					Decoration.mark({
						attributes: {
							style: 'background-color: #73AE52; color: #FBF1D7;',
						},
					}).range(e.value.from, e.value.to),
				]);
			}
		}
		return decorations;
	},
	provide: (f) => EditorView.decorations.from(f),
});

// 从 Obsidian Editor 中拿到 CodeMirror 实例的窄类型，避免 `as any`
type CMEditorView = EditorView;
interface ObsidianEditor extends Editor {
	cm: CMEditorView;
}

interface CompleteSettings {
	apiKey: string;
	workspaceId: string;
	model: string;
	deepSeekApiKey: string;
}

const DEFAULT_SETTINGS: CompleteSettings = {
	apiKey: '',
	workspaceId: '',
	model: 'qwen3.7-plus',
	deepSeekApiKey: '',
};

// 把 (line, ch) 转换为文档偏移量（统一两处重复逻辑）
function posToOffset(cm: CMEditorView, line: number, ch: number): number {
	return cm.state.doc.line(line + 1).from + ch;
}

// 根据插入的文本内容计算结束行列（统一两处重复逻辑）
function calculateEndPos(start: EditorPosition, content: string): EditorPosition {
	const lines = content.split('\n');
	return {
		line: start.line + lines.length - 1,
		ch: lines.length === 1 ? start.ch + lines[0].length : lines[lines.length - 1].length,
	};
}

export default class CompletePlugin extends Plugin {
	settings: CompleteSettings = DEFAULT_SETTINGS;
	private abortController: AbortController | null = null;
	private timedOut = false;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;
	private keyHandlerCM: CMEditorView | null = null;
	private activeCM: CMEditorView | null = null;
	private insertedRange: { from: EditorPosition; to: EditorPosition } | null = null;
	private activeEditor: Editor | null = null;

	async onload() {
		await this.loadSettings();

		// 注册高亮装饰器扩展
		this.registerEditorExtension(highlightField);

		this.addCommand({
			id: 'trigger-complete',
			name: '触发 AI 补全',
			editorCallback: (editor: Editor) => {
				this.triggerCompletion(editor);
			},
		});

		this.addCommand({
			id: 'trigger-fim-complete',
			name: '触发 AI FIM 补全',
			editorCallback: (editor: Editor) => {
				this.triggerCompletion(editor, true);
			},
		});

		this.addSettingTab(new CompleteSettingTab(this.app, this));
	}

	onunload() {
		// 中断可能仍在进行的请求，防止回调在卸载后修改 UI
		this.abortController?.abort();
		// 清理残留的高亮和按键监听
		this.resetCompletionState();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async triggerCompletion(editor: Editor, forceFim = false) {
		// 取消正在进行的请求（避免并发补全时的状态污染）
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}

		const cursor = editor.getCursor();

		// 先检查光标前 10 行内是否有实质内容
		const tenLinesStartLine = Math.max(0, cursor.line - 9);
		const textBeforeTenLines = editor.getRange({ line: tenLinesStartLine, ch: 0 }, cursor);
		if (!textBeforeTenLines.trim()) {
			new Notice('光标前 10 行内没有文本内容，无法补全');
			return;
		}

		const docEnd = editor.lastLine() + 1;

		// FIM 上下文：光标附近各 5 行
		const fimContextStart = Math.max(0, cursor.line - 4);
		const fimContextEnd = Math.min(docEnd, cursor.line + 6);
		const fimPrefix = editor.getRange({ line: fimContextStart, ch: 0 }, cursor);
		const fimSuffix = editor
			.getRange(cursor, { line: fimContextEnd - 1, ch: editor.getLine(fimContextEnd - 1).length })
			.trim();

		if (forceFim && !fimSuffix.length) {
			new Notice('FIM 补全需要光标后面有文本内容');
			return;
		}
		const useFim = fimSuffix.length > 0;

		// 配置校验
		if (useFim && !this.settings.deepSeekApiKey) {
			new Notice('请先在设置中配置 DeepSeek API Key');
			return;
		}
		if (!useFim) {
			if (!this.settings.apiKey) {
				new Notice('请先在设置中配置百炼 API Key');
				return;
			}
			if (!this.settings.workspaceId) {
				new Notice('请先在设置中配置百炼业务空间 ID');
				return;
			}
		}

		// 清除上一次的补全状态
		this.clearCompletion();

		// 构建请求
		const { url, body } = this.buildRequest(useFim, editor, cursor, fimPrefix, fimSuffix);

		this.abortController = new AbortController();
		const notice = new Notice(useFim ? 'AI 正在 FIM 补全...' : 'AI 正在补全...', 0);

		const timeoutId = setTimeout(() => {
			this.timedOut = true;
			this.abortController?.abort();
		}, REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${useFim ? this.settings.deepSeekApiKey : this.settings.apiKey}`,
				},
				body: JSON.stringify(body),
				signal: this.abortController.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				new Notice(`API 请求失败 (${response.status}): ${errorText}`);
				return;
			}

			if (useFim) {
				await this.handleFimStream(response, editor, notice);
			} else {
				await this.handleStandardResponse(response, editor, notice);
			}
		} catch (e: unknown) {
			if (e instanceof Error && e.name === 'AbortError') {
				new Notice(this.timedOut ? `补全超时：AI 生成超过 ${REQUEST_TIMEOUT_MS / 1000} 秒，已停止` : '已取消补全');
			} else {
				new Notice(`补全出错: ${e instanceof Error ? e.message : String(e)}`);
			}
		} finally {
			clearTimeout(timeoutId);
			this.timedOut = false;
			this.abortController = null;
			notice.hide();
		}
	}

	private buildRequest(
		useFim: boolean,
		editor: Editor,
		cursor: EditorPosition,
		fimPrefix: string,
		fimSuffix: string
	): { url: string; body: Record<string, unknown> } {
		if (useFim) {
			return {
				url: 'https://api.deepseek.com/beta/completions',
				body: {
					model: 'deepseek-v4-pro',
					prompt: fimPrefix,
					suffix: fimSuffix,
					max_tokens: MAX_FIM_TOKENS,
					temperature: 0.7,
					stream: true,
					stream_options: { include_usage: true },
				},
			};
		}

		const textBefore = editor.getRange({ line: 0, ch: 0 }, cursor);
		const prefix = textBefore.length > MAX_PREFIX_LENGTH ? textBefore.slice(-MAX_PREFIX_LENGTH) : textBefore;
		return {
			url: `https://${this.settings.workspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`,
			body: {
				model: this.settings.model,
				messages: [
					{
						role: 'user',
						content:
							'请根据用户提供的文本前缀，自然地续写后续内容。保持风格一致，直接续写，不要重复前缀内容，不要添加额外说明。输出后缀内容要不超过前缀内容的2倍。',
					},
					{ role: 'assistant', content: prefix, partial: true },
				],
			},
		};
	}

	private async handleStandardResponse(response: Response, editor: Editor, notice: Notice) {
		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			new Notice('补全失败：模型返回了空内容，试试换 qwen-plus 或 qwen3.7-max');
			return;
		}

		const startPos = editor.getCursor();
		editor.replaceRange(content, startPos);
		const endPos = calculateEndPos(startPos, content);

		// 记录插入范围和高亮
		const cm = (editor as ObsidianEditor).cm;
		this.insertedRange = { from: startPos, to: endPos };
		this.activeEditor = editor;
		this.activeCM = cm;

		const from = posToOffset(cm, startPos.line, startPos.ch);
		const to = posToOffset(cm, endPos.line, endPos.ch);
		if (from === to) return; // 空内容跳过

		cm.dispatch({ effects: setHighlight.of({ from, to }) });
		this.installKeyHandler(cm);
	}

	private async handleFimStream(response: Response, editor: Editor, notice: Notice) {
		const reader = response.body?.getReader();
		if (!reader) {
			new Notice('无法读取流式响应');
			return;
		}

		const decoder = new TextDecoder();
		let fullContent = '';
		let startPos: EditorPosition | null = null;
		let lastEnd: EditorPosition | null = null;
		let buffer = '';

		const cm = (editor as ObsidianEditor).cm;

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || !trimmed.startsWith('data:')) continue;
					const dataStr = trimmed.slice(5).trim();
					if (dataStr === '[DONE]') continue;

					let chunk: { choices?: { text?: string }[] };
					try {
						chunk = JSON.parse(dataStr);
					} catch (err) {
						// 跳过解析失败的行（SSE 帧被切分到下个 chunk 时常见）
						console.warn('FIM SSE 解析失败:', dataStr, err);
						continue;
					}

					const text = chunk.choices?.[0]?.text;
					if (!text) continue;

					if (!startPos) {
						startPos = editor.getCursor();
					}
					fullContent += text;

					// 关键：第一帧 lastEnd 为 null，纯插入（不覆盖光标后原内容）；
					// 后续帧用上一次的 lastEnd 作为终点，只覆盖自己上一次写入的部分
					const currentEnd = lastEnd || startPos;
					editor.replaceRange(fullContent, startPos, currentEnd);
					lastEnd = calculateEndPos(startPos, fullContent);

					// 实时更新高亮
					const from = posToOffset(cm, startPos.line, startPos.ch);
					const to = from + fullContent.length;
					if (from !== to) {
						cm.dispatch({ effects: setHighlight.of({ from, to }) });
					}
				}
			}
		} finally {
			// 显式释放 reader 锁，便于底层连接关闭
			try {
				reader.releaseLock();
			} catch {
				// reader 已关闭，忽略
			}
		}

		if (fullContent && startPos) {
			const endPos = calculateEndPos(startPos, fullContent);
			this.insertedRange = { from: startPos, to: endPos };
			this.activeEditor = editor;
			this.activeCM = cm;
			this.installKeyHandler(cm);
		} else {
			new Notice(
				'补全失败：FIM 模型返回了空内容\n该模式对自然语言、Markdown 的补全效果不佳（DeepSeek FIM 主要针对代码场景设计）'
			);
		}
	}

	/** 安装 Tab 取消高亮 / Esc 撤销补全的按键监听 */
	private installKeyHandler(cm: CMEditorView) {
		// 先卸掉旧监听（如果存在），避免重复触发
		this.removeKeyHandler();

		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Tab') {
				e.preventDefault();
				e.stopPropagation();
				this.clearCompletion();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				this.undoCompletion();
			}
		};
		this.keyHandler = handler;
		this.keyHandlerCM = cm;
		cm.dom.addEventListener('keydown', handler, true);
	}

	/** 清除补全高亮和按键监听（内容保留） */
	private clearCompletion() {
		if (this.activeCM) {
			this.activeCM.dispatch({ effects: setHighlight.of(null) });
			this.activeCM = null;
		}
		this.removeKeyHandler();
	}

	/** 撤销补全：删除插入内容 + 清除高亮 */
	private undoCompletion() {
		if (this.activeEditor && this.insertedRange) {
			this.activeEditor.replaceRange('', this.insertedRange.from, this.insertedRange.to);
		}
		this.clearCompletion();
		this.insertedRange = null;
		this.activeEditor = null;
	}

	/** 一站式清理所有补全相关状态（供 onunload 使用） */
	private resetCompletionState() {
		this.removeKeyHandler();
		if (this.activeCM) {
			this.activeCM.dispatch({ effects: setHighlight.of(null) });
			this.activeCM = null;
		}
		this.insertedRange = null;
		this.activeEditor = null;
	}

	/** 卸掉按键监听。用专门的 keyHandlerCM 字段确保卸的是真正装过的监听器 */
	private removeKeyHandler() {
		if (this.keyHandler && this.keyHandlerCM) {
			this.keyHandlerCM.dom.removeEventListener('keydown', this.keyHandler, true);
			this.keyHandler = null;
			this.keyHandlerCM = null;
		}
	}
}

class CompleteSettingTab extends PluginSettingTab {
	plugin: CompletePlugin;

	constructor(app: App, plugin: CompletePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const models = MODELS as Record<string, string>;

		containerEl.createEl('h2', { text: 'Complete 配置' });

		// 阿里云分组
		const aliGroup = containerEl.createDiv({ cls: 'setting-group' });
		const aliHeading = aliGroup.createEl('h3', { text: '阿里云' });
		aliHeading.style.marginBottom = '0.5em';
		const aliItems = aliGroup.createDiv({ cls: 'setting-items' });

		new Setting(aliItems)
			.setName('百炼业务空间 ID')
			.setDesc('阿里云百炼平台的业务空间标识')
			.addText((text) =>
				text
					.setPlaceholder('请输入百炼业务空间 ID')
					.setValue(this.plugin.settings.workspaceId)
					.onChange(async (value) => {
						this.plugin.settings.workspaceId = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(aliItems)
			.setName('阿里云百炼 API Key')
			.setDesc('用于调用百炼平台大模型服务')
			.addText((text) =>
				text
					.setPlaceholder('请输入你的百炼 API Key')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(aliItems)
			.setName('补全模型')
			.setDesc('选择用于文本补全的模型')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(models)
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					});
			});

		// 分组
		const dsGroup = containerEl.createDiv({ cls: 'setting-group' });
		const dsHeading = dsGroup.createEl('h3', { text: 'DeepSeek' });
		dsHeading.style.marginBottom = '0.5em';
		const dsItems = dsGroup.createDiv({ cls: 'setting-items' });

		new Setting(dsItems)
			.setName('DeepSeek API Key')
			.setDesc('用于调用 DeepSeek FIM 补全服务')
			.addText((text) =>
				text
					.setPlaceholder('请输入你的 DeepSeek API Key')
					.setValue(this.plugin.settings.deepSeekApiKey)
					.onChange(async (value) => {
						this.plugin.settings.deepSeekApiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(dsItems)
			.setName('模型')
			.setDesc('当前：deepseek-v4-pro');
	}
}
