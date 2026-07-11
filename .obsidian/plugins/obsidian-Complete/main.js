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
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");
var MAX_PREFIX_LENGTH = 1e3;
var setHighlight = import_state.StateEffect.define();
var highlightField = import_state.StateField.define({
  create() {
    return import_view.Decoration.none;
  },
  update(decorations, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlight)) {
        if (e.value === null)
          return import_view.Decoration.none;
        return import_view.Decoration.set([
          import_view.Decoration.mark({
            attributes: {
              style: "background-color: #73AE52; color: #FBF1D7;"
            }
          }).range(e.value.from, e.value.to)
        ]);
      }
    }
    return decorations;
  },
  provide: (f) => import_view.EditorView.decorations.from(f)
});
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
    this.timedOut = false;
    this.keyHandler = null;
    this.activeCM = null;
    this.insertedRange = null;
    this.activeEditor = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerEditorExtension(highlightField);
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
    this.clearCompletion();
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
    const timeoutId = setTimeout(() => {
      this.timedOut = true;
      this.abortController?.abort();
    }, 2 * 60 * 1e3);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.apiKey}`
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
        const startPos = editor.getCursor();
        editor.replaceRange(content, startPos);
        const lines = content.split("\n");
        const endPos = {
          line: startPos.line + lines.length - 1,
          ch: lines.length === 1 ? startPos.ch + lines[0].length : lines[lines.length - 1].length
        };
        this.insertedRange = { from: startPos, to: endPos };
        this.activeEditor = editor;
        const cm = editor.cm;
        this.activeCM = cm;
        const from = cm.state.doc.line(startPos.line + 1).from + startPos.ch;
        const to = cm.state.doc.line(endPos.line + 1).from + endPos.ch;
        if (from === to)
          return;
        cm.dispatch({ effects: setHighlight.of({ from, to }) });
        const cmDom = cm.dom;
        this.keyHandler = (e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            this.clearCompletion();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this.undoCompletion();
          }
        };
        cmDom.addEventListener("keydown", this.keyHandler, true);
      } else {
        new import_obsidian.Notice(
          "\u8865\u5168\u5931\u8D25\uFF1A\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u5185\u5BB9\uFF0C\u8BD5\u8BD5\u6362 qwen-plus \u6216 qwen3.7-max"
        );
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        new import_obsidian.Notice(this.timedOut ? "\u8865\u5168\u8D85\u65F6\uFF1AAI \u751F\u6210\u8D85\u8FC7 2 \u5206\u949F\uFF0C\u5DF2\u505C\u6B62" : "\u5DF2\u53D6\u6D88\u8865\u5168");
      } else {
        new import_obsidian.Notice(
          `\u8865\u5168\u51FA\u9519: ${e instanceof Error ? e.message : String(e)}`
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
  clearCompletion() {
    this.removeKeyHandler();
    if (this.activeCM) {
      this.activeCM.dispatch({ effects: setHighlight.of(null) });
      this.activeCM = null;
    }
  }
  /** 撤销补全：删除插入内容 + 清除高亮 */
  undoCompletion() {
    if (this.activeEditor && this.insertedRange) {
      this.activeEditor.replaceRange(
        "",
        this.insertedRange.from,
        this.insertedRange.to
      );
    }
    this.clearCompletion();
    this.insertedRange = null;
    this.activeEditor = null;
  }
  removeKeyHandler() {
    if (this.keyHandler && this.activeCM) {
      this.activeCM.dom.removeEventListener("keydown", this.keyHandler, true);
      this.keyHandler = null;
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
    containerEl.createEl("h4", { text: "\u963F\u91CC\u4E91" });
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
    containerEl.createEl("h4", { text: "DeepSeek" });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJtb2RlbHMuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBBcHAsIFNldHRpbmcsIE5vdGljZSwgRWRpdG9yLCBFZGl0b3JQb3NpdGlvbiB9IGZyb20gJ29ic2lkaWFuJztcclxuaW1wb3J0IE1PREVMUyBmcm9tICcuL21vZGVscy5qc29uJztcclxuaW1wb3J0IHsgRGVjb3JhdGlvbiwgRGVjb3JhdGlvblNldCwgRWRpdG9yVmlldyB9IGZyb20gJ0Bjb2RlbWlycm9yL3ZpZXcnO1xyXG5pbXBvcnQgeyBTdGF0ZUZpZWxkLCBTdGF0ZUVmZmVjdCB9IGZyb20gJ0Bjb2RlbWlycm9yL3N0YXRlJztcclxuXHJcbmNvbnN0IE1BWF9QUkVGSVhfTEVOR1RIID0gMTAwMDtcclxuXHJcbi8vIFx1OUFEOFx1NEVBRVx1ODhDNVx1OTk3MFx1NTY2OFx1RkYxQVN0YXRlRWZmZWN0IFx1NzUyOFx1NEU4RVx1OEJCRVx1N0Y2RS9cdTZFMDVcdTk2NjRcdTg4NjVcdTUxNjhcdTlBRDhcdTRFQUVcdTgzMDNcdTU2RjRcclxuY29uc3Qgc2V0SGlnaGxpZ2h0ID0gU3RhdGVFZmZlY3QuZGVmaW5lPHsgZnJvbTogbnVtYmVyOyB0bzogbnVtYmVyIH0gfCBudWxsPigpO1xyXG5cclxuY29uc3QgaGlnaGxpZ2h0RmllbGQgPSBTdGF0ZUZpZWxkLmRlZmluZTxEZWNvcmF0aW9uU2V0Pih7XHJcblx0Y3JlYXRlKCkge1xyXG5cdFx0cmV0dXJuIERlY29yYXRpb24ubm9uZTtcclxuXHR9LFxyXG5cdHVwZGF0ZShkZWNvcmF0aW9ucywgdHIpIHtcclxuXHRcdGZvciAoY29uc3QgZSBvZiB0ci5lZmZlY3RzKSB7XHJcblx0XHRcdGlmIChlLmlzKHNldEhpZ2hsaWdodCkpIHtcclxuXHRcdFx0XHRpZiAoZS52YWx1ZSA9PT0gbnVsbCkgcmV0dXJuIERlY29yYXRpb24ubm9uZTtcclxuXHRcdFx0XHRyZXR1cm4gRGVjb3JhdGlvbi5zZXQoW1xyXG5cdFx0XHRcdFx0RGVjb3JhdGlvbi5tYXJrKHtcclxuXHRcdFx0XHRcdFx0YXR0cmlidXRlczoge1xyXG5cdFx0XHRcdFx0XHRcdHN0eWxlOiAnYmFja2dyb3VuZC1jb2xvcjogIzczQUU1MjsgY29sb3I6ICNGQkYxRDc7JyxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0pLnJhbmdlKGUudmFsdWUuZnJvbSwgZS52YWx1ZS50byksXHJcblx0XHRcdFx0XSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBkZWNvcmF0aW9ucztcclxuXHR9LFxyXG5cdHByb3ZpZGU6IChmKSA9PiBFZGl0b3JWaWV3LmRlY29yYXRpb25zLmZyb20oZiksXHJcbn0pO1xyXG5cclxuaW50ZXJmYWNlIENvbXBsZXRlU2V0dGluZ3Mge1xyXG5cdGFwaUtleTogc3RyaW5nO1xyXG5cdHdvcmtzcGFjZUlkOiBzdHJpbmc7XHJcblx0bW9kZWw6IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogQ29tcGxldGVTZXR0aW5ncyA9IHtcclxuXHRhcGlLZXk6ICcnLFxyXG5cdHdvcmtzcGFjZUlkOiAnJyxcclxuXHRtb2RlbDogJ3F3ZW4zLjctcGx1cycsXHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDb21wbGV0ZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcblx0c2V0dGluZ3M6IENvbXBsZXRlU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xyXG5cdHByaXZhdGUgYWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcclxuXHRwcml2YXRlIHRpbWVkT3V0ID0gZmFsc2U7XHJcblx0cHJpdmF0ZSBrZXlIYW5kbGVyOiAoKGU6IEtleWJvYXJkRXZlbnQpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XHJcblx0cHJpdmF0ZSBhY3RpdmVDTTogRWRpdG9yVmlldyB8IG51bGwgPSBudWxsO1xyXG5cdHByaXZhdGUgaW5zZXJ0ZWRSYW5nZTogeyBmcm9tOiBFZGl0b3JQb3NpdGlvbjsgdG86IEVkaXRvclBvc2l0aW9uIH0gfCBudWxsID0gbnVsbDtcclxuXHRwcml2YXRlIGFjdGl2ZUVkaXRvcjogRWRpdG9yIHwgbnVsbCA9IG51bGw7XHJcblxyXG5cdGFzeW5jIG9ubG9hZCgpIHtcclxuXHRcdGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XHJcblxyXG5cdFx0Ly8gXHU2Q0U4XHU1MThDXHU5QUQ4XHU0RUFFXHU4OEM1XHU5OTcwXHU1NjY4XHU2MjY5XHU1QzU1XHJcblx0XHR0aGlzLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKGhpZ2hsaWdodEZpZWxkKTtcclxuXHJcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xyXG5cdFx0XHRpZDogJ3RyaWdnZXItY29tcGxldGUnLFxyXG5cdFx0XHRuYW1lOiAnXHU4OUU2XHU1M0QxIEFJIFx1ODg2NVx1NTE2OCcsXHJcblx0XHRcdGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHtcclxuXHRcdFx0XHR0aGlzLnRyaWdnZXJDb21wbGV0aW9uKGVkaXRvcik7XHJcblx0XHRcdH0sXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmFkZFNldHRpbmdUYWIobmV3IENvbXBsZXRlU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cdH1cclxuXHJcblx0YXN5bmMgbG9hZFNldHRpbmdzKCkge1xyXG5cdFx0dGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XHJcblx0fVxyXG5cclxuXHRhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBhc3luYyB0cmlnZ2VyQ29tcGxldGlvbihlZGl0b3I6IEVkaXRvcikge1xyXG5cdFx0Y29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xyXG5cclxuXHRcdC8vIFx1ODNCN1x1NTNENlx1NTE0OVx1NjgwN1x1NTI0RFx1NzY4NFx1NTE2OFx1OTBFOFx1NjU4N1x1NjcyQ1xyXG5cdFx0Y29uc3QgdGV4dEJlZm9yZSA9IGVkaXRvci5nZXRSYW5nZSh7IGxpbmU6IDAsIGNoOiAwIH0sIGN1cnNvcik7XHJcblxyXG5cdFx0aWYgKCF0ZXh0QmVmb3JlLnRyaW0oKSkge1xyXG5cdFx0XHRuZXcgTm90aWNlKCdcdTUxNDlcdTY4MDdcdTUyNERcdTZDQTFcdTY3MDlcdTY1ODdcdTY3MkNcdTUxODVcdTVCQjlcdUZGMENcdTY1RTBcdTZDRDVcdTg4NjVcdTUxNjgnKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFx1NjIyQVx1NjVBRFx1RkYxQVx1NEZERFx1NzU1OVx1NjcwMFx1NjNBNVx1OEZEMVx1NTE0OVx1NjgwN1x1NzY4NCA3MCBcdTRFMDdcdTVCNTdcclxuXHRcdGNvbnN0IHByZWZpeCA9XHJcblx0XHRcdHRleHRCZWZvcmUubGVuZ3RoID4gTUFYX1BSRUZJWF9MRU5HVEhcclxuXHRcdFx0XHQ/IHRleHRCZWZvcmUuc2xpY2UoLU1BWF9QUkVGSVhfTEVOR1RIKVxyXG5cdFx0XHRcdDogdGV4dEJlZm9yZTtcclxuXHJcblx0XHQvLyBcdTY4QzBcdTY3RTVcdTkxNERcdTdGNkVcclxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5hcGlLZXkpIHtcclxuXHRcdFx0bmV3IE5vdGljZSgnXHU4QkY3XHU1MTQ4XHU1NzI4XHU4QkJFXHU3RjZFXHU0RTJEXHU5MTREXHU3RjZFXHU3NjdFXHU3MEJDIEFQSSBLZXknKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLndvcmtzcGFjZUlkKSB7XHJcblx0XHRcdG5ldyBOb3RpY2UoJ1x1OEJGN1x1NTE0OFx1NTcyOFx1OEJCRVx1N0Y2RVx1NEUyRFx1OTE0RFx1N0Y2RVx1NzY3RVx1NzBCQ1x1NEUxQVx1NTJBMVx1N0E3QVx1OTVGNCBJRCcpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gXHU2RTA1XHU5NjY0XHU0RTBBXHU0RTAwXHU2QjIxXHU3Njg0XHU4ODY1XHU1MTY4XHU3MkI2XHU2MDAxXHJcblx0XHR0aGlzLmNsZWFyQ29tcGxldGlvbigpO1xyXG5cclxuXHRcdGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5zZXR0aW5ncy53b3Jrc3BhY2VJZH0uY24tYmVpamluZy5tYWFzLmFsaXl1bmNzLmNvbS9jb21wYXRpYmxlLW1vZGUvdjEvY2hhdC9jb21wbGV0aW9uc2A7XHJcblxyXG5cdFx0Y29uc3QgYm9keSA9IHtcclxuXHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3MubW9kZWwsXHJcblx0XHRcdG1lc3NhZ2VzOiBbXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0cm9sZTogJ3VzZXInLFxyXG5cdFx0XHRcdFx0Y29udGVudDpcclxuXHRcdFx0XHRcdFx0J1x1OEJGN1x1NjgzOVx1NjM2RVx1NzUyOFx1NjIzN1x1NjNEMFx1NEY5Qlx1NzY4NFx1NjU4N1x1NjcyQ1x1NTI0RFx1N0YwMFx1RkYwQ1x1ODFFQVx1NzEzNlx1NTczMFx1N0VFRFx1NTE5OVx1NTQwRVx1N0VFRFx1NTE4NVx1NUJCOVx1MzAwMlx1NEZERFx1NjMwMVx1OThDRVx1NjgzQ1x1NEUwMFx1ODFGNFx1RkYwQ1x1NzZGNFx1NjNBNVx1N0VFRFx1NTE5OVx1RkYwQ1x1NEUwRFx1ODk4MVx1OTFDRFx1NTkwRFx1NTI0RFx1N0YwMFx1NTE4NVx1NUJCOVx1RkYwQ1x1NEUwRFx1ODk4MVx1NkRGQlx1NTJBMFx1OTg5RFx1NTkxNlx1OEJGNFx1NjYwRVx1MzAwMicsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRyb2xlOiAnYXNzaXN0YW50JyxcclxuXHRcdFx0XHRcdGNvbnRlbnQ6IHByZWZpeCxcclxuXHRcdFx0XHRcdHBhcnRpYWw6IHRydWUsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XSxcclxuXHRcdH07XHJcblxyXG5cdFx0dGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XHJcblx0XHRjb25zdCBub3RpY2UgPSBuZXcgTm90aWNlKCdBSSBcdTZCNjNcdTU3MjhcdTg4NjVcdTUxNjguLi4nLCAwKTtcclxuXHJcblx0XHQvLyAyIFx1NTIwNlx1OTQ5Rlx1OEQ4NVx1NjVGNlxyXG5cdFx0Y29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XHJcblx0XHRcdHRoaXMudGltZWRPdXQgPSB0cnVlO1xyXG5cdFx0XHR0aGlzLmFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcclxuXHRcdH0sIDIgKiA2MCAqIDEwMDApO1xyXG5cclxuXHRcdHRyeSB7XHJcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXHJcblx0XHRcdFx0aGVhZGVyczoge1xyXG5cdFx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuXHRcdFx0XHRcdEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnNldHRpbmdzLmFwaUtleX1gLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXHJcblx0XHRcdFx0c2lnbmFsOiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWwsXHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0aWYgKCFyZXNwb25zZS5vaykge1xyXG5cdFx0XHRcdGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuXHRcdFx0XHRuZXcgTm90aWNlKGBBUEkgXHU4QkY3XHU2QzQyXHU1OTMxXHU4RDI1ICgke3Jlc3BvbnNlLnN0YXR1c30pOiAke2Vycm9yVGV4dH1gKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XHJcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBkYXRhLmNob2ljZXM/LlswXT8ubWVzc2FnZT8uY29udGVudDtcclxuXHRcdFx0aWYgKGNvbnRlbnQpIHtcclxuXHRcdFx0XHRjb25zdCBzdGFydFBvcyA9IGVkaXRvci5nZXRDdXJzb3IoKTtcclxuXHRcdFx0XHRlZGl0b3IucmVwbGFjZVJhbmdlKGNvbnRlbnQsIHN0YXJ0UG9zKTtcclxuXHJcblx0XHRcdFx0Ly8gXHU2ODM5XHU2MzZFXHU1MTg1XHU1QkI5XHU4ODRDXHU2NTcwXHU4QkExXHU3Qjk3XHU3RUQzXHU2NzVGXHU0RjREXHU3RjZFXHJcblx0XHRcdFx0Y29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcclxuXHRcdFx0XHRjb25zdCBlbmRQb3M6IEVkaXRvclBvc2l0aW9uID0ge1xyXG5cdFx0XHRcdFx0bGluZTogc3RhcnRQb3MubGluZSArIGxpbmVzLmxlbmd0aCAtIDEsXHJcblx0XHRcdFx0XHRjaDpcclxuXHRcdFx0XHRcdFx0bGluZXMubGVuZ3RoID09PSAxXHJcblx0XHRcdFx0XHRcdFx0PyBzdGFydFBvcy5jaCArIGxpbmVzWzBdLmxlbmd0aFxyXG5cdFx0XHRcdFx0XHRcdDogbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoLFxyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdC8vIFx1OEJCMFx1NUY1NVx1NjNEMlx1NTE2NVx1ODMwM1x1NTZGNFx1RkYwQ1x1NzUyOFx1NEU4RSBFc2MgXHU2NEE0XHU5NTAwXHJcblx0XHRcdFx0dGhpcy5pbnNlcnRlZFJhbmdlID0geyBmcm9tOiBzdGFydFBvcywgdG86IGVuZFBvcyB9O1xyXG5cdFx0XHRcdHRoaXMuYWN0aXZlRWRpdG9yID0gZWRpdG9yO1xyXG5cclxuXHRcdFx0XHQvLyBcdTgzQjdcdTUzRDYgQ29kZU1pcnJvciBFZGl0b3JWaWV3IFx1NUI5RVx1NEY4QlxyXG5cdFx0XHRcdGNvbnN0IGNtID0gKGVkaXRvciBhcyBhbnkpLmNtIGFzIEVkaXRvclZpZXc7XHJcblx0XHRcdFx0dGhpcy5hY3RpdmVDTSA9IGNtO1xyXG5cclxuXHRcdFx0XHQvLyBcdTVDMDZcdTg4NENcdTUyMTdcdTRGNERcdTdGNkVcdThGNkNcdTRFM0FcdTY1ODdcdTY4NjNcdTUwNEZcdTc5RkJcdTkxQ0ZcclxuXHRcdFx0XHRjb25zdCBmcm9tID1cclxuXHRcdFx0XHRcdGNtLnN0YXRlLmRvYy5saW5lKHN0YXJ0UG9zLmxpbmUgKyAxKS5mcm9tICsgc3RhcnRQb3MuY2g7XHJcblx0XHRcdFx0Y29uc3QgdG8gPVxyXG5cdFx0XHRcdFx0Y20uc3RhdGUuZG9jLmxpbmUoZW5kUG9zLmxpbmUgKyAxKS5mcm9tICsgZW5kUG9zLmNoO1xyXG5cclxuXHRcdFx0XHRpZiAoZnJvbSA9PT0gdG8pIHJldHVybjsgLy8gXHU3QTdBXHU1MTg1XHU1QkI5XHU4REYzXHU4RkM3XHJcblxyXG5cdFx0XHRcdC8vIFx1NUU5NFx1NzUyOFx1OUFEOFx1NEVBRVxyXG5cdFx0XHRcdGNtLmRpc3BhdGNoKHsgZWZmZWN0czogc2V0SGlnaGxpZ2h0Lm9mKHsgZnJvbSwgdG8gfSkgfSk7XHJcblxyXG5cdFx0XHRcdC8vIFx1NzZEMVx1NTQyQyBUYWIgXHU1M0Q2XHU2RDg4XHU5QUQ4XHU0RUFFIC8gRXNjIFx1NjRBNFx1OTUwMFx1ODg2NVx1NTE2OFx1RkYwOFx1NjMwMlx1NTcyOCBDTSBET00gXHU0RTBBXHU5MDdGXHU1MTREXHU4OEFCIE9ic2lkaWFuIFx1NjJFNlx1NjIyQVx1RkYwOVxyXG5cdFx0XHRcdGNvbnN0IGNtRG9tID0gY20uZG9tO1xyXG5cdFx0XHRcdHRoaXMua2V5SGFuZGxlciA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoZS5rZXkgPT09ICdUYWInKSB7XHJcblx0XHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5jbGVhckNvbXBsZXRpb24oKTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XHJcblx0XHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0XHRcdFx0dGhpcy51bmRvQ29tcGxldGlvbigpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH07XHJcblx0XHRcdFx0Y21Eb20uYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMua2V5SGFuZGxlciwgdHJ1ZSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0bmV3IE5vdGljZShcclxuXHRcdFx0XHRcdCdcdTg4NjVcdTUxNjhcdTU5MzFcdThEMjVcdUZGMUFcdTZBMjFcdTU3OEJcdThGRDRcdTU2REVcdTRFODZcdTdBN0FcdTUxODVcdTVCQjlcdUZGMENcdThCRDVcdThCRDVcdTYzNjIgcXdlbi1wbHVzIFx1NjIxNiBxd2VuMy43LW1heCdcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGNhdGNoIChlOiB1bmtub3duKSB7XHJcblx0XHRcdGlmIChlIGluc3RhbmNlb2YgRXJyb3IgJiYgZS5uYW1lID09PSAnQWJvcnRFcnJvcicpIHtcclxuXHRcdFx0XHRuZXcgTm90aWNlKHRoaXMudGltZWRPdXQgPyAnXHU4ODY1XHU1MTY4XHU4RDg1XHU2NUY2XHVGRjFBQUkgXHU3NTFGXHU2MjEwXHU4RDg1XHU4RkM3IDIgXHU1MjA2XHU5NDlGXHVGRjBDXHU1REYyXHU1MDVDXHU2QjYyJyA6ICdcdTVERjJcdTUzRDZcdTZEODhcdTg4NjVcdTUxNjgnKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRuZXcgTm90aWNlKFxyXG5cdFx0XHRcdFx0YFx1ODg2NVx1NTE2OFx1NTFGQVx1OTUxOTogJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSl9YFxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZmluYWxseSB7XHJcblx0XHRcdGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xyXG5cdFx0XHR0aGlzLnRpbWVkT3V0ID0gZmFsc2U7XHJcblx0XHRcdHRoaXMuYWJvcnRDb250cm9sbGVyID0gbnVsbDtcclxuXHRcdFx0bm90aWNlLmhpZGUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKiBcdTZFMDVcdTk2NjRcdTg4NjVcdTUxNjhcdTlBRDhcdTRFQUVcdTU0OENcdTYzMDlcdTk1MkVcdTc2RDFcdTU0MkNcdUZGMDhcdTUxODVcdTVCQjlcdTRGRERcdTc1NTlcdUZGMDkgKi9cclxuXHRwcml2YXRlIGNsZWFyQ29tcGxldGlvbigpIHtcclxuXHRcdHRoaXMucmVtb3ZlS2V5SGFuZGxlcigpO1xyXG5cdFx0aWYgKHRoaXMuYWN0aXZlQ00pIHtcclxuXHRcdFx0dGhpcy5hY3RpdmVDTS5kaXNwYXRjaCh7IGVmZmVjdHM6IHNldEhpZ2hsaWdodC5vZihudWxsKSB9KTtcclxuXHRcdFx0dGhpcy5hY3RpdmVDTSA9IG51bGw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKiogXHU2NEE0XHU5NTAwXHU4ODY1XHU1MTY4XHVGRjFBXHU1MjIwXHU5NjY0XHU2M0QyXHU1MTY1XHU1MTg1XHU1QkI5ICsgXHU2RTA1XHU5NjY0XHU5QUQ4XHU0RUFFICovXHJcblx0cHJpdmF0ZSB1bmRvQ29tcGxldGlvbigpIHtcclxuXHRcdGlmICh0aGlzLmFjdGl2ZUVkaXRvciAmJiB0aGlzLmluc2VydGVkUmFuZ2UpIHtcclxuXHRcdFx0dGhpcy5hY3RpdmVFZGl0b3IucmVwbGFjZVJhbmdlKFxyXG5cdFx0XHRcdCcnLFxyXG5cdFx0XHRcdHRoaXMuaW5zZXJ0ZWRSYW5nZS5mcm9tLFxyXG5cdFx0XHRcdHRoaXMuaW5zZXJ0ZWRSYW5nZS50b1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5jbGVhckNvbXBsZXRpb24oKTtcclxuXHRcdHRoaXMuaW5zZXJ0ZWRSYW5nZSA9IG51bGw7XHJcblx0XHR0aGlzLmFjdGl2ZUVkaXRvciA9IG51bGw7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHJlbW92ZUtleUhhbmRsZXIoKSB7XHJcblx0XHRpZiAodGhpcy5rZXlIYW5kbGVyICYmIHRoaXMuYWN0aXZlQ00pIHtcclxuXHRcdFx0dGhpcy5hY3RpdmVDTS5kb20ucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMua2V5SGFuZGxlciwgdHJ1ZSk7XHJcblx0XHRcdHRoaXMua2V5SGFuZGxlciA9IG51bGw7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBDb21wbGV0ZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcclxuXHRwbHVnaW46IENvbXBsZXRlUGx1Z2luO1xyXG5cclxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBDb21wbGV0ZVBsdWdpbikge1xyXG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xyXG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcblx0fVxyXG5cclxuXHRkaXNwbGF5KCk6IHZvaWQge1xyXG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcclxuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XHJcblxyXG5cdFx0Y29uc3QgbW9kZWxzID0gTU9ERUxTIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz47XHJcblxyXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQ29tcGxldGUgXHU5MTREXHU3RjZFJyB9KTtcclxuXHJcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDQnLCB7IHRleHQ6ICdcdTk2M0ZcdTkxQ0NcdTRFOTEnIH0pO1xyXG5cclxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnXHU3NjdFXHU3MEJDXHU0RTFBXHU1MkExXHU3QTdBXHU5NUY0IElEJylcclxuXHRcdFx0LnNldERlc2MoJ1x1OTYzRlx1OTFDQ1x1NEU5MVx1NzY3RVx1NzBCQ1x1NUU3M1x1NTNGMFx1NzY4NFx1NEUxQVx1NTJBMVx1N0E3QVx1OTVGNFx1NjgwN1x1OEJDNicpXHJcblx0XHRcdC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG5cdFx0XHRcdHRleHRcclxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcignXHU4QkY3XHU4RjkzXHU1MTY1XHU3NjdFXHU3MEJDXHU0RTFBXHU1MkExXHU3QTdBXHU5NUY0IElEJylcclxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy53b3Jrc3BhY2VJZClcclxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mud29ya3NwYWNlSWQgPSB2YWx1ZS50cmltKCk7XHJcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0KTtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuXHRcdFx0LnNldE5hbWUoJ1x1OTYzRlx1OTFDQ1x1NEU5MVx1NzY3RVx1NzBCQyBBUEkgS2V5JylcclxuXHRcdFx0LnNldERlc2MoJ1x1NzUyOFx1NEU4RVx1OEMwM1x1NzUyOFx1NzY3RVx1NzBCQ1x1NUU3M1x1NTNGMFx1NTkyN1x1NkEyMVx1NTc4Qlx1NjcwRFx1NTJBMScpXHJcblx0XHRcdC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG5cdFx0XHRcdHRleHRcclxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcignXHU4QkY3XHU4RjkzXHU1MTY1XHU0RjYwXHU3Njg0XHU3NjdFXHU3MEJDIEFQSSBLZXknKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaUtleSlcclxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpS2V5ID0gdmFsdWUudHJpbSgpO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcblx0XHRcdC5zZXROYW1lKCdcdTg4NjVcdTUxNjhcdTZBMjFcdTU3OEInKVxyXG5cdFx0XHQuc2V0RGVzYygnXHU5MDA5XHU2MkU5XHU3NTI4XHU0RThFXHU2NTg3XHU2NzJDXHU4ODY1XHU1MTY4XHU3Njg0XHU2QTIxXHU1NzhCJylcclxuXHRcdFx0LmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xyXG5cdFx0XHRcdGRyb3Bkb3duXHJcblx0XHRcdFx0XHQuYWRkT3B0aW9ucyhtb2RlbHMpXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubW9kZWwpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm1vZGVsID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoNCcsIHsgdGV4dDogJ0RlZXBTZWVrJyB9KTtcclxuXHR9XHJcbn0iLCAie1xuICBcInF3ZW4zLjctbWF4XCI6IFwicXdlbjMuNy1tYXhcIixcbiAgXCJxd2VuMy42LW1heFwiOiBcInF3ZW4zLjYtbWF4XCIsXG4gIFwicXdlbjMtbWF4XCI6IFwicXdlbjMtbWF4XCIsXG4gIFwicXdlbi1tYXhcIjogXCJxd2VuLW1heFwiLFxuICBcInF3ZW4zLjctcGx1c1wiOiBcInF3ZW4zLjctcGx1c1wiLFxuICBcInF3ZW4zLjYtcGx1c1wiOiBcInF3ZW4zLjYtcGx1c1wiLFxuICBcInF3ZW4zLjUtcGx1c1wiOiBcInF3ZW4zLjUtcGx1c1wiLFxuICBcInF3ZW4tcGx1c1wiOiBcInF3ZW4tcGx1c1wiLFxuICBcInF3ZW4zLjYtZmxhc2hcIjogXCJxd2VuMy42LWZsYXNoXCIsXG4gIFwicXdlbjMuNS1mbGFzaFwiOiBcInF3ZW4zLjUtZmxhc2hcIixcbiAgXCJxd2VuLWZsYXNoXCI6IFwicXdlbi1mbGFzaFwiLFxuICBcInF3ZW4zLWNvZGVyXCI6IFwicXdlbjMtY29kZXJcIixcbiAgXCJxd2VuMi41LWNvZGVyXCI6IFwicXdlbjIuNS1jb2RlclwiLFxuICBcInF3ZW4tY29kZXJcIjogXCJxd2VuLWNvZGVyXCIsXG4gIFwicXdlbi10dXJib1wiOiBcInF3ZW4tdHVyYm9cIixcbiAgXCJxd2VuMy42XCI6IFwicXdlbjMuNlwiLFxuICBcInF3ZW4zLjVcIjogXCJxd2VuMy41XCIsXG4gIFwicXdlbjNcIjogXCJxd2VuM1wiLFxuICBcInF3ZW4yLjVcIjogXCJxd2VuMi41XCIsXG4gIFwicXdlbi1tYXRoXCI6IFwicXdlbi1tYXRoXCIsXG4gIFwicXdlbjIuNS1tYXRoXCI6IFwicXdlbjIuNS1tYXRoXCIsXG4gIFwic2lsaWNvbmZsb3cvZGVlcHNlZWstdjMuMlwiOiBcInNpbGljb25mbG93L2RlZXBzZWVrLXYzLjJcIixcbiAgXCJzaWxpY29uZmxvdy9kZWVwc2Vlay12My4xLXRlcm1pbnVzXCI6IFwic2lsaWNvbmZsb3cvZGVlcHNlZWstdjMuMS10ZXJtaW51c1wiLFxuICBcInNpbGljb25mbG93L2RlZXBzZWVrLXYzLTAzMjRcIjogXCJzaWxpY29uZmxvdy9kZWVwc2Vlay12My0wMzI0XCIsXG4gIFwidmFuY2hpbi9kZWVwc2Vlay12My4yLXRoaW5rXCI6IFwidmFuY2hpbi9kZWVwc2Vlay12My4yLXRoaW5rXCIsXG4gIFwidmFuY2hpbi9kZWVwc2Vlay1yMVwiOiBcInZhbmNoaW4vZGVlcHNlZWstcjFcIixcbiAgXCJ2YW5jaGluL2RlZXBzZWVrLXYzXCI6IFwidmFuY2hpbi9kZWVwc2Vlay12M1wiLFxuICBcInF3ZW4zLXZsLXBsdXNcIjogXCJxd2VuMy12bC1wbHVzXCIsXG4gIFwicXdlbjMtdmwtZmxhc2hcIjogXCJxd2VuMy12bC1mbGFzaFwiLFxuICBcInF3ZW4tdmwtbWF4XCI6IFwicXdlbi12bC1tYXhcIixcbiAgXCJxd2VuLXZsLXBsdXNcIjogXCJxd2VuLXZsLXBsdXNcIixcbiAgXCJxd2VuMy12bFwiOiBcInF3ZW4zLXZsXCIsXG4gIFwia2ltaS9raW1pLWsyLjZcIjogXCJraW1pL2tpbWktazIuNlwiLFxuICBcImtpbWkva2ltaS1rMi41XCI6IFwia2ltaS9raW1pLWsyLjVcIlxufSJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUF1Rjs7O0FDQXZGO0FBQUEsRUFDRSxlQUFlO0FBQUEsRUFDZixlQUFlO0FBQUEsRUFDZixhQUFhO0FBQUEsRUFDYixZQUFZO0FBQUEsRUFDWixnQkFBZ0I7QUFBQSxFQUNoQixnQkFBZ0I7QUFBQSxFQUNoQixnQkFBZ0I7QUFBQSxFQUNoQixhQUFhO0FBQUEsRUFDYixpQkFBaUI7QUFBQSxFQUNqQixpQkFBaUI7QUFBQSxFQUNqQixjQUFjO0FBQUEsRUFDZCxlQUFlO0FBQUEsRUFDZixpQkFBaUI7QUFBQSxFQUNqQixjQUFjO0FBQUEsRUFDZCxjQUFjO0FBQUEsRUFDZCxXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQUEsRUFDWCxPQUFTO0FBQUEsRUFDVCxXQUFXO0FBQUEsRUFDWCxhQUFhO0FBQUEsRUFDYixnQkFBZ0I7QUFBQSxFQUNoQiw2QkFBNkI7QUFBQSxFQUM3QixzQ0FBc0M7QUFBQSxFQUN0QyxnQ0FBZ0M7QUFBQSxFQUNoQywrQkFBK0I7QUFBQSxFQUMvQix1QkFBdUI7QUFBQSxFQUN2Qix1QkFBdUI7QUFBQSxFQUN2QixpQkFBaUI7QUFBQSxFQUNqQixrQkFBa0I7QUFBQSxFQUNsQixlQUFlO0FBQUEsRUFDZixnQkFBZ0I7QUFBQSxFQUNoQixZQUFZO0FBQUEsRUFDWixr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
