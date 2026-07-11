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
var MAX_FIM_TOKENS = 4096;
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
  model: "qwen3.7-plus",
  deepSeekApiKey: ""
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
    this.addCommand({
      id: "trigger-fim-complete",
      name: "\u89E6\u53D1 AI FIM \u8865\u5168",
      editorCallback: (editor) => {
        this.triggerCompletion(editor, true);
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
  async triggerCompletion(editor, forceFim = false) {
    const cursor = editor.getCursor();
    const tenLinesStartLine = Math.max(0, cursor.line - 9);
    const textBeforeTenLines = editor.getRange(
      { line: tenLinesStartLine, ch: 0 },
      cursor
    );
    if (!textBeforeTenLines.trim()) {
      new import_obsidian.Notice("\u5149\u6807\u524D 10 \u884C\u5185\u6CA1\u6709\u6587\u672C\u5185\u5BB9\uFF0C\u65E0\u6CD5\u8865\u5168");
      return;
    }
    const docEnd = editor.lastLine() + 1;
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
      new import_obsidian.Notice("FIM \u8865\u5168\u9700\u8981\u5149\u6807\u540E\u9762\u6709\u6587\u672C\u5185\u5BB9");
      return;
    }
    const useFim = fimSuffix.length > 0;
    if (useFim) {
      if (!this.settings.deepSeekApiKey) {
        new import_obsidian.Notice("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E DeepSeek API Key");
        return;
      }
    } else {
      if (!this.settings.apiKey) {
        new import_obsidian.Notice("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u767E\u70BC API Key");
        return;
      }
      if (!this.settings.workspaceId) {
        new import_obsidian.Notice("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u767E\u70BC\u4E1A\u52A1\u7A7A\u95F4 ID");
        return;
      }
    }
    this.clearCompletion();
    let url;
    let body;
    if (useFim) {
      url = "https://api.deepseek.com/beta/completions";
      body = {
        model: "deepseek-v4-pro",
        prompt: fimPrefix,
        suffix: fimSuffix,
        max_tokens: MAX_FIM_TOKENS,
        temperature: 0.7
      };
    } else {
      const textBefore = editor.getRange({ line: 0, ch: 0 }, cursor);
      const prefix = textBefore.length > MAX_PREFIX_LENGTH ? textBefore.slice(-MAX_PREFIX_LENGTH) : textBefore;
      url = `https://${this.settings.workspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;
      body = {
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
    }
    this.abortController = new AbortController();
    const notice = new import_obsidian.Notice(useFim ? "AI \u6B63\u5728 FIM \u8865\u5168..." : "AI \u6B63\u5728\u8865\u5168...", 0);
    const timeoutId = setTimeout(() => {
      this.timedOut = true;
      this.abortController?.abort();
    }, 2 * 60 * 1e3);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${useFim ? this.settings.deepSeekApiKey : this.settings.apiKey}`
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
      const content = useFim ? data.choices?.[0]?.text : data.choices?.[0]?.message?.content;
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
          useFim ? "\u8865\u5168\u5931\u8D25\uFF1AFIM \u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u5185\u5BB9" : "\u8865\u5168\u5931\u8D25\uFF1A\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u5185\u5BB9\uFF0C\u8BD5\u8BD5\u6362 qwen-plus \u6216 qwen3.7-max"
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
    new import_obsidian.Setting(containerEl).setName("DeepSeek API Key").setDesc("\u7528\u4E8E\u8C03\u7528 DeepSeek \u6A21\u578B\u670D\u52A1").addText(
      (text) => text.setPlaceholder("\u8BF7\u8F93\u5165\u4F60\u7684 DeepSeek API Key").setValue(this.plugin.settings.deepSeekApiKey).onChange(async (value) => {
        this.plugin.settings.deepSeekApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("DeepSeek FIM \u6A21\u578B").setDesc("\u5F53\u524D\uFF1Adeepseek-v4-pro");
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJtb2RlbHMuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBBcHAsIFNldHRpbmcsIE5vdGljZSwgRWRpdG9yLCBFZGl0b3JQb3NpdGlvbiB9IGZyb20gJ29ic2lkaWFuJztcclxuaW1wb3J0IE1PREVMUyBmcm9tICcuL21vZGVscy5qc29uJztcclxuaW1wb3J0IHsgRGVjb3JhdGlvbiwgRGVjb3JhdGlvblNldCwgRWRpdG9yVmlldyB9IGZyb20gJ0Bjb2RlbWlycm9yL3ZpZXcnO1xyXG5pbXBvcnQgeyBTdGF0ZUZpZWxkLCBTdGF0ZUVmZmVjdCB9IGZyb20gJ0Bjb2RlbWlycm9yL3N0YXRlJztcclxuXHJcbmNvbnN0IE1BWF9QUkVGSVhfTEVOR1RIID0gMTAwMDtcclxuY29uc3QgTUFYX0ZJTV9UT0tFTlMgPSA0MDk2O1xyXG5cclxuLy8gXHU5QUQ4XHU0RUFFXHU4OEM1XHU5OTcwXHU1NjY4XHVGRjFBU3RhdGVFZmZlY3QgXHU3NTI4XHU0RThFXHU4QkJFXHU3RjZFL1x1NkUwNVx1OTY2NFx1ODg2NVx1NTE2OFx1OUFEOFx1NEVBRVx1ODMwM1x1NTZGNFxyXG5jb25zdCBzZXRIaWdobGlnaHQgPSBTdGF0ZUVmZmVjdC5kZWZpbmU8eyBmcm9tOiBudW1iZXI7IHRvOiBudW1iZXIgfSB8IG51bGw+KCk7XHJcblxyXG5jb25zdCBoaWdobGlnaHRGaWVsZCA9IFN0YXRlRmllbGQuZGVmaW5lPERlY29yYXRpb25TZXQ+KHtcclxuXHRjcmVhdGUoKSB7XHJcblx0XHRyZXR1cm4gRGVjb3JhdGlvbi5ub25lO1xyXG5cdH0sXHJcblx0dXBkYXRlKGRlY29yYXRpb25zLCB0cikge1xyXG5cdFx0Zm9yIChjb25zdCBlIG9mIHRyLmVmZmVjdHMpIHtcclxuXHRcdFx0aWYgKGUuaXMoc2V0SGlnaGxpZ2h0KSkge1xyXG5cdFx0XHRcdGlmIChlLnZhbHVlID09PSBudWxsKSByZXR1cm4gRGVjb3JhdGlvbi5ub25lO1xyXG5cdFx0XHRcdHJldHVybiBEZWNvcmF0aW9uLnNldChbXHJcblx0XHRcdFx0XHREZWNvcmF0aW9uLm1hcmsoe1xyXG5cdFx0XHRcdFx0XHRhdHRyaWJ1dGVzOiB7XHJcblx0XHRcdFx0XHRcdFx0c3R5bGU6ICdiYWNrZ3JvdW5kLWNvbG9yOiAjNzNBRTUyOyBjb2xvcjogI0ZCRjFENzsnLFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSkucmFuZ2UoZS52YWx1ZS5mcm9tLCBlLnZhbHVlLnRvKSxcclxuXHRcdFx0XHRdKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGRlY29yYXRpb25zO1xyXG5cdH0sXHJcblx0cHJvdmlkZTogKGYpID0+IEVkaXRvclZpZXcuZGVjb3JhdGlvbnMuZnJvbShmKSxcclxufSk7XHJcblxyXG5pbnRlcmZhY2UgQ29tcGxldGVTZXR0aW5ncyB7XHJcblx0YXBpS2V5OiBzdHJpbmc7XHJcblx0d29ya3NwYWNlSWQ6IHN0cmluZztcclxuXHRtb2RlbDogc3RyaW5nO1xyXG5cdGRlZXBTZWVrQXBpS2V5OiBzdHJpbmc7XHJcbn1cclxuXHJcbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IENvbXBsZXRlU2V0dGluZ3MgPSB7XHJcblx0YXBpS2V5OiAnJyxcclxuXHR3b3Jrc3BhY2VJZDogJycsXHJcblx0bW9kZWw6ICdxd2VuMy43LXBsdXMnLFxyXG5cdGRlZXBTZWVrQXBpS2V5OiAnJyxcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbXBsZXRlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuXHRzZXR0aW5nczogQ29tcGxldGVTZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XHJcblx0cHJpdmF0ZSBhYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xyXG5cdHByaXZhdGUgdGltZWRPdXQgPSBmYWxzZTtcclxuXHRwcml2YXRlIGtleUhhbmRsZXI6ICgoZTogS2V5Ym9hcmRFdmVudCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcclxuXHRwcml2YXRlIGFjdGl2ZUNNOiBFZGl0b3JWaWV3IHwgbnVsbCA9IG51bGw7XHJcblx0cHJpdmF0ZSBpbnNlcnRlZFJhbmdlOiB7IGZyb206IEVkaXRvclBvc2l0aW9uOyB0bzogRWRpdG9yUG9zaXRpb24gfSB8IG51bGwgPSBudWxsO1xyXG5cdHByaXZhdGUgYWN0aXZlRWRpdG9yOiBFZGl0b3IgfCBudWxsID0gbnVsbDtcclxuXHJcblx0YXN5bmMgb25sb2FkKCkge1xyXG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuXHJcblx0XHQvLyBcdTZDRThcdTUxOENcdTlBRDhcdTRFQUVcdTg4QzVcdTk5NzBcdTU2NjhcdTYyNjlcdTVDNTVcclxuXHRcdHRoaXMucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oaGlnaGxpZ2h0RmllbGQpO1xyXG5cclxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XHJcblx0XHRcdGlkOiAndHJpZ2dlci1jb21wbGV0ZScsXHJcblx0XHRcdG5hbWU6ICdcdTg5RTZcdTUzRDEgQUkgXHU4ODY1XHU1MTY4JyxcclxuXHRcdFx0ZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4ge1xyXG5cdFx0XHRcdHRoaXMudHJpZ2dlckNvbXBsZXRpb24oZWRpdG9yKTtcclxuXHRcdFx0fSxcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XHJcblx0XHRcdGlkOiAndHJpZ2dlci1maW0tY29tcGxldGUnLFxyXG5cdFx0XHRuYW1lOiAnXHU4OUU2XHU1M0QxIEFJIEZJTSBcdTg4NjVcdTUxNjgnLFxyXG5cdFx0XHRlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XHJcblx0XHRcdFx0dGhpcy50cmlnZ2VyQ29tcGxldGlvbihlZGl0b3IsIHRydWUpO1xyXG5cdFx0XHR9LFxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBDb21wbGV0ZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHR9XHJcblxyXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xyXG5cdH1cclxuXHJcblx0YXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgYXN5bmMgdHJpZ2dlckNvbXBsZXRpb24oZWRpdG9yOiBFZGl0b3IsIGZvcmNlRmltID0gZmFsc2UpIHtcclxuXHRcdGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcclxuXHJcblx0XHQvLyBcdTUxNDhcdTY4QzBcdTY3RTVcdTUxNDlcdTY4MDdcdTUyNEQgMTAgXHU4ODRDXHU1MTg1XHU2NjJGXHU1NDI2XHU2NzA5XHU1QjlFXHU4RDI4XHU1MTg1XHU1QkI5XHJcblx0XHRjb25zdCB0ZW5MaW5lc1N0YXJ0TGluZSA9IE1hdGgubWF4KDAsIGN1cnNvci5saW5lIC0gOSk7XHJcblx0XHRjb25zdCB0ZXh0QmVmb3JlVGVuTGluZXMgPSBlZGl0b3IuZ2V0UmFuZ2UoXHJcblx0XHRcdHsgbGluZTogdGVuTGluZXNTdGFydExpbmUsIGNoOiAwIH0sXHJcblx0XHRcdGN1cnNvclxyXG5cdFx0KTtcclxuXHRcdGlmICghdGV4dEJlZm9yZVRlbkxpbmVzLnRyaW0oKSkge1xyXG5cdFx0XHRuZXcgTm90aWNlKCdcdTUxNDlcdTY4MDdcdTUyNEQgMTAgXHU4ODRDXHU1MTg1XHU2Q0ExXHU2NzA5XHU2NTg3XHU2NzJDXHU1MTg1XHU1QkI5XHVGRjBDXHU2NUUwXHU2Q0Q1XHU4ODY1XHU1MTY4Jyk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBkb2NFbmQgPSBlZGl0b3IubGFzdExpbmUoKSArIDE7XHJcblxyXG5cdFx0Ly8gRklNIFx1NEUwQVx1NEUwQlx1NjU4N1x1RkYxQVx1NTE0OVx1NjgwN1x1OTY0NFx1OEZEMVx1NTQwNCA1IFx1ODg0Q1xyXG5cdFx0Y29uc3QgZmltQ29udGV4dFN0YXJ0ID0gTWF0aC5tYXgoMCwgY3Vyc29yLmxpbmUgLSA0KTtcclxuXHRcdGNvbnN0IGZpbUNvbnRleHRFbmQgPSBNYXRoLm1pbihkb2NFbmQsIGN1cnNvci5saW5lICsgNik7XHJcblx0XHRjb25zdCBmaW1QcmVmaXggPSBlZGl0b3IuZ2V0UmFuZ2UoXHJcblx0XHRcdHsgbGluZTogZmltQ29udGV4dFN0YXJ0LCBjaDogMCB9LFxyXG5cdFx0XHRjdXJzb3JcclxuXHRcdCk7XHJcblx0XHRjb25zdCBmaW1TdWZmaXggPSBlZGl0b3IuZ2V0UmFuZ2UoXHJcblx0XHRcdGN1cnNvcixcclxuXHRcdFx0eyBsaW5lOiBmaW1Db250ZXh0RW5kIC0gMSwgY2g6IGVkaXRvci5nZXRMaW5lKGZpbUNvbnRleHRFbmQgLSAxKS5sZW5ndGggfVxyXG5cdFx0KS50cmltKCk7XHJcblxyXG5cdFx0aWYgKGZvcmNlRmltICYmICFmaW1TdWZmaXgubGVuZ3RoKSB7XHJcblx0XHRcdG5ldyBOb3RpY2UoJ0ZJTSBcdTg4NjVcdTUxNjhcdTk3MDBcdTg5ODFcdTUxNDlcdTY4MDdcdTU0MEVcdTk3NjJcdTY3MDlcdTY1ODdcdTY3MkNcdTUxODVcdTVCQjknKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0Y29uc3QgdXNlRmltID0gZmltU3VmZml4Lmxlbmd0aCA+IDA7XHJcblxyXG5cdFx0Ly8gXHU2OEMwXHU2N0U1XHU5MTREXHU3RjZFXHJcblx0XHRpZiAodXNlRmltKSB7XHJcblx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5kZWVwU2Vla0FwaUtleSkge1xyXG5cdFx0XHRcdG5ldyBOb3RpY2UoJ1x1OEJGN1x1NTE0OFx1NTcyOFx1OEJCRVx1N0Y2RVx1NEUyRFx1OTE0RFx1N0Y2RSBEZWVwU2VlayBBUEkgS2V5Jyk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuYXBpS2V5KSB7XHJcblx0XHRcdFx0bmV3IE5vdGljZSgnXHU4QkY3XHU1MTQ4XHU1NzI4XHU4QkJFXHU3RjZFXHU0RTJEXHU5MTREXHU3RjZFXHU3NjdFXHU3MEJDIEFQSSBLZXknKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLndvcmtzcGFjZUlkKSB7XHJcblx0XHRcdFx0bmV3IE5vdGljZSgnXHU4QkY3XHU1MTQ4XHU1NzI4XHU4QkJFXHU3RjZFXHU0RTJEXHU5MTREXHU3RjZFXHU3NjdFXHU3MEJDXHU0RTFBXHU1MkExXHU3QTdBXHU5NUY0IElEJyk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gXHU2RTA1XHU5NjY0XHU0RTBBXHU0RTAwXHU2QjIxXHU3Njg0XHU4ODY1XHU1MTY4XHU3MkI2XHU2MDAxXHJcblx0XHR0aGlzLmNsZWFyQ29tcGxldGlvbigpO1xyXG5cclxuXHRcdGxldCB1cmw6IHN0cmluZztcclxuXHRcdGxldCBib2R5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcclxuXHJcblx0XHRpZiAodXNlRmltKSB7XHJcblx0XHRcdHVybCA9ICdodHRwczovL2FwaS5kZWVwc2Vlay5jb20vYmV0YS9jb21wbGV0aW9ucyc7XHJcblx0XHRcdGJvZHkgPSB7XHJcblx0XHRcdFx0bW9kZWw6ICdkZWVwc2Vlay12NC1wcm8nLFxyXG5cdFx0XHRcdHByb21wdDogZmltUHJlZml4LFxyXG5cdFx0XHRcdHN1ZmZpeDogZmltU3VmZml4LFxyXG5cdFx0XHRcdG1heF90b2tlbnM6IE1BWF9GSU1fVE9LRU5TLFxyXG5cdFx0XHRcdHRlbXBlcmF0dXJlOiAwLjcsXHJcblx0XHRcdH07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRjb25zdCB0ZXh0QmVmb3JlID0gZWRpdG9yLmdldFJhbmdlKHsgbGluZTogMCwgY2g6IDAgfSwgY3Vyc29yKTtcclxuXHRcdFx0Y29uc3QgcHJlZml4ID1cclxuXHRcdFx0XHR0ZXh0QmVmb3JlLmxlbmd0aCA+IE1BWF9QUkVGSVhfTEVOR1RIXHJcblx0XHRcdFx0XHQ/IHRleHRCZWZvcmUuc2xpY2UoLU1BWF9QUkVGSVhfTEVOR1RIKVxyXG5cdFx0XHRcdFx0OiB0ZXh0QmVmb3JlO1xyXG5cdFx0XHR1cmwgPSBgaHR0cHM6Ly8ke3RoaXMuc2V0dGluZ3Mud29ya3NwYWNlSWR9LmNuLWJlaWppbmcubWFhcy5hbGl5dW5jcy5jb20vY29tcGF0aWJsZS1tb2RlL3YxL2NoYXQvY29tcGxldGlvbnNgO1xyXG5cdFx0XHRib2R5ID0ge1xyXG5cdFx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLm1vZGVsLFxyXG5cdFx0XHRcdG1lc3NhZ2VzOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHJvbGU6ICd1c2VyJyxcclxuXHRcdFx0XHRcdFx0Y29udGVudDpcclxuXHRcdFx0XHRcdFx0XHQnXHU4QkY3XHU2ODM5XHU2MzZFXHU3NTI4XHU2MjM3XHU2M0QwXHU0RjlCXHU3Njg0XHU2NTg3XHU2NzJDXHU1MjREXHU3RjAwXHVGRjBDXHU4MUVBXHU3MTM2XHU1NzMwXHU3RUVEXHU1MTk5XHU1NDBFXHU3RUVEXHU1MTg1XHU1QkI5XHUzMDAyXHU0RkREXHU2MzAxXHU5OENFXHU2ODNDXHU0RTAwXHU4MUY0XHVGRjBDXHU3NkY0XHU2M0E1XHU3RUVEXHU1MTk5XHVGRjBDXHU0RTBEXHU4OTgxXHU5MUNEXHU1OTBEXHU1MjREXHU3RjAwXHU1MTg1XHU1QkI5XHVGRjBDXHU0RTBEXHU4OTgxXHU2REZCXHU1MkEwXHU5ODlEXHU1OTE2XHU4QkY0XHU2NjBFXHUzMDAyJyxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHJvbGU6ICdhc3Npc3RhbnQnLFxyXG5cdFx0XHRcdFx0XHRjb250ZW50OiBwcmVmaXgsXHJcblx0XHRcdFx0XHRcdHBhcnRpYWw6IHRydWUsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XHJcblx0XHRjb25zdCBub3RpY2UgPSBuZXcgTm90aWNlKHVzZUZpbSA/ICdBSSBcdTZCNjNcdTU3MjggRklNIFx1ODg2NVx1NTE2OC4uLicgOiAnQUkgXHU2QjYzXHU1NzI4XHU4ODY1XHU1MTY4Li4uJywgMCk7XHJcblxyXG5cdFx0Ly8gMiBcdTUyMDZcdTk0OUZcdThEODVcdTY1RjZcclxuXHRcdGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHR0aGlzLnRpbWVkT3V0ID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5hYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XHJcblx0XHR9LCAyICogNjAgKiAxMDAwKTtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xyXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxyXG5cdFx0XHRcdGhlYWRlcnM6IHtcclxuXHRcdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcblx0XHRcdFx0XHRBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dXNlRmltID8gdGhpcy5zZXR0aW5ncy5kZWVwU2Vla0FwaUtleSA6IHRoaXMuc2V0dGluZ3MuYXBpS2V5fWAsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcclxuXHRcdFx0XHRzaWduYWw6IHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbCxcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XHJcblx0XHRcdFx0Y29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG5cdFx0XHRcdG5ldyBOb3RpY2UoYEFQSSBcdThCRjdcdTZDNDJcdTU5MzFcdThEMjUgKCR7cmVzcG9uc2Uuc3RhdHVzfSk6ICR7ZXJyb3JUZXh0fWApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcclxuXHRcdFx0Ly8gRklNIFx1NzUyOCBjaG9pY2VzWzBdLnRleHRcdUZGMENcdTk2M0ZcdTkxQ0NcdTRFOTFcdTc1MjggY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnRcclxuXHRcdFx0Y29uc3QgY29udGVudCA9IHVzZUZpbVxyXG5cdFx0XHRcdD8gZGF0YS5jaG9pY2VzPy5bMF0/LnRleHRcclxuXHRcdFx0XHQ6IGRhdGEuY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50O1xyXG5cdFx0XHRpZiAoY29udGVudCkge1xyXG5cdFx0XHRcdGNvbnN0IHN0YXJ0UG9zID0gZWRpdG9yLmdldEN1cnNvcigpO1xyXG5cdFx0XHRcdGVkaXRvci5yZXBsYWNlUmFuZ2UoY29udGVudCwgc3RhcnRQb3MpO1xyXG5cclxuXHRcdFx0XHQvLyBcdTY4MzlcdTYzNkVcdTUxODVcdTVCQjlcdTg4NENcdTY1NzBcdThCQTFcdTdCOTdcdTdFRDNcdTY3NUZcdTRGNERcdTdGNkVcclxuXHRcdFx0XHRjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xyXG5cdFx0XHRcdGNvbnN0IGVuZFBvczogRWRpdG9yUG9zaXRpb24gPSB7XHJcblx0XHRcdFx0XHRsaW5lOiBzdGFydFBvcy5saW5lICsgbGluZXMubGVuZ3RoIC0gMSxcclxuXHRcdFx0XHRcdGNoOlxyXG5cdFx0XHRcdFx0XHRsaW5lcy5sZW5ndGggPT09IDFcclxuXHRcdFx0XHRcdFx0XHQ/IHN0YXJ0UG9zLmNoICsgbGluZXNbMF0ubGVuZ3RoXHJcblx0XHRcdFx0XHRcdFx0OiBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS5sZW5ndGgsXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0Ly8gXHU4QkIwXHU1RjU1XHU2M0QyXHU1MTY1XHU4MzAzXHU1NkY0XHVGRjBDXHU3NTI4XHU0RThFIEVzYyBcdTY0QTRcdTk1MDBcclxuXHRcdFx0XHR0aGlzLmluc2VydGVkUmFuZ2UgPSB7IGZyb206IHN0YXJ0UG9zLCB0bzogZW5kUG9zIH07XHJcblx0XHRcdFx0dGhpcy5hY3RpdmVFZGl0b3IgPSBlZGl0b3I7XHJcblxyXG5cdFx0XHRcdC8vIFx1ODNCN1x1NTNENiBDb2RlTWlycm9yIEVkaXRvclZpZXcgXHU1QjlFXHU0RjhCXHJcblx0XHRcdFx0Y29uc3QgY20gPSAoZWRpdG9yIGFzIGFueSkuY20gYXMgRWRpdG9yVmlldztcclxuXHRcdFx0XHR0aGlzLmFjdGl2ZUNNID0gY207XHJcblxyXG5cdFx0XHRcdC8vIFx1NUMwNlx1ODg0Q1x1NTIxN1x1NEY0RFx1N0Y2RVx1OEY2Q1x1NEUzQVx1NjU4N1x1Njg2M1x1NTA0Rlx1NzlGQlx1OTFDRlxyXG5cdFx0XHRcdGNvbnN0IGZyb20gPVxyXG5cdFx0XHRcdFx0Y20uc3RhdGUuZG9jLmxpbmUoc3RhcnRQb3MubGluZSArIDEpLmZyb20gKyBzdGFydFBvcy5jaDtcclxuXHRcdFx0XHRjb25zdCB0byA9XHJcblx0XHRcdFx0XHRjbS5zdGF0ZS5kb2MubGluZShlbmRQb3MubGluZSArIDEpLmZyb20gKyBlbmRQb3MuY2g7XHJcblxyXG5cdFx0XHRcdGlmIChmcm9tID09PSB0bykgcmV0dXJuOyAvLyBcdTdBN0FcdTUxODVcdTVCQjlcdThERjNcdThGQzdcclxuXHJcblx0XHRcdFx0Ly8gXHU1RTk0XHU3NTI4XHU5QUQ4XHU0RUFFXHJcblx0XHRcdFx0Y20uZGlzcGF0Y2goeyBlZmZlY3RzOiBzZXRIaWdobGlnaHQub2YoeyBmcm9tLCB0byB9KSB9KTtcclxuXHJcblx0XHRcdFx0Ly8gXHU3NkQxXHU1NDJDIFRhYiBcdTUzRDZcdTZEODhcdTlBRDhcdTRFQUUgLyBFc2MgXHU2NEE0XHU5NTAwXHU4ODY1XHU1MTY4XHVGRjA4XHU2MzAyXHU1NzI4IENNIERPTSBcdTRFMEFcdTkwN0ZcdTUxNERcdTg4QUIgT2JzaWRpYW4gXHU2MkU2XHU2MjJBXHVGRjA5XHJcblx0XHRcdFx0Y29uc3QgY21Eb20gPSBjbS5kb207XHJcblx0XHRcdFx0dGhpcy5rZXlIYW5kbGVyID0gKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcclxuXHRcdFx0XHRcdGlmIChlLmtleSA9PT0gJ1RhYicpIHtcclxuXHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmNsZWFyQ29tcGxldGlvbigpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcclxuXHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLnVuZG9Db21wbGV0aW9uKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHRcdFx0XHRjbURvbS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5rZXlIYW5kbGVyLCB0cnVlKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRuZXcgTm90aWNlKFxyXG5cdFx0XHRcdFx0dXNlRmltXHJcblx0XHRcdFx0XHRcdD8gJ1x1ODg2NVx1NTE2OFx1NTkzMVx1OEQyNVx1RkYxQUZJTSBcdTZBMjFcdTU3OEJcdThGRDRcdTU2REVcdTRFODZcdTdBN0FcdTUxODVcdTVCQjknXHJcblx0XHRcdFx0XHRcdDogJ1x1ODg2NVx1NTE2OFx1NTkzMVx1OEQyNVx1RkYxQVx1NkEyMVx1NTc4Qlx1OEZENFx1NTZERVx1NEU4Nlx1N0E3QVx1NTE4NVx1NUJCOVx1RkYwQ1x1OEJENVx1OEJENVx1NjM2MiBxd2VuLXBsdXMgXHU2MjE2IHF3ZW4zLjctbWF4J1xyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKGU6IHVua25vd24pIHtcclxuXHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xyXG5cdFx0XHRcdG5ldyBOb3RpY2UodGhpcy50aW1lZE91dCA/ICdcdTg4NjVcdTUxNjhcdThEODVcdTY1RjZcdUZGMUFBSSBcdTc1MUZcdTYyMTBcdThEODVcdThGQzcgMiBcdTUyMDZcdTk0OUZcdUZGMENcdTVERjJcdTUwNUNcdTZCNjInIDogJ1x1NURGMlx1NTNENlx1NkQ4OFx1ODg2NVx1NTE2OCcpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG5ldyBOb3RpY2UoXHJcblx0XHRcdFx0XHRgXHU4ODY1XHU1MTY4XHU1MUZBXHU5NTE5OiAke2UgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKX1gXHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cdFx0fSBmaW5hbGx5IHtcclxuXHRcdFx0Y2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XHJcblx0XHRcdHRoaXMudGltZWRPdXQgPSBmYWxzZTtcclxuXHRcdFx0dGhpcy5hYm9ydENvbnRyb2xsZXIgPSBudWxsO1xyXG5cdFx0XHRub3RpY2UuaGlkZSgpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqIFx1NkUwNVx1OTY2NFx1ODg2NVx1NTE2OFx1OUFEOFx1NEVBRVx1NTQ4Q1x1NjMwOVx1OTUyRVx1NzZEMVx1NTQyQ1x1RkYwOFx1NTE4NVx1NUJCOVx1NEZERFx1NzU1OVx1RkYwOSAqL1xyXG5cdHByaXZhdGUgY2xlYXJDb21wbGV0aW9uKCkge1xyXG5cdFx0dGhpcy5yZW1vdmVLZXlIYW5kbGVyKCk7XHJcblx0XHRpZiAodGhpcy5hY3RpdmVDTSkge1xyXG5cdFx0XHR0aGlzLmFjdGl2ZUNNLmRpc3BhdGNoKHsgZWZmZWN0czogc2V0SGlnaGxpZ2h0Lm9mKG51bGwpIH0pO1xyXG5cdFx0XHR0aGlzLmFjdGl2ZUNNID0gbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKiBcdTY0QTRcdTk1MDBcdTg4NjVcdTUxNjhcdUZGMUFcdTUyMjBcdTk2NjRcdTYzRDJcdTUxNjVcdTUxODVcdTVCQjkgKyBcdTZFMDVcdTk2NjRcdTlBRDhcdTRFQUUgKi9cclxuXHRwcml2YXRlIHVuZG9Db21wbGV0aW9uKCkge1xyXG5cdFx0aWYgKHRoaXMuYWN0aXZlRWRpdG9yICYmIHRoaXMuaW5zZXJ0ZWRSYW5nZSkge1xyXG5cdFx0XHR0aGlzLmFjdGl2ZUVkaXRvci5yZXBsYWNlUmFuZ2UoXHJcblx0XHRcdFx0JycsXHJcblx0XHRcdFx0dGhpcy5pbnNlcnRlZFJhbmdlLmZyb20sXHJcblx0XHRcdFx0dGhpcy5pbnNlcnRlZFJhbmdlLnRvXHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblx0XHR0aGlzLmNsZWFyQ29tcGxldGlvbigpO1xyXG5cdFx0dGhpcy5pbnNlcnRlZFJhbmdlID0gbnVsbDtcclxuXHRcdHRoaXMuYWN0aXZlRWRpdG9yID0gbnVsbDtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgcmVtb3ZlS2V5SGFuZGxlcigpIHtcclxuXHRcdGlmICh0aGlzLmtleUhhbmRsZXIgJiYgdGhpcy5hY3RpdmVDTSkge1xyXG5cdFx0XHR0aGlzLmFjdGl2ZUNNLmRvbS5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5rZXlIYW5kbGVyLCB0cnVlKTtcclxuXHRcdFx0dGhpcy5rZXlIYW5kbGVyID0gbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIENvbXBsZXRlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG5cdHBsdWdpbjogQ29tcGxldGVQbHVnaW47XHJcblxyXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IENvbXBsZXRlUGx1Z2luKSB7XHJcblx0XHRzdXBlcihhcHAsIHBsdWdpbik7XHJcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuXHR9XHJcblxyXG5cdGRpc3BsYXkoKTogdm9pZCB7XHJcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcblx0XHRjb25zdCBtb2RlbHMgPSBNT0RFTFMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcclxuXHJcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdDb21wbGV0ZSBcdTkxNERcdTdGNkUnIH0pO1xyXG5cclxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoNCcsIHsgdGV4dDogJ1x1OTYzRlx1OTFDQ1x1NEU5MScgfSk7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcblx0XHRcdC5zZXROYW1lKCdcdTc2N0VcdTcwQkNcdTRFMUFcdTUyQTFcdTdBN0FcdTk1RjQgSUQnKVxyXG5cdFx0XHQuc2V0RGVzYygnXHU5NjNGXHU5MUNDXHU0RTkxXHU3NjdFXHU3MEJDXHU1RTczXHU1M0YwXHU3Njg0XHU0RTFBXHU1MkExXHU3QTdBXHU5NUY0XHU2ODA3XHU4QkM2JylcclxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+XHJcblx0XHRcdFx0dGV4dFxyXG5cdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCdcdThCRjdcdThGOTNcdTUxNjVcdTc2N0VcdTcwQkNcdTRFMUFcdTUyQTFcdTdBN0FcdTk1RjQgSUQnKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLndvcmtzcGFjZUlkKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy53b3Jrc3BhY2VJZCA9IHZhbHVlLnRyaW0oKTtcclxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnXHU5NjNGXHU5MUNDXHU0RTkxXHU3NjdFXHU3MEJDIEFQSSBLZXknKVxyXG5cdFx0XHQuc2V0RGVzYygnXHU3NTI4XHU0RThFXHU4QzAzXHU3NTI4XHU3NjdFXHU3MEJDXHU1RTczXHU1M0YwXHU1OTI3XHU2QTIxXHU1NzhCXHU2NzBEXHU1MkExJylcclxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+XHJcblx0XHRcdFx0dGV4dFxyXG5cdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCdcdThCRjdcdThGOTNcdTUxNjVcdTRGNjBcdTc2ODRcdTc2N0VcdTcwQkMgQVBJIEtleScpXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpS2V5KVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlLZXkgPSB2YWx1ZS50cmltKCk7XHJcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0KTtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuXHRcdFx0LnNldE5hbWUoJ1x1ODg2NVx1NTE2OFx1NkEyMVx1NTc4QicpXHJcblx0XHRcdC5zZXREZXNjKCdcdTkwMDlcdTYyRTlcdTc1MjhcdTRFOEVcdTY1ODdcdTY3MkNcdTg4NjVcdTUxNjhcdTc2ODRcdTZBMjFcdTU3OEInKVxyXG5cdFx0XHQuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XHJcblx0XHRcdFx0ZHJvcGRvd25cclxuXHRcdFx0XHRcdC5hZGRPcHRpb25zKG1vZGVscylcclxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb2RlbClcclxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MubW9kZWwgPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoJ2g0JywgeyB0ZXh0OiAnRGVlcFNlZWsnIH0pO1xyXG5cclxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnRGVlcFNlZWsgQVBJIEtleScpXHJcblx0XHRcdC5zZXREZXNjKCdcdTc1MjhcdTRFOEVcdThDMDNcdTc1MjggRGVlcFNlZWsgXHU2QTIxXHU1NzhCXHU2NzBEXHU1MkExJylcclxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+XHJcblx0XHRcdFx0dGV4dFxyXG5cdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCdcdThCRjdcdThGOTNcdTUxNjVcdTRGNjBcdTc2ODQgRGVlcFNlZWsgQVBJIEtleScpXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcFNlZWtBcGlLZXkpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBTZWVrQXBpS2V5ID0gdmFsdWUudHJpbSgpO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcblx0XHRcdC5zZXROYW1lKCdEZWVwU2VlayBGSU0gXHU2QTIxXHU1NzhCJylcclxuXHRcdFx0LnNldERlc2MoJ1x1NUY1M1x1NTI0RFx1RkYxQWRlZXBzZWVrLXY0LXBybycpO1xyXG5cdH1cclxufSIsICJ7XG4gIFwicXdlbjMuNy1tYXhcIjogXCJxd2VuMy43LW1heFwiLFxuICBcInF3ZW4zLjYtbWF4XCI6IFwicXdlbjMuNi1tYXhcIixcbiAgXCJxd2VuMy1tYXhcIjogXCJxd2VuMy1tYXhcIixcbiAgXCJxd2VuLW1heFwiOiBcInF3ZW4tbWF4XCIsXG4gIFwicXdlbjMuNy1wbHVzXCI6IFwicXdlbjMuNy1wbHVzXCIsXG4gIFwicXdlbjMuNi1wbHVzXCI6IFwicXdlbjMuNi1wbHVzXCIsXG4gIFwicXdlbjMuNS1wbHVzXCI6IFwicXdlbjMuNS1wbHVzXCIsXG4gIFwicXdlbi1wbHVzXCI6IFwicXdlbi1wbHVzXCIsXG4gIFwicXdlbjMuNi1mbGFzaFwiOiBcInF3ZW4zLjYtZmxhc2hcIixcbiAgXCJxd2VuMy41LWZsYXNoXCI6IFwicXdlbjMuNS1mbGFzaFwiLFxuICBcInF3ZW4tZmxhc2hcIjogXCJxd2VuLWZsYXNoXCIsXG4gIFwicXdlbjMtY29kZXJcIjogXCJxd2VuMy1jb2RlclwiLFxuICBcInF3ZW4yLjUtY29kZXJcIjogXCJxd2VuMi41LWNvZGVyXCIsXG4gIFwicXdlbi1jb2RlclwiOiBcInF3ZW4tY29kZXJcIixcbiAgXCJxd2VuLXR1cmJvXCI6IFwicXdlbi10dXJib1wiLFxuICBcInF3ZW4zLjZcIjogXCJxd2VuMy42XCIsXG4gIFwicXdlbjMuNVwiOiBcInF3ZW4zLjVcIixcbiAgXCJxd2VuM1wiOiBcInF3ZW4zXCIsXG4gIFwicXdlbjIuNVwiOiBcInF3ZW4yLjVcIixcbiAgXCJxd2VuLW1hdGhcIjogXCJxd2VuLW1hdGhcIixcbiAgXCJxd2VuMi41LW1hdGhcIjogXCJxd2VuMi41LW1hdGhcIixcbiAgXCJzaWxpY29uZmxvdy9kZWVwc2Vlay12My4yXCI6IFwic2lsaWNvbmZsb3cvZGVlcHNlZWstdjMuMlwiLFxuICBcInNpbGljb25mbG93L2RlZXBzZWVrLXYzLjEtdGVybWludXNcIjogXCJzaWxpY29uZmxvdy9kZWVwc2Vlay12My4xLXRlcm1pbnVzXCIsXG4gIFwic2lsaWNvbmZsb3cvZGVlcHNlZWstdjMtMDMyNFwiOiBcInNpbGljb25mbG93L2RlZXBzZWVrLXYzLTAzMjRcIixcbiAgXCJ2YW5jaGluL2RlZXBzZWVrLXYzLjItdGhpbmtcIjogXCJ2YW5jaGluL2RlZXBzZWVrLXYzLjItdGhpbmtcIixcbiAgXCJ2YW5jaGluL2RlZXBzZWVrLXIxXCI6IFwidmFuY2hpbi9kZWVwc2Vlay1yMVwiLFxuICBcInZhbmNoaW4vZGVlcHNlZWstdjNcIjogXCJ2YW5jaGluL2RlZXBzZWVrLXYzXCIsXG4gIFwicXdlbjMtdmwtcGx1c1wiOiBcInF3ZW4zLXZsLXBsdXNcIixcbiAgXCJxd2VuMy12bC1mbGFzaFwiOiBcInF3ZW4zLXZsLWZsYXNoXCIsXG4gIFwicXdlbi12bC1tYXhcIjogXCJxd2VuLXZsLW1heFwiLFxuICBcInF3ZW4tdmwtcGx1c1wiOiBcInF3ZW4tdmwtcGx1c1wiLFxuICBcInF3ZW4zLXZsXCI6IFwicXdlbjMtdmxcIixcbiAgXCJraW1pL2tpbWktazIuNlwiOiBcImtpbWkva2ltaS1rMi42XCIsXG4gIFwia2ltaS9raW1pLWsyLjVcIjogXCJraW1pL2tpbWktazIuNVwiXG59Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBQXVGOzs7QUNBdkY7QUFBQSxFQUNFLGVBQWU7QUFBQSxFQUNmLGVBQWU7QUFBQSxFQUNmLGFBQWE7QUFBQSxFQUNiLFlBQVk7QUFBQSxFQUNaLGdCQUFnQjtBQUFBLEVBQ2hCLGdCQUFnQjtBQUFBLEVBQ2hCLGdCQUFnQjtBQUFBLEVBQ2hCLGFBQWE7QUFBQSxFQUNiLGlCQUFpQjtBQUFBLEVBQ2pCLGlCQUFpQjtBQUFBLEVBQ2pCLGNBQWM7QUFBQSxFQUNkLGVBQWU7QUFBQSxFQUNmLGlCQUFpQjtBQUFBLEVBQ2pCLGNBQWM7QUFBQSxFQUNkLGNBQWM7QUFBQSxFQUNkLFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFBQSxFQUNYLE9BQVM7QUFBQSxFQUNULFdBQVc7QUFBQSxFQUNYLGFBQWE7QUFBQSxFQUNiLGdCQUFnQjtBQUFBLEVBQ2hCLDZC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
