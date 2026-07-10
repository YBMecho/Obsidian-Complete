import { Plugin, PluginSettingTab, App, Setting, Notice, Editor } from 'obsidian';
import MODELS from './models.json';

const MAX_PREFIX_LENGTH = 700000; // 70 万字

interface CompleteSettings {
	apiKey: string;
	workspaceId: string;
	model: string;
}

const DEFAULT_SETTINGS: CompleteSettings = {
	apiKey: '',
	workspaceId: '',
	model: 'qwen3.7-plus',
};

export default class CompletePlugin extends Plugin {
	settings: CompleteSettings = DEFAULT_SETTINGS;
	private abortController: AbortController | null = null;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'trigger-complete',
			name: '触发 AI 补全',
			editorCallback: (editor: Editor) => {
				this.triggerCompletion(editor);
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

	private async triggerCompletion(editor: Editor) {
		const cursor = editor.getCursor();

		// 获取光标前的全部文本
		const textBefore = editor.getRange({ line: 0, ch: 0 }, cursor);

		if (!textBefore.trim()) {
			new Notice('光标前没有文本内容，无法补全');
			return;
		}

		// 截断：保留最接近光标的 70 万字
		const prefix = textBefore.length > MAX_PREFIX_LENGTH
			? textBefore.slice(-MAX_PREFIX_LENGTH)
			: textBefore;

		// 检查配置
		if (!this.settings.apiKey) {
			new Notice('请先在设置中配置百炼 API Key');
			return;
		}
		if (!this.settings.workspaceId) {
			new Notice('请先在设置中配置百炼业务空间 ID');
			return;
		}

		const url = `https://${this.settings.workspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;

		const body = {
			model: this.settings.model,
			messages: [
				{
					role: 'user',
					content: '请根据用户提供的文本前缀，自然地续写后续内容。保持风格一致，直接续写，不要重复前缀内容，不要添加额外说明。',
				},
				{
					role: 'assistant',
					content: prefix,
					partial: true,
				},
			],
		};

		this.abortController = new AbortController();
		const notice = new Notice('AI 正在补全...', 0);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.settings.apiKey}`,
				},
				body: JSON.stringify(body),
				signal: this.abortController.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				new Notice(`API 请求失败 (${response.status}): ${errorText}`);
				return;
			}

			const data = await response.json();
			const content = data.choices?.[0]?.message?.content;
			if (content) {
				editor.replaceRange(content, editor.getCursor());
			} else {
				new Notice('补全失败：模型返回了空内容，试试换 qwen-plus 或 qwen3.7-max');
			}
		} catch (e: unknown) {
			if (e instanceof Error && e.name === 'AbortError') {
				new Notice('已取消补全');
			} else {
				new Notice(`补全出错: ${e instanceof Error ? e.message : String(e)}`);
			}
		} finally {
			this.abortController = null;
			notice.hide();
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
	}
}