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
	provider: 'aliyun' | 'deepseek';
	fimModel: string;
	outputWordCount: number;
}

const DEFAULT_SETTINGS: CompleteSettings = {
	apiKey: '',
	workspaceId: '',
	model: 'qwen3.7-plus',
	deepSeekApiKey: '',
	provider: 'aliyun',
	fimModel: 'deepseek-v4-pro',
	outputWordCount: 10,
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
		// 当光标后有内容时自动使用 FIM，或者用户显式调用 FIM 命令
		const useFim = fimSuffix.length > 0;

		// 配置校验
		const isDeepSeek = this.settings.provider === 'deepseek';
		if (isDeepSeek && !this.settings.deepSeekApiKey) {
			new Notice('请先在设置中配置 DeepSeek (Beta) API Key');
			return;
		}
		if (!isDeepSeek && !useFim) {
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
		
		// 生成提示信息
		let noticeText = 'AI 正在补全...';
		if (useFim) {
			noticeText = `AI 正在 FIM 补全（${this.settings.fimModel || 'deepseek-v4-pro'}）...`;
		} else if (isDeepSeek) {
			noticeText = `AI 正在 PC 补全（${this.settings.model}）...`;
		} else {
			noticeText = `AI 正在 PC 补全（${this.settings.model}）...`;
		}
		const notice = new Notice(noticeText, 0);

		const timeoutId = setTimeout(() => {
			this.timedOut = true;
			this.abortController?.abort();
		}, REQUEST_TIMEOUT_MS);

		try {
			const apiKey = (isDeepSeek || useFim) ? this.settings.deepSeekApiKey : this.settings.apiKey;
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
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
			} else if (isDeepSeek) {
				await this.handleDeepSeekStream(response, editor, notice);
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
		const isDeepSeek = this.settings.provider === 'deepseek';

		if (useFim) {
			return {
				url: 'https://api.deepseek.com/beta/completions',
				body: {
					model: this.settings.fimModel || 'deepseek-v4-pro',
					prompt: fimPrefix,
					suffix: fimSuffix,
					max_tokens: MAX_FIM_TOKENS,
					temperature: 0.7,
					stream: true,
					stream_options: { include_usage: true },
				},
			};
		}

		if (isDeepSeek) {
			const textBefore = editor.getRange({ line: 0, ch: 0 }, cursor);
			const prefix = textBefore.length > MAX_PREFIX_LENGTH ? textBefore.slice(-MAX_PREFIX_LENGTH) : textBefore;
			const wordCountHint = this.settings.outputWordCount === 0 ? '' : ` 输出内容 ${this.settings.outputWordCount} 字左右。`;
			return {
				url: 'https://api.deepseek.com/beta/chat/completions',
				body: {
					model: this.settings.model,
					messages: [
						{ role: 'user', content: `请根据用户提供的文本前缀，自然地续写后续内容。保持风格一致，直接续写，不要重复前缀内容，不要添加额外说明。${wordCountHint}` },
						{ role: 'assistant', content: prefix, prefix: true },
					],
					stream: true,
				},
			};
		}

		const textBefore = editor.getRange({ line: 0, ch: 0 }, cursor);
		const prefix = textBefore.length > MAX_PREFIX_LENGTH ? textBefore.slice(-MAX_PREFIX_LENGTH) : textBefore;
		const wordCountHint = this.settings.outputWordCount === 0 ? '' : ` 输出内容 ${this.settings.outputWordCount} 字左右。`;
		return {
			url: `https://${this.settings.workspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`,
			body: {
				model: this.settings.model,
				messages: [
					{
						role: 'user',
						content: `请根据用户提供的文本前缀，自然地续写后续内容。保持风格一致，直接续写，不要重复前缀内容，不要添加额外说明。输出后缀内容要不超过前缀内容的2倍。${wordCountHint}`,
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

	private async handleDeepSeekResponse(response: Response, editor: Editor, notice: Notice) {
		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			new Notice('补全失败：DeepSeek 模型返回了空内容');
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

	private async handleDeepSeekStream(response: Response, editor: Editor, notice: Notice) {
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
		let isAborted = false;

		const cm = (editor as ObsidianEditor).cm;

		// 监听 ESC 键中断流式输出
		const escHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				isAborted = true;
				reader.cancel();
				new Notice('已停止补全');
			}
		};
		cm.dom.addEventListener('keydown', escHandler, true);

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done || isAborted) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (isAborted) break;

					const trimmed = line.trim();
					if (!trimmed || !trimmed.startsWith('data:')) continue;
					const dataStr = trimmed.slice(5).trim();
					if (dataStr === '[DONE]') continue;

					let chunk: { choices?: { delta?: { content?: string } }[] };
					try {
						chunk = JSON.parse(dataStr);
					} catch (err) {
						console.warn('DeepSeek SSE 解析失败:', dataStr, err);
						continue;
					}

					const text = chunk.choices?.[0]?.delta?.content;
					if (!text) continue;

					if (!startPos) {
						startPos = editor.getCursor();
					}
					fullContent += text;

					// 关键：第一帧 lastEnd 为 null，纯插入；后续帧用上一次的 lastEnd 作为终点
					const currentEnd = lastEnd || startPos;
					editor.replaceRange(fullContent, startPos, currentEnd);
					lastEnd = calculateEndPos(startPos, fullContent);

					// 实时更新高亮
					const from = posToOffset(cm, startPos.line, startPos.ch);
					const to = from + fullContent.length;
					if (from !== to) {
						cm.dispatch({ effects: setHighlight.of({ from, to }) });
					}

					// 自动滚动到最新内容
					editor.setCursor(lastEnd);
				}
			}
		} finally {
			cm.dom.removeEventListener('keydown', escHandler, true);
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
			// 流式结束后，将光标移回插入内容的末尾
			editor.setCursor(endPos);
		} else if (!isAborted) {
			new Notice('补全失败：DeepSeek 模型返回了空内容');
		}
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
		let isAborted = false;

		const cm = (editor as ObsidianEditor).cm;

		// 监听 ESC 键中断流式输出
		const escHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				isAborted = true;
				reader.cancel();
				new Notice('已停止补全');
			}
		};
		cm.dom.addEventListener('keydown', escHandler, true);

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done || isAborted) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (isAborted) break;

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

					// 自动滚动到最新内容
					editor.setCursor(lastEnd);
				}
			}
		} finally {
			cm.dom.removeEventListener('keydown', escHandler, true);
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
			// 流式结束后，将光标移回插入内容的末尾
			editor.setCursor(endPos);
		} else if (!isAborted) {
			new Notice(
				'补全失败：FIM 模型返回了空内容\n该模式对自然语言、Markdown 的补全效果不佳（DeepSeek (Beta) FIM 主要针对代码场景设计）\n因为它是 Beta ,有问条很正常'
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
		const deepseekModels: Record<string, string> = {
			'deepseek-v4-flash': 'deepseek-v4-flash',
			'deepseek-v4-pro': 'deepseek-v4-pro',
		};

		containerEl.createEl('h2', { text: 'Complete 配置' });

		new Setting(containerEl)
			.setName('AI运营商选择')
			.setDesc('选择用于补全的AI服务提供商')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('aliyun', '阿里云')
					.addOption('deepseek', 'DeepSeek (Beta)')
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						this.plugin.settings.provider = value as 'aliyun' | 'deepseek';
						await this.plugin.saveSettings();
						this.display();
					});
			});

		// 输出字数设置
		const wordCountSetting = new Setting(containerEl)
			.setName('输出字数设置')
			.setDesc('设置AI输出内容的大致字数（0表示由AI自行决定）');

		const controlContainer = containerEl.createDiv({ cls: 'word-count-control' });
		controlContainer.style.display = 'flex';
		controlContainer.style.alignItems = 'center';
		controlContainer.style.gap = '10px';
		controlContainer.style.marginTop = '8px';

		// 滑动条（横向细线）
		const slider = controlContainer.createEl('input', { type: 'range' });
		slider.min = '0';
		slider.max = '100';
		slider.step = '1';
		slider.style.width = '120px';
		slider.style.height = '2px';
		slider.style.accentColor = '#663399';
		slider.style.cursor = 'pointer';

		// 数字输入框
		const numberInput = controlContainer.createEl('input', { type: 'number' });
		numberInput.placeholder = '10';
		numberInput.min = '0';
		numberInput.style.width = '80px';

		// 值转换函数：滑块位置 <-> 字数
		const sliderToWords = (sliderVal: number): number => {
			if (sliderVal === 100) return 0; // 100% = AI自行决定
			// 0% ~ 90% 映射到 5 ~ 1000
			return Math.round((sliderVal / 90) * 995 + 5);
		};

		const wordsToSlider = (words: number): number => {
			if (words === 0) return 100; // AI自行决定 = 100%
			if (words <= 5) return 0;
			if (words >= 1000) return 90;
			return Math.round(((words - 5) / 995) * 90);
		};

		// 初始化
		const initValue = this.plugin.settings.outputWordCount;
		slider.value = String(wordsToSlider(initValue));
		numberInput.value = initValue === 0 ? '' : String(initValue);

		// 滑块变化 -> 更新输入框
		slider.addEventListener('input', async () => {
			const words = sliderToWords(Number(slider.value));
			numberInput.value = words === 0 ? '' : String(words);
			this.plugin.settings.outputWordCount = words;
			await this.plugin.saveSettings();
		});

		// 输入框变化 -> 更新滑块
		numberInput.addEventListener('input', async () => {
			let words = Number(numberInput.value);
			if (isNaN(words) || words < 0 || numberInput.value === '') {
				words = 0;
			}
			slider.value = String(wordsToSlider(words));
			this.plugin.settings.outputWordCount = words;
			await this.plugin.saveSettings();
		});

		wordCountSetting.settingEl.appendChild(controlContainer);

		const isDeepSeek = this.plugin.settings.provider === 'deepseek';

		// 动态分组
		const providerGroup = containerEl.createDiv({ cls: 'setting-group' });
		const providerHeading = providerGroup.createEl('h3', { text: isDeepSeek ? 'DeepSeek (Beta)' : '阿里云' });
		providerHeading.style.marginBottom = '0.5em';
		const providerItems = providerGroup.createDiv({ cls: 'setting-items' });

		if (isDeepSeek) {
			new Setting(providerItems)
				.setName('DeepSeek (Beta) API Key')
				.setDesc('用于调用 DeepSeek (Beta) 补全服务')
				.addText((text) =>
					text
						.setPlaceholder('请输入你的 DeepSeek (Beta) API Key')
						.setValue(this.plugin.settings.deepSeekApiKey)
						.onChange(async (value) => {
							this.plugin.settings.deepSeekApiKey = value.trim();
							await this.plugin.saveSettings();
						})
				);

			new Setting(providerItems)
				.setName('补全模型')
				.setDesc('选择用于文本补全的模型')
				.addDropdown((dropdown) => {
					dropdown
						.addOptions(deepseekModels)
						.setValue(this.plugin.settings.model)
						.onChange(async (value) => {
							this.plugin.settings.model = value;
							await this.plugin.saveSettings();
						});
				});
		} else {
			new Setting(providerItems)
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

			new Setting(providerItems)
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

			new Setting(providerItems)
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
		}

		// DeepSeek (Beta) FIM 配置
		const fimGroup = containerEl.createDiv({ cls: 'setting-group' });
		const fimHeading = fimGroup.createEl('h3', { text: 'DeepSeek FIM (Beta)' });
		fimHeading.style.marginBottom = '0.5em';
		const fimItems = fimGroup.createDiv({ cls: 'setting-items' });

		new Setting(fimItems)
			.setName('DeepSeek (Beta) API Key')
			.setDesc('用于调用 DeepSeek FIM (Beta) 补全服务')
			.addText((text) =>
				text
					.setPlaceholder('请输入你的 DeepSeek (Beta) API Key')
					.setValue(this.plugin.settings.deepSeekApiKey)
					.onChange(async (value) => {
						this.plugin.settings.deepSeekApiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(fimItems)
			.setName('FIM 模型')
			.setDesc('选择用于 FIM 补全的模型')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(deepseekModels)
					.setValue(this.plugin.settings.fimModel || 'deepseek-v4-pro')
					.onChange(async (value) => {
						this.plugin.settings.fimModel = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
 