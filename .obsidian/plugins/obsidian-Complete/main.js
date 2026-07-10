"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CompletePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// models.json
var models_default = {
  "qwen3.7-max": "qwen3.7-max",
  "qwen3.6-max": "qwen3.6-max",
  "qwen3-max": "qwen3-max",
  "qwen-max": "qwen-max",
  "qwen3.7-plus": "qwen3.7-plus",
  "qwen3.6-plus": "qwen3.6-plus",
  "qwen3.5-plus": "qwen3.5-plus",
  "qwen-plus": "qwen-plus",
  "qwen3.6-flash": "qwen3.6-flash",
  "qwen3.5-flash": "qwen3.5-flash",
  "qwen-flash": "qwen-flash",
  "qwen3-coder": "qwen3-coder",
  "qwen2.5-coder": "qwen2.5-coder",
  "qwen-coder": "qwen-coder",
  "qwen-turbo": "qwen-turbo",
  "qwen3.6": "qwen3.6",
  "qwen3.5": "qwen3.5",
  qwen3: "qwen3",
  "qwen2.5": "qwen2.5",
  "qwen-math": "qwen-math",
  "qwen2.5-math": "qwen2.5-math",
  "siliconflow/deepseek-v3.2": "siliconflow/deepseek-v3.2",
  "siliconflow/deepseek-v3.1-terminus": "siliconflow/deepseek-v3.1-terminus",
  "siliconflow/deepseek-v3-0324": "siliconflow/deepseek-v3-0324",
  "vanchin/deepseek-v3.2-think": "vanchin/deepseek-v3.2-think",
  "vanchin/deepseek-r1": "vanchin/deepseek-r1",
  "vanchin/deepseek-v3": "vanchin/deepseek-v3",
  "qwen3-vl-plus": "qwen3-vl-plus",
  "qwen3-vl-flash": "qwen3-vl-flash",
  "qwen-vl-max": "qwen-vl-max",
  "qwen-vl-plus": "qwen-vl-plus",
  "qwen3-vl": "qwen3-vl",
  "kimi/kimi-k2.6": "kimi/kimi-k2.6",
  "kimi/kimi-k2.5": "kimi/kimi-k2.5"
};

// main.ts
var MAX_PREFIX_LENGTH = 7e5;
var DEFAULT_SETTINGS = {
  apiKey: "",
  workspaceId: "",
  model: "qwen3.7-plus"
};
var CompletePlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.abortController = null;
  }
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "trigger-complete",
      name: "\u89E6\u53D1 AI \u8865\u5168",
      editorCallback: (editor) => {
        this.triggerCompletion(editor);
      }
    });
    this.addSettingTab(new CompleteSettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async triggerCompletion(editor) {
    const cursor = editor.getCursor();
    const textBefore = editor.getRange({ line: 0, ch: 0 }, cursor);
    if (!textBefore.trim()) {
      new import_obsidian.Notice("\u5149\u6807\u524D\u6CA1\u6709\u6587\u672C\u5185\u5BB9\uFF0C\u65E0\u6CD5\u8865\u5168");
      return;
    }
    const prefix = textBefore.length > MAX_PREFIX_LENGTH ? textBefore.slice(-MAX_PREFIX_LENGTH) : textBefore;
    if (!this.settings.apiKey) {
      new import_obsidian.Notice("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u767E\u70BC API Key");
      return;
    }
    if (!this.settings.workspaceId) {
      new import_obsidian.Notice("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u767E\u70BC\u4E1A\u52A1\u7A7A\u95F4 ID");
      return;
    }
    const url = `https://${this.settings.workspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;
    const body = {
      model: this.settings.model,
      messages: [
        {
          role: "user",
          content: "\u8BF7\u6839\u636E\u7528\u6237\u63D0\u4F9B\u7684\u6587\u672C\u524D\u7F00\uFF0C\u81EA\u7136\u5730\u7EED\u5199\u540E\u7EED\u5185\u5BB9\u3002\u4FDD\u6301\u98CE\u683C\u4E00\u81F4\uFF0C\u76F4\u63A5\u7EED\u5199\uFF0C\u4E0D\u8981\u91CD\u590D\u524D\u7F00\u5185\u5BB9\uFF0C\u4E0D\u8981\u6DFB\u52A0\u989D\u5916\u8BF4\u660E\u3002"
        },
        {
          role: "assistant",
          content: prefix,
          partial: true
        }
      ]
    };
    this.abortController = new AbortController();
    const notice = new import_obsidian.Notice("AI \u6B63\u5728\u8865\u5168...", 0);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      });
      if (!response.ok) {
        const errorText = await response.text();
        new import_obsidian.Notice(`API \u8BF7\u6C42\u5931\u8D25 (${response.status}): ${errorText}`);
        return;
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        editor.replaceRange(content, editor.getCursor());
      } else {
        new import_obsidian.Notice("\u8865\u5168\u5931\u8D25\uFF1A\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u5185\u5BB9\uFF0C\u8BD5\u8BD5\u6362 qwen-plus \u6216 qwen3.7-max");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        new import_obsidian.Notice("\u5DF2\u53D6\u6D88\u8865\u5168");
      } else {
        new import_obsidian.Notice(`\u8865\u5168\u51FA\u9519: ${e instanceof Error ? e.message : String(e)}`);
      }
    } finally {
      this.abortController = null;
      notice.hide();
    }
  }
};
var CompleteSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const models = models_default;
    containerEl.createEl("h2", { text: "Complete \u914D\u7F6E" });
    new import_obsidian.Setting(containerEl).setName("\u767E\u70BC\u4E1A\u52A1\u7A7A\u95F4 ID").setDesc("\u963F\u91CC\u4E91\u767E\u70BC\u5E73\u53F0\u7684\u4E1A\u52A1\u7A7A\u95F4\u6807\u8BC6").addText(
      (text) => text.setPlaceholder("\u8BF7\u8F93\u5165\u767E\u70BC\u4E1A\u52A1\u7A7A\u95F4 ID").setValue(this.plugin.settings.workspaceId).onChange(async (value) => {
        this.plugin.settings.workspaceId = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u963F\u91CC\u4E91\u767E\u70BC API Key").setDesc("\u7528\u4E8E\u8C03\u7528\u767E\u70BC\u5E73\u53F0\u5927\u6A21\u578B\u670D\u52A1").addText(
      (text) => text.setPlaceholder("\u8BF7\u8F93\u5165\u4F60\u7684\u767E\u70BC API Key").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u8865\u5168\u6A21\u578B").setDesc("\u9009\u62E9\u7528\u4E8E\u6587\u672C\u8865\u5168\u7684\u6A21\u578B").addDropdown((dropdown) => {
      dropdown.addOptions(models).setValue(this.plugin.settings.model).onChange(async (value) => {
        this.plugin.settings.model = value;
        await this.plugin.saveSettings();
      });
    });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJtb2RlbHMuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBBcHAsIFNldHRpbmcsIE5vdGljZSwgRWRpdG9yIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IE1PREVMUyBmcm9tICcuL21vZGVscy5qc29uJztcblxuY29uc3QgTUFYX1BSRUZJWF9MRU5HVEggPSA3MDAwMDA7IC8vIDcwIFx1NEUwN1x1NUI1N1xuXG5pbnRlcmZhY2UgQ29tcGxldGVTZXR0aW5ncyB7XG5cdGFwaUtleTogc3RyaW5nO1xuXHR3b3Jrc3BhY2VJZDogc3RyaW5nO1xuXHRtb2RlbDogc3RyaW5nO1xufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBDb21wbGV0ZVNldHRpbmdzID0ge1xuXHRhcGlLZXk6ICcnLFxuXHR3b3Jrc3BhY2VJZDogJycsXG5cdG1vZGVsOiAncXdlbjMuNy1wbHVzJyxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbXBsZXRlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcblx0c2V0dGluZ3M6IENvbXBsZXRlU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuXHRwcml2YXRlIGFib3J0Q29udHJvbGxlcjogQWJvcnRDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5cblx0YXN5bmMgb25sb2FkKCkge1xuXHRcdGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6ICd0cmlnZ2VyLWNvbXBsZXRlJyxcblx0XHRcdG5hbWU6ICdcdTg5RTZcdTUzRDEgQUkgXHU4ODY1XHU1MTY4Jyxcblx0XHRcdGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHtcblx0XHRcdFx0dGhpcy50cmlnZ2VyQ29tcGxldGlvbihlZGl0b3IpO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgQ29tcGxldGVTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cdH1cblxuXHRhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG5cdH1cblxuXHRhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdHJpZ2dlckNvbXBsZXRpb24oZWRpdG9yOiBFZGl0b3IpIHtcblx0XHRjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XG5cblx0XHQvLyBcdTgzQjdcdTUzRDZcdTUxNDlcdTY4MDdcdTUyNERcdTc2ODRcdTUxNjhcdTkwRThcdTY1ODdcdTY3MkNcblx0XHRjb25zdCB0ZXh0QmVmb3JlID0gZWRpdG9yLmdldFJhbmdlKHsgbGluZTogMCwgY2g6IDAgfSwgY3Vyc29yKTtcblxuXHRcdGlmICghdGV4dEJlZm9yZS50cmltKCkpIHtcblx0XHRcdG5ldyBOb3RpY2UoJ1x1NTE0OVx1NjgwN1x1NTI0RFx1NkNBMVx1NjcwOVx1NjU4N1x1NjcyQ1x1NTE4NVx1NUJCOVx1RkYwQ1x1NjVFMFx1NkNENVx1ODg2NVx1NTE2OCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFx1NjIyQVx1NjVBRFx1RkYxQVx1NEZERFx1NzU1OVx1NjcwMFx1NjNBNVx1OEZEMVx1NTE0OVx1NjgwN1x1NzY4NCA3MCBcdTRFMDdcdTVCNTdcblx0XHRjb25zdCBwcmVmaXggPSB0ZXh0QmVmb3JlLmxlbmd0aCA+IE1BWF9QUkVGSVhfTEVOR1RIXG5cdFx0XHQ/IHRleHRCZWZvcmUuc2xpY2UoLU1BWF9QUkVGSVhfTEVOR1RIKVxuXHRcdFx0OiB0ZXh0QmVmb3JlO1xuXG5cdFx0Ly8gXHU2OEMwXHU2N0U1XHU5MTREXHU3RjZFXG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFwaUtleSkge1xuXHRcdFx0bmV3IE5vdGljZSgnXHU4QkY3XHU1MTQ4XHU1NzI4XHU4QkJFXHU3RjZFXHU0RTJEXHU5MTREXHU3RjZFXHU3NjdFXHU3MEJDIEFQSSBLZXknKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLndvcmtzcGFjZUlkKSB7XG5cdFx0XHRuZXcgTm90aWNlKCdcdThCRjdcdTUxNDhcdTU3MjhcdThCQkVcdTdGNkVcdTRFMkRcdTkxNERcdTdGNkVcdTc2N0VcdTcwQkNcdTRFMUFcdTUyQTFcdTdBN0FcdTk1RjQgSUQnKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMuc2V0dGluZ3Mud29ya3NwYWNlSWR9LmNuLWJlaWppbmcubWFhcy5hbGl5dW5jcy5jb20vY29tcGF0aWJsZS1tb2RlL3YxL2NoYXQvY29tcGxldGlvbnNgO1xuXG5cdFx0Y29uc3QgYm9keSA9IHtcblx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLm1vZGVsLFxuXHRcdFx0bWVzc2FnZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHJvbGU6ICd1c2VyJyxcblx0XHRcdFx0XHRjb250ZW50OiAnXHU4QkY3XHU2ODM5XHU2MzZFXHU3NTI4XHU2MjM3XHU2M0QwXHU0RjlCXHU3Njg0XHU2NTg3XHU2NzJDXHU1MjREXHU3RjAwXHVGRjBDXHU4MUVBXHU3MTM2XHU1NzMwXHU3RUVEXHU1MTk5XHU1NDBFXHU3RUVEXHU1MTg1XHU1QkI5XHUzMDAyXHU0RkREXHU2MzAxXHU5OENFXHU2ODNDXHU0RTAwXHU4MUY0XHVGRjBDXHU3NkY0XHU2M0E1XHU3RUVEXHU1MTk5XHVGRjBDXHU0RTBEXHU4OTgxXHU5MUNEXHU1OTBEXHU1MjREXHU3RjAwXHU1MTg1XHU1QkI5XHVGRjBDXHU0RTBEXHU4OTgxXHU2REZCXHU1MkEwXHU5ODlEXHU1OTE2XHU4QkY0XHU2NjBFXHUzMDAyJyxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHJvbGU6ICdhc3Npc3RhbnQnLFxuXHRcdFx0XHRcdGNvbnRlbnQ6IHByZWZpeCxcblx0XHRcdFx0XHRwYXJ0aWFsOiB0cnVlLFxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHR9O1xuXG5cdFx0dGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0Y29uc3Qgbm90aWNlID0gbmV3IE5vdGljZSgnQUkgXHU2QjYzXHU1NzI4XHU4ODY1XHU1MTY4Li4uJywgMCk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke3RoaXMuc2V0dGluZ3MuYXBpS2V5fWAsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuXHRcdFx0XHRzaWduYWw6IHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbCxcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcblx0XHRcdFx0bmV3IE5vdGljZShgQVBJIFx1OEJGN1x1NkM0Mlx1NTkzMVx1OEQyNSAoJHtyZXNwb25zZS5zdGF0dXN9KTogJHtlcnJvclRleHR9YCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBkYXRhLmNob2ljZXM/LlswXT8ubWVzc2FnZT8uY29udGVudDtcblx0XHRcdGlmIChjb250ZW50KSB7XG5cdFx0XHRcdGVkaXRvci5yZXBsYWNlUmFuZ2UoY29udGVudCwgZWRpdG9yLmdldEN1cnNvcigpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoJ1x1ODg2NVx1NTE2OFx1NTkzMVx1OEQyNVx1RkYxQVx1NkEyMVx1NTc4Qlx1OEZENFx1NTZERVx1NEU4Nlx1N0E3QVx1NTE4NVx1NUJCOVx1RkYwQ1x1OEJENVx1OEJENVx1NjM2MiBxd2VuLXBsdXMgXHU2MjE2IHF3ZW4zLjctbWF4Jyk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZTogdW5rbm93bikge1xuXHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xuXHRcdFx0XHRuZXcgTm90aWNlKCdcdTVERjJcdTUzRDZcdTZEODhcdTg4NjVcdTUxNjgnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFx1ODg2NVx1NTE2OFx1NTFGQVx1OTUxOTogJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSl9YCk7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuYWJvcnRDb250cm9sbGVyID0gbnVsbDtcblx0XHRcdG5vdGljZS5oaWRlKCk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIENvbXBsZXRlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuXHRwbHVnaW46IENvbXBsZXRlUGx1Z2luO1xuXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IENvbXBsZXRlUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cblx0ZGlzcGxheSgpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cblx0XHRjb25zdCBtb2RlbHMgPSBNT0RFTFMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcblxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0NvbXBsZXRlIFx1OTE0RFx1N0Y2RScgfSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdcdTc2N0VcdTcwQkNcdTRFMUFcdTUyQTFcdTdBN0FcdTk1RjQgSUQnKVxuXHRcdFx0LnNldERlc2MoJ1x1OTYzRlx1OTFDQ1x1NEU5MVx1NzY3RVx1NzBCQ1x1NUU3M1x1NTNGMFx1NzY4NFx1NEUxQVx1NTJBMVx1N0E3QVx1OTVGNFx1NjgwN1x1OEJDNicpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT5cblx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcignXHU4QkY3XHU4RjkzXHU1MTY1XHU3NjdFXHU3MEJDXHU0RTFBXHU1MkExXHU3QTdBXHU5NUY0IElEJylcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mud29ya3NwYWNlSWQpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mud29ya3NwYWNlSWQgPSB2YWx1ZS50cmltKCk7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ1x1OTYzRlx1OTFDQ1x1NEU5MVx1NzY3RVx1NzBCQyBBUEkgS2V5Jylcblx0XHRcdC5zZXREZXNjKCdcdTc1MjhcdTRFOEVcdThDMDNcdTc1MjhcdTc2N0VcdTcwQkNcdTVFNzNcdTUzRjBcdTU5MjdcdTZBMjFcdTU3OEJcdTY3MERcdTUyQTEnKVxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+XG5cdFx0XHRcdHRleHRcblx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ1x1OEJGN1x1OEY5M1x1NTE2NVx1NEY2MFx1NzY4NFx1NzY3RVx1NzBCQyBBUEkgS2V5Jylcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpS2V5KVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaUtleSA9IHZhbHVlLnRyaW0oKTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHQpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnXHU4ODY1XHU1MTY4XHU2QTIxXHU1NzhCJylcblx0XHRcdC5zZXREZXNjKCdcdTkwMDlcdTYyRTlcdTc1MjhcdTRFOEVcdTY1ODdcdTY3MkNcdTg4NjVcdTUxNjhcdTc2ODRcdTZBMjFcdTU3OEInKVxuXHRcdFx0LmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuXHRcdFx0XHRkcm9wZG93blxuXHRcdFx0XHRcdC5hZGRPcHRpb25zKG1vZGVscylcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubW9kZWwpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MubW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cbn0iLCAie1xuICBcInF3ZW4zLjctbWF4XCI6IFwicXdlbjMuNy1tYXhcIixcbiAgXCJxd2VuMy42LW1heFwiOiBcInF3ZW4zLjYtbWF4XCIsXG4gIFwicXdlbjMtbWF4XCI6IFwicXdlbjMtbWF4XCIsXG4gIFwicXdlbi1tYXhcIjogXCJxd2VuLW1heFwiLFxuICBcInF3ZW4zLjctcGx1c1wiOiBcInF3ZW4zLjctcGx1c1wiLFxuICBcInF3ZW4zLjYtcGx1c1wiOiBcInF3ZW4zLjYtcGx1c1wiLFxuICBcInF3ZW4zLjUtcGx1c1wiOiBcInF3ZW4zLjUtcGx1c1wiLFxuICBcInF3ZW4tcGx1c1wiOiBcInF3ZW4tcGx1c1wiLFxuICBcInF3ZW4zLjYtZmxhc2hcIjogXCJxd2VuMy42LWZsYXNoXCIsXG4gIFwicXdlbjMuNS1mbGFzaFwiOiBcInF3ZW4zLjUtZmxhc2hcIixcbiAgXCJxd2VuLWZsYXNoXCI6IFwicXdlbi1mbGFzaFwiLFxuICBcInF3ZW4zLWNvZGVyXCI6IFwicXdlbjMtY29kZXJcIixcbiAgXCJxd2VuMi41LWNvZGVyXCI6IFwicXdlbjIuNS1jb2RlclwiLFxuICBcInF3ZW4tY29kZXJcIjogXCJxd2VuLWNvZGVyXCIsXG4gIFwicXdlbi10dXJib1wiOiBcInF3ZW4tdHVyYm9cIixcbiAgXCJxd2VuMy42XCI6IFwicXdlbjMuNlwiLFxuICBcInF3ZW4zLjVcIjogXCJxd2VuMy41XCIsXG4gIFwicXdlbjNcIjogXCJxd2VuM1wiLFxuICBcInF3ZW4yLjVcIjogXCJxd2VuMi41XCIsXG4gIFwicXdlbi1tYXRoXCI6IFwicXdlbi1tYXRoXCIsXG4gIFwicXdlbjIuNS1tYXRoXCI6IFwicXdlbjIuNS1tYXRoXCIsXG4gIFwic2lsaWNvbmZsb3cvZGVlcHNlZWstdjMuMlwiOiBcInNpbGljb25mbG93L2RlZXBzZWVrLXYzLjJcIixcbiAgXCJzaWxpY29uZmxvdy9kZWVwc2Vlay12My4xLXRlcm1pbnVzXCI6IFwic2lsaWNvbmZsb3cvZGVlcHNlZWstdjMuMS10ZXJtaW51c1wiLFxuICBcInNpbGljb25mbG93L2RlZXBzZWVrLXYzLTAzMjRcIjogXCJzaWxpY29uZmxvdy9kZWVwc2Vlay12My0wMzI0XCIsXG4gIFwidmFuY2hpbi9kZWVwc2Vlay12My4yLXRoaW5rXCI6IFwidmFuY2hpbi9kZWVwc2Vlay12My4yLXRoaW5rXCIsXG4gIFwidmFuY2hpbi9kZWVwc2Vlay1yMVwiOiBcInZhbmNoaW4vZGVlcHNlZWstcjFcIixcbiAgXCJ2YW5jaGluL2RlZXBzZWVrLXYzXCI6IFwidmFuY2hpbi9kZWVwc2Vlay12M1wiLFxuICBcInF3ZW4zLXZsLXBsdXNcIjogXCJxd2VuMy12bC1wbHVzXCIsXG4gIFwicXdlbjMtdmwtZmxhc2hcIjogXCJxd2VuMy12bC1mbGFzaFwiLFxuICBcInF3ZW4tdmwtbWF4XCI6IFwicXdlbi12bC1tYXhcIixcbiAgXCJxd2VuLXZsLXBsdXNcIjogXCJxd2VuLXZsLXBsdXNcIixcbiAgXCJxd2VuMy12bFwiOiBcInF3ZW4zLXZsXCIsXG4gIFwia2ltaS9raW1pLWsyLjZcIjogXCJraW1pL2tpbWktazIuNlwiLFxuICBcImtpbWkva2ltaS1rMi41XCI6IFwia2ltaS9raW1pLWsyLjVcIlxufSJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUF1RTs7O0FDQXZFO0FBQUEsRUFDRSxlQUFlO0FBQUEsRUFDZixlQUFlO0FBQUEsRUFDZixhQUFhO0FBQUEsRUFDYixZQUFZO0FBQUEsRUFDWixnQkFBZ0I7QUFBQSxFQUNoQixnQkFBZ0I7QUFBQSxFQUNoQixnQkFBZ0I7QUFBQSxFQUNoQixhQUFhO0FBQUEsRUFDYixpQkFBaUI7QUFBQSxFQUNqQixpQkFBaUI7QUFBQSxFQUNqQixjQUFjO0FBQUEsRUFDZCxlQUFlO0FBQUEsRUFDZixpQkFBaUI7QUFBQSxFQUNqQixjQUFjO0FBQUEsRUFDZCxjQUFjO0FBQUEsRUFDZCxXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQUEsRUFDWCxPQUFTO0FBQUEsRUFDVCxXQUFXO0FBQUEsRUFDWCxhQUFhO0FBQUEsRUFDYixnQkFBZ0I7QUFBQSxFQUNoQiw2QkFBNkI7QUFBQSxFQUM3QixzQ0FBc0M7QUFBQSxFQUN0QyxnQ0FBZ0M7QUFBQSxFQUNoQywrQkFBK0I7QUFBQSxFQUMvQix1QkFBdUI7QUFBQSxFQUN2Qix1QkFBdUI7QUFBQSxFQUN2QixpQkFBaUI7QUFBQSxFQUNq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
