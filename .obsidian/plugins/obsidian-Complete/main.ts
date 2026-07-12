import { Plugin, PluginSettingTab, App, Setting, Notice, Editor, EditorPosition } from 'obsidian';
import MODELS from './models.json';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

const MAX_PREFIX_LENGTH = 1000;
const MAX_FIM_TOKENS = 4096;

// 高亮装饰器：StateEffect 用于设置/清除补全高亮范围
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

export default class CompletePlugin extends Plugin {
	settings: CompleteSettings = DEFAULT_SETTINGS;
	private abortController: AbortController | null = null;
	private timedOut = false;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;
	private activeCM: EditorView | null = null;
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async triggerCompletion(editor: Editor, forceFim = false) {
		const cursor = editor.getCursor();

		// 先检查光标前 10 行内是否有实质内容
		const tenLinesStartLine = Math.max(0, cursor.line - 9);
		const textBeforeTenLines = editor.getRange(
			{ line: tenLinesStartLine, ch: 0 },
			cursor
		);
		if (!textBeforeTenLines.trim()) {
			new Notice('光标前 10 行内没有文本内容，无法补全');
			return;
		}

		const docEnd = editor.lastLine() + 1;

		// FIM 上下文：光标附近各 5 行
		const fimContextStart = Math.max(0, cursor.line - 4);
		const fimContextEnd = Math.min(docEnd, cursor.line + 6);
		const fimPrefix = editor.getRange(
			{ line: fimContextStart, ch: 0 },
			cursor
		);
		const fimSuffix = editor.getRange(
			cursor,
			{ line: fimContextEnd - 1, ch: editor.getLine(fimContextEnd - 1).length }
		).trim();

		if (forceFim && !fimSuffix.length) {
			new Notice('FIM 补全需要光标后面有文本内容');
			return;
		}
		const useFim = fimSuffix.length > 0;

		// 检查配置
		if (useFim) {
			if (!this.settings.deepSeekApiKey) {
				new Notice('请先在设置中配置 DeepSeek API Key');
				return;
			}
		} else {
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

		let url: string;
		let body: Record<string, unknown>;

		if (useFim) {
			url = 'https://api.deepseek.com/beta/completions';
			body = {
				model: 'deepseek-v4-pro',
				prompt: fimPrefix,
				suffix: fimSuffix,
				max_tokens: MAX_FIM_TOKENS,
				temperature: 0.7,
				stream: true,
				stream_options: { include_usage: true },
			};
		} else {
			const textBefore = editor.getRange({ line: 0, ch: 0 }, cursor);
			const prefix =
				textBefore.length > MAX_PREFIX_LENGTH
					? textBefore.slice(-MAX_PREFIX_LENGTH)
					: textBefore;
			url = `https://${this.settings.workspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;
			body = {
				model: this.settings.model,
				messages: [
					{
						role: 'user',
						content:
							'请根据用户提供的文本前缀，自然地续写后续内容。保持风格一致，直接续写，不要重复前缀内容，不要添加额外说明。输出后缀内容要不超过前缀内容的2倍。',
					},
					{
						role: 'assistant',
						content: prefix,
						partial: true,
					},
				],
			};
		}

		this.abortController = new AbortController();
		const notice = new Notice(useFim ? 'AI 正在 FIM 补全...' : 'AI 正在补全...', 0);

		// 2 分钟超时
		const timeoutId = setTimeout(() => {
			this.timedOut = true;
			this.abortController?.abort();
		}, 2 * 60 * 1000);

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
				// DeepSeek FIM 流式 SSE 输出
				const reader = response.body?.getReader();
				if (!reader) {
					new Notice('无法读取流式响应');
					return;
				}

				const decoder = new TextDecoder();
				let fullContent = '';
				let startPos: EditorPosition | null = null;
				let endPos: EditorPosition | null = null;
				let buffer = '';

				const cm = (editor as any).cm as EditorView;

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed || !trimmed.startsWith('data:')) continue;
						const dataStr = trimmed.slice(5).trim(); // 去掉 "data:" 前缀
						if (dataStr === '[DONE]') continue;

						try {
							const chunk = JSON.parse(dataStr);
							const text = chunk.choices?.[0]?.text;
							if (text) {
								if (!startPos) {
									startPos = editor.getCursor();
								}
								fullContent += text;
								const currentEnd = endPos || startPos;
								editor.replaceRange(fullContent, startPos, currentEnd);

								const contentLines = fullContent.split('\n');
								endPos = {
									line: startPos.line + contentLines.length - 1,
									ch:
										contentLines.length === 1
											? startPos.ch + contentLines[0].length
											: contentLines[contentLines.length - 1].length,
								};

								// 更新高亮
								const from =
									cm.state.doc.line(startPos.line + 1).from + startPos.ch;
								const to = from + fullContent.length;
								if (from !== to) {
									cm.dispatch({ effects: setHighlight.of({ from, to }) });
								}
							}
						} catch {
							// 跳过解析失败的 JSON 行
						}
					}
				}

				if (fullContent) {
					this.insertedRange = { from: startPos!, to: endPos! };
					this.activeEditor = editor;
					this.activeCM = cm;

					const cmDom = cm.dom;
					this.keyHandler = (e: KeyboardEvent) => {
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
					cmDom.addEventListener('keydown', this.keyHandler, true);
				} else {
					new Notice('补全失败：FIM 模型返回了空内容\n该模式对自然语言、Markdown 的补全效果不佳（DeepSeek FIM 主要针对代码场景设计）');
				}
			} else {
				const data = await response.json();
				const content = data.choices?.[0]?.message?.content;
				if (content) {
					const startPos = editor.getCursor();
					editor.replaceRange(content, startPos);

					// 根据内容行数计算结束位置
					const lines = content.split('\n');
					const endPos: EditorPosition = {
						line: startPos.line + lines.length - 1,
						ch:
							lines.length === 1
								? startPos.ch + lines[0].length
								: lines[lines.length - 1].length,
					};

					// 记录插入范围，用于 Esc 撤销
					this.insertedRange = { from: startPos, to: endPos };
					this.activeEditor = editor;

					// 获取 CodeMirror EditorView 实例
					const cm = (editor as any).cm as EditorView;
					this.activeCM = cm;

					// 将行列位置转为文档偏移量
					const from =
						cm.state.doc.line(startPos.line + 1).from + startPos.ch;
					const to =
						cm.state.doc.line(endPos.line + 1).from + endPos.ch;

					if (from === to) return; // 空内容跳过

					// 应用高亮
					cm.dispatch({ effects: setHighlight.of({ from, to }) });

					// 监听 Tab 取消高亮 / Esc 撤销补全（挂在 CM DOM 上避免被 Obsidian 拦截）
					const cmDom = cm.dom;
					this.keyHandler = (e: KeyboardEvent) => {
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
					cmDom.addEventListener('keydown', this.keyHandler, true);
				} else {
					new Notice('补全失败：模型返回了空内容，试试换 qwen-plus 或 qwen3.7-max');
				}
			}
		} catch (e: unknown) {
			if (e instanceof Error && e.name === 'AbortError') {
				new Notice(this.timedOut ? '补全超时：AI 生成超过 2 分钟，已停止' : '已取消补全');
			} else {
				new Notice(
					`补全出错: ${e instanceof Error ? e.message : String(e)}`
				);
			}
		} finally {
			clearTimeout(timeoutId);
			this.timedOut = false;
			this.abortController = null;
			notice.hide();
		}
	}

	/** 清除补全高亮和按键监听（内容保留） */
	private clearCompletion() {
		this.removeKeyHandler();
		if (this.activeCM) {
			this.activeCM.dispatch({ effects: setHighlight.of(null) });
			this.activeCM = null;
		}
	}

	/** 撤销补全：删除插入内容 + 清除高亮 */
	private undoCompletion() {
		if (this.activeEditor && this.insertedRange) {
			this.activeEditor.replaceRange(
				'',
				this.insertedRange.from,
				this.insertedRange.to
			);
		}
		this.clearCompletion();
		this.insertedRange = null;
		this.activeEditor = null;
	}

	private removeKeyHandler() {
		if (this.keyHandler && this.activeCM) {
			this.activeCM.dom.removeEventListener('keydown', this.keyHandler, true);
			this.keyHandler = null;
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

		containerEl.createEl('h4', { text: '阿里云' });

		new Setting(containerEl)
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

		new Setting(containerEl)
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

		new Setting(containerEl)
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

		containerEl.createEl('h4', { text: 'DeepSeek' });

		new Setting(containerEl)
			.setName('DeepSeek API Key')
			.setDesc('用于调用 DeepSeek 模型服务')
			.addText((text) =>
				text
					.setPlaceholder('请输入你的 DeepSeek API Key')
					.setValue(this.plugin.settings.deepSeekApiKey)
					.onChange(async (value) => {
						this.plugin.settings.deepSeekApiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('DeepSeek FIM 模型')
			.setDesc('当前：deepseek-v4-pro');
	}
}