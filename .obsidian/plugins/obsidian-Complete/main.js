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
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: true }
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
            content: "\u8BF7\u6839\u636E\u7528\u6237\u63D0\u4F9B\u7684\u6587\u672C\u524D\u7F00\uFF0C\u81EA\u7136\u5730\u7EED\u5199\u540E\u7EED\u5185\u5BB9\u3002\u4FDD\u6301\u98CE\u683C\u4E00\u81F4\uFF0C\u76F4\u63A5\u7EED\u5199\uFF0C\u4E0D\u8981\u91CD\u590D\u524D\u7F00\u5185\u5BB9\uFF0C\u4E0D\u8981\u6DFB\u52A0\u989D\u5916\u8BF4\u660E\u3002\u8F93\u51FA\u540E\u7F00\u5185\u5BB9\u8981\u4E0D\u8D85\u8FC7\u524D\u7F00\u5185\u5BB9\u76842\u500D\u3002"
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
      if (useFim) {
        const reader = response.body?.getReader();
        if (!reader) {
          new import_obsidian.Notice("\u65E0\u6CD5\u8BFB\u53D6\u6D41\u5F0F\u54CD\u5E94");
          return;
        }
        const decoder = new TextDecoder();
        let fullContent = "";
        let startPos = null;
        let endPos = null;
        let buffer = "";
        const cm = editor.cm;
        while (true) {
          const { done, value } = await reader.read();
          if (done)
            break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:"))
              continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]")
              continue;
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
                const contentLines = fullContent.split("\n");
                endPos = {
                  line: startPos.line + contentLines.length - 1,
                  ch: contentLines.length === 1 ? startPos.ch + contentLines[0].length : contentLines[contentLines.length - 1].length
                };
                const from = cm.state.doc.line(startPos.line + 1).from + startPos.ch;
                const to = from + fullContent.length;
                if (from !== to) {
                  cm.dispatch({ effects: setHighlight.of({ from, to }) });
                }
              }
            } catch {
            }
          }
        }
        if (fullContent) {
          this.insertedRange = { from: startPos, to: endPos };
          this.activeEditor = editor;
          this.activeCM = cm;
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
          new import_obsidian.Notice("\u8865\u5168\u5931\u8D25\uFF1AFIM \u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u5185\u5BB9\n\u8BE5\u6A21\u5F0F\u5BF9\u81EA\u7136\u8BED\u8A00\u3001Markdown \u7684\u8865\u5168\u6548\u679C\u4E0D\u4F73\uFF08DeepSeek FIM \u4E3B\u8981\u9488\u5BF9\u4EE3\u7801\u573A\u666F\u8BBE\u8BA1\uFF09");
        }
      } else {
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
          new import_obsidian.Notice("\u8865\u5168\u5931\u8D25\uFF1A\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u5185\u5BB9\uFF0C\u8BD5\u8BD5\u6362 qwen-plus \u6216 qwen3.7-max");
        }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJtb2RlbHMuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBBcHAsIFNldHRpbmcsIE5vdGljZSwgRWRpdG9yLCBFZGl0b3JQb3NpdGlvbiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCBNT0RFTFMgZnJvbSAnLi9tb2RlbHMuanNvbic7XG5pbXBvcnQgeyBEZWNvcmF0aW9uLCBEZWNvcmF0aW9uU2V0LCBFZGl0b3JWaWV3IH0gZnJvbSAnQGNvZGVtaXJyb3Ivdmlldyc7XG5pbXBvcnQgeyBTdGF0ZUZpZWxkLCBTdGF0ZUVmZmVjdCB9IGZyb20gJ0Bjb2RlbWlycm9yL3N0YXRlJztcblxuY29uc3QgTUFYX1BSRUZJWF9MRU5HVEggPSAxMDAwO1xuY29uc3QgTUFYX0ZJTV9UT0tFTlMgPSA0MDk2O1xuXG4vLyBcdTlBRDhcdTRFQUVcdTg4QzVcdTk5NzBcdTU2NjhcdUZGMUFTdGF0ZUVmZmVjdCBcdTc1MjhcdTRFOEVcdThCQkVcdTdGNkUvXHU2RTA1XHU5NjY0XHU4ODY1XHU1MTY4XHU5QUQ4XHU0RUFFXHU4MzAzXHU1NkY0XG5jb25zdCBzZXRIaWdobGlnaHQgPSBTdGF0ZUVmZmVjdC5kZWZpbmU8eyBmcm9tOiBudW1iZXI7IHRvOiBudW1iZXIgfSB8IG51bGw+KCk7XG5cbmNvbnN0IGhpZ2hsaWdodEZpZWxkID0gU3RhdGVGaWVsZC5kZWZpbmU8RGVjb3JhdGlvblNldD4oe1xuXHRjcmVhdGUoKSB7XG5cdFx0cmV0dXJuIERlY29yYXRpb24ubm9uZTtcblx0fSxcblx0dXBkYXRlKGRlY29yYXRpb25zLCB0cikge1xuXHRcdGZvciAoY29uc3QgZSBvZiB0ci5lZmZlY3RzKSB7XG5cdFx0XHRpZiAoZS5pcyhzZXRIaWdobGlnaHQpKSB7XG5cdFx0XHRcdGlmIChlLnZhbHVlID09PSBudWxsKSByZXR1cm4gRGVjb3JhdGlvbi5ub25lO1xuXHRcdFx0XHRyZXR1cm4gRGVjb3JhdGlvbi5zZXQoW1xuXHRcdFx0XHRcdERlY29yYXRpb24ubWFyayh7XG5cdFx0XHRcdFx0XHRhdHRyaWJ1dGVzOiB7XG5cdFx0XHRcdFx0XHRcdHN0eWxlOiAnYmFja2dyb3VuZC1jb2xvcjogIzczQUU1MjsgY29sb3I6ICNGQkYxRDc7Jyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSkucmFuZ2UoZS52YWx1ZS5mcm9tLCBlLnZhbHVlLnRvKSxcblx0XHRcdFx0XSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBkZWNvcmF0aW9ucztcblx0fSxcblx0cHJvdmlkZTogKGYpID0+IEVkaXRvclZpZXcuZGVjb3JhdGlvbnMuZnJvbShmKSxcbn0pO1xuXG5pbnRlcmZhY2UgQ29tcGxldGVTZXR0aW5ncyB7XG5cdGFwaUtleTogc3RyaW5nO1xuXHR3b3Jrc3BhY2VJZDogc3RyaW5nO1xuXHRtb2RlbDogc3RyaW5nO1xuXHRkZWVwU2Vla0FwaUtleTogc3RyaW5nO1xufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBDb21wbGV0ZVNldHRpbmdzID0ge1xuXHRhcGlLZXk6ICcnLFxuXHR3b3Jrc3BhY2VJZDogJycsXG5cdG1vZGVsOiAncXdlbjMuNy1wbHVzJyxcblx0ZGVlcFNlZWtBcGlLZXk6ICcnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ29tcGxldGVQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHRzZXR0aW5nczogQ29tcGxldGVTZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XG5cdHByaXZhdGUgYWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSB0aW1lZE91dCA9IGZhbHNlO1xuXHRwcml2YXRlIGtleUhhbmRsZXI6ICgoZTogS2V5Ym9hcmRFdmVudCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBhY3RpdmVDTTogRWRpdG9yVmlldyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGluc2VydGVkUmFuZ2U6IHsgZnJvbTogRWRpdG9yUG9zaXRpb247IHRvOiBFZGl0b3JQb3NpdGlvbiB9IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgYWN0aXZlRWRpdG9yOiBFZGl0b3IgfCBudWxsID0gbnVsbDtcblxuXHRhc3luYyBvbmxvYWQoKSB7XG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuXHRcdC8vIFx1NkNFOFx1NTE4Q1x1OUFEOFx1NEVBRVx1ODhDNVx1OTk3MFx1NTY2OFx1NjI2OVx1NUM1NVxuXHRcdHRoaXMucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oaGlnaGxpZ2h0RmllbGQpO1xuXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiAndHJpZ2dlci1jb21wbGV0ZScsXG5cdFx0XHRuYW1lOiAnXHU4OUU2XHU1M0QxIEFJIFx1ODg2NVx1NTE2OCcsXG5cdFx0XHRlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XG5cdFx0XHRcdHRoaXMudHJpZ2dlckNvbXBsZXRpb24oZWRpdG9yKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6ICd0cmlnZ2VyLWZpbS1jb21wbGV0ZScsXG5cdFx0XHRuYW1lOiAnXHU4OUU2XHU1M0QxIEFJIEZJTSBcdTg4NjVcdTUxNjgnLFxuXHRcdFx0ZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4ge1xuXHRcdFx0XHR0aGlzLnRyaWdnZXJDb21wbGV0aW9uKGVkaXRvciwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBDb21wbGV0ZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblx0fVxuXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB0cmlnZ2VyQ29tcGxldGlvbihlZGl0b3I6IEVkaXRvciwgZm9yY2VGaW0gPSBmYWxzZSkge1xuXHRcdGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcblxuXHRcdC8vIFx1NTE0OFx1NjhDMFx1NjdFNVx1NTE0OVx1NjgwN1x1NTI0RCAxMCBcdTg4NENcdTUxODVcdTY2MkZcdTU0MjZcdTY3MDlcdTVCOUVcdThEMjhcdTUxODVcdTVCQjlcblx0XHRjb25zdCB0ZW5MaW5lc1N0YXJ0TGluZSA9IE1hdGgubWF4KDAsIGN1cnNvci5saW5lIC0gOSk7XG5cdFx0Y29uc3QgdGV4dEJlZm9yZVRlbkxpbmVzID0gZWRpdG9yLmdldFJhbmdlKFxuXHRcdFx0eyBsaW5lOiB0ZW5MaW5lc1N0YXJ0TGluZSwgY2g6IDAgfSxcblx0XHRcdGN1cnNvclxuXHRcdCk7XG5cdFx0aWYgKCF0ZXh0QmVmb3JlVGVuTGluZXMudHJpbSgpKSB7XG5cdFx0XHRuZXcgTm90aWNlKCdcdTUxNDlcdTY4MDdcdTUyNEQgMTAgXHU4ODRDXHU1MTg1XHU2Q0ExXHU2NzA5XHU2NTg3XHU2NzJDXHU1MTg1XHU1QkI5XHVGRjBDXHU2NUUwXHU2Q0Q1XHU4ODY1XHU1MTY4Jyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9jRW5kID0gZWRpdG9yLmxhc3RMaW5lKCkgKyAxO1xuXG5cdFx0Ly8gRklNIFx1NEUwQVx1NEUwQlx1NjU4N1x1RkYxQVx1NTE0OVx1NjgwN1x1OTY0NFx1OEZEMVx1NTQwNCA1IFx1ODg0Q1xuXHRcdGNvbnN0IGZpbUNvbnRleHRTdGFydCA9IE1hdGgubWF4KDAsIGN1cnNvci5saW5lIC0gNCk7XG5cdFx0Y29uc3QgZmltQ29udGV4dEVuZCA9IE1hdGgubWluKGRvY0VuZCwgY3Vyc29yLmxpbmUgKyA2KTtcblx0XHRjb25zdCBmaW1QcmVmaXggPSBlZGl0b3IuZ2V0UmFuZ2UoXG5cdFx0XHR7IGxpbmU6IGZpbUNvbnRleHRTdGFydCwgY2g6IDAgfSxcblx0XHRcdGN1cnNvclxuXHRcdCk7XG5cdFx0Y29uc3QgZmltU3VmZml4ID0gZWRpdG9yLmdldFJhbmdlKFxuXHRcdFx0Y3Vyc29yLFxuXHRcdFx0eyBsaW5lOiBmaW1Db250ZXh0RW5kIC0gMSwgY2g6IGVkaXRvci5nZXRMaW5lKGZpbUNvbnRleHRFbmQgLSAxKS5sZW5ndGggfVxuXHRcdCkudHJpbSgpO1xuXG5cdFx0aWYgKGZvcmNlRmltICYmICFmaW1TdWZmaXgubGVuZ3RoKSB7XG5cdFx0XHRuZXcgTm90aWNlKCdGSU0gXHU4ODY1XHU1MTY4XHU5NzAwXHU4OTgxXHU1MTQ5XHU2ODA3XHU1NDBFXHU5NzYyXHU2NzA5XHU2NTg3XHU2NzJDXHU1MTg1XHU1QkI5Jyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHVzZUZpbSA9IGZpbVN1ZmZpeC5sZW5ndGggPiAwO1xuXG5cdFx0Ly8gXHU2OEMwXHU2N0U1XHU5MTREXHU3RjZFXG5cdFx0aWYgKHVzZUZpbSkge1xuXHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLmRlZXBTZWVrQXBpS2V5KSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoJ1x1OEJGN1x1NTE0OFx1NTcyOFx1OEJCRVx1N0Y2RVx1NEUyRFx1OTE0RFx1N0Y2RSBEZWVwU2VlayBBUEkgS2V5Jyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFwaUtleSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKCdcdThCRjdcdTUxNDhcdTU3MjhcdThCQkVcdTdGNkVcdTRFMkRcdTkxNERcdTdGNkVcdTc2N0VcdTcwQkMgQVBJIEtleScpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3Mud29ya3NwYWNlSWQpIHtcblx0XHRcdFx0bmV3IE5vdGljZSgnXHU4QkY3XHU1MTQ4XHU1NzI4XHU4QkJFXHU3RjZFXHU0RTJEXHU5MTREXHU3RjZFXHU3NjdFXHU3MEJDXHU0RTFBXHU1MkExXHU3QTdBXHU5NUY0IElEJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBcdTZFMDVcdTk2NjRcdTRFMEFcdTRFMDBcdTZCMjFcdTc2ODRcdTg4NjVcdTUxNjhcdTcyQjZcdTYwMDFcblx0XHR0aGlzLmNsZWFyQ29tcGxldGlvbigpO1xuXG5cdFx0bGV0IHVybDogc3RyaW5nO1xuXHRcdGxldCBib2R5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblxuXHRcdGlmICh1c2VGaW0pIHtcblx0XHRcdHVybCA9ICdodHRwczovL2FwaS5kZWVwc2Vlay5jb20vYmV0YS9jb21wbGV0aW9ucyc7XG5cdFx0XHRib2R5ID0ge1xuXHRcdFx0XHRtb2RlbDogJ2RlZXBzZWVrLXY0LXBybycsXG5cdFx0XHRcdHByb21wdDogZmltUHJlZml4LFxuXHRcdFx0XHRzdWZmaXg6IGZpbVN1ZmZpeCxcblx0XHRcdFx0bWF4X3Rva2VuczogTUFYX0ZJTV9UT0tFTlMsXG5cdFx0XHRcdHRlbXBlcmF0dXJlOiAwLjcsXG5cdFx0XHRcdHN0cmVhbTogdHJ1ZSxcblx0XHRcdFx0c3RyZWFtX29wdGlvbnM6IHsgaW5jbHVkZV91c2FnZTogdHJ1ZSB9LFxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdGV4dEJlZm9yZSA9IGVkaXRvci5nZXRSYW5nZSh7IGxpbmU6IDAsIGNoOiAwIH0sIGN1cnNvcik7XG5cdFx0XHRjb25zdCBwcmVmaXggPVxuXHRcdFx0XHR0ZXh0QmVmb3JlLmxlbmd0aCA+IE1BWF9QUkVGSVhfTEVOR1RIXG5cdFx0XHRcdFx0PyB0ZXh0QmVmb3JlLnNsaWNlKC1NQVhfUFJFRklYX0xFTkdUSClcblx0XHRcdFx0XHQ6IHRleHRCZWZvcmU7XG5cdFx0XHR1cmwgPSBgaHR0cHM6Ly8ke3RoaXMuc2V0dGluZ3Mud29ya3NwYWNlSWR9LmNuLWJlaWppbmcubWFhcy5hbGl5dW5jcy5jb20vY29tcGF0aWJsZS1tb2RlL3YxL2NoYXQvY29tcGxldGlvbnNgO1xuXHRcdFx0Ym9keSA9IHtcblx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3MubW9kZWwsXG5cdFx0XHRcdG1lc3NhZ2VzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0cm9sZTogJ3VzZXInLFxuXHRcdFx0XHRcdFx0Y29udGVudDpcblx0XHRcdFx0XHRcdFx0J1x1OEJGN1x1NjgzOVx1NjM2RVx1NzUyOFx1NjIzN1x1NjNEMFx1NEY5Qlx1NzY4NFx1NjU4N1x1NjcyQ1x1NTI0RFx1N0YwMFx1RkYwQ1x1ODFFQVx1NzEzNlx1NTczMFx1N0VFRFx1NTE5OVx1NTQwRVx1N0VFRFx1NTE4NVx1NUJCOVx1MzAwMlx1NEZERFx1NjMwMVx1OThDRVx1NjgzQ1x1NEUwMFx1ODFGNFx1RkYwQ1x1NzZGNFx1NjNBNVx1N0VFRFx1NTE5OVx1RkYwQ1x1NEUwRFx1ODk4MVx1OTFDRFx1NTkwRFx1NTI0RFx1N0YwMFx1NTE4NVx1NUJCOVx1RkYwQ1x1NEUwRFx1ODk4MVx1NkRGQlx1NTJBMFx1OTg5RFx1NTkxNlx1OEJGNFx1NjYwRVx1MzAwMlx1OEY5M1x1NTFGQVx1NTQwRVx1N0YwMFx1NTE4NVx1NUJCOVx1ODk4MVx1NEUwRFx1OEQ4NVx1OEZDN1x1NTI0RFx1N0YwMFx1NTE4NVx1NUJCOVx1NzY4NDJcdTUwMERcdTMwMDInLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0cm9sZTogJ2Fzc2lzdGFudCcsXG5cdFx0XHRcdFx0XHRjb250ZW50OiBwcmVmaXgsXG5cdFx0XHRcdFx0XHRwYXJ0aWFsOiB0cnVlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuXHRcdGNvbnN0IG5vdGljZSA9IG5ldyBOb3RpY2UodXNlRmltID8gJ0FJIFx1NkI2M1x1NTcyOCBGSU0gXHU4ODY1XHU1MTY4Li4uJyA6ICdBSSBcdTZCNjNcdTU3MjhcdTg4NjVcdTUxNjguLi4nLCAwKTtcblxuXHRcdC8vIDIgXHU1MjA2XHU5NDlGXHU4RDg1XHU2NUY2XG5cdFx0Y29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLnRpbWVkT3V0ID0gdHJ1ZTtcblx0XHRcdHRoaXMuYWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuXHRcdH0sIDIgKiA2MCAqIDEwMDApO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0XHRBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dXNlRmltID8gdGhpcy5zZXR0aW5ncy5kZWVwU2Vla0FwaUtleSA6IHRoaXMuc2V0dGluZ3MuYXBpS2V5fWAsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuXHRcdFx0XHRzaWduYWw6IHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbCxcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcblx0XHRcdFx0bmV3IE5vdGljZShgQVBJIFx1OEJGN1x1NkM0Mlx1NTkzMVx1OEQyNSAoJHtyZXNwb25zZS5zdGF0dXN9KTogJHtlcnJvclRleHR9YCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHVzZUZpbSkge1xuXHRcdFx0XHQvLyBEZWVwU2VlayBGSU0gXHU2RDQxXHU1RjBGIFNTRSBcdThGOTNcdTUxRkFcblx0XHRcdFx0Y29uc3QgcmVhZGVyID0gcmVzcG9uc2UuYm9keT8uZ2V0UmVhZGVyKCk7XG5cdFx0XHRcdGlmICghcmVhZGVyKSB7XG5cdFx0XHRcdFx0bmV3IE5vdGljZSgnXHU2NUUwXHU2Q0Q1XHU4QkZCXHU1M0Q2XHU2RDQxXHU1RjBGXHU1NENEXHU1RTk0Jyk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuXHRcdFx0XHRsZXQgZnVsbENvbnRlbnQgPSAnJztcblx0XHRcdFx0bGV0IHN0YXJ0UG9zOiBFZGl0b3JQb3NpdGlvbiB8IG51bGwgPSBudWxsO1xuXHRcdFx0XHRsZXQgZW5kUG9zOiBFZGl0b3JQb3NpdGlvbiB8IG51bGwgPSBudWxsO1xuXHRcdFx0XHRsZXQgYnVmZmVyID0gJyc7XG5cblx0XHRcdFx0Y29uc3QgY20gPSAoZWRpdG9yIGFzIGFueSkuY20gYXMgRWRpdG9yVmlldztcblxuXHRcdFx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0XHRcdGNvbnN0IHsgZG9uZSwgdmFsdWUgfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG5cdFx0XHRcdFx0aWYgKGRvbmUpIGJyZWFrO1xuXG5cdFx0XHRcdFx0YnVmZmVyICs9IGRlY29kZXIuZGVjb2RlKHZhbHVlLCB7IHN0cmVhbTogdHJ1ZSB9KTtcblx0XHRcdFx0XHRjb25zdCBsaW5lcyA9IGJ1ZmZlci5zcGxpdCgnXFxuJyk7XG5cdFx0XHRcdFx0YnVmZmVyID0gbGluZXMucG9wKCkgfHwgJyc7XG5cblx0XHRcdFx0XHRmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRyaW1tZWQgPSBsaW5lLnRyaW0oKTtcblx0XHRcdFx0XHRcdGlmICghdHJpbW1lZCB8fCAhdHJpbW1lZC5zdGFydHNXaXRoKCdkYXRhOicpKSBjb250aW51ZTtcblx0XHRcdFx0XHRcdGNvbnN0IGRhdGFTdHIgPSB0cmltbWVkLnNsaWNlKDUpLnRyaW0oKTsgLy8gXHU1M0JCXHU2Mzg5IFwiZGF0YTpcIiBcdTUyNERcdTdGMDBcblx0XHRcdFx0XHRcdGlmIChkYXRhU3RyID09PSAnW0RPTkVdJykgY29udGludWU7XG5cblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNodW5rID0gSlNPTi5wYXJzZShkYXRhU3RyKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdGV4dCA9IGNodW5rLmNob2ljZXM/LlswXT8udGV4dDtcblx0XHRcdFx0XHRcdFx0aWYgKHRleHQpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoIXN0YXJ0UG9zKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRzdGFydFBvcyA9IGVkaXRvci5nZXRDdXJzb3IoKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0ZnVsbENvbnRlbnQgKz0gdGV4dDtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBjdXJyZW50RW5kID0gZW5kUG9zIHx8IHN0YXJ0UG9zO1xuXHRcdFx0XHRcdFx0XHRcdGVkaXRvci5yZXBsYWNlUmFuZ2UoZnVsbENvbnRlbnQsIHN0YXJ0UG9zLCBjdXJyZW50RW5kKTtcblxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGNvbnRlbnRMaW5lcyA9IGZ1bGxDb250ZW50LnNwbGl0KCdcXG4nKTtcblx0XHRcdFx0XHRcdFx0XHRlbmRQb3MgPSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRsaW5lOiBzdGFydFBvcy5saW5lICsgY29udGVudExpbmVzLmxlbmd0aCAtIDEsXG5cdFx0XHRcdFx0XHRcdFx0XHRjaDpcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudExpbmVzLmxlbmd0aCA9PT0gMVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gc3RhcnRQb3MuY2ggKyBjb250ZW50TGluZXNbMF0ubGVuZ3RoXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0OiBjb250ZW50TGluZXNbY29udGVudExpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aCxcblx0XHRcdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRcdFx0Ly8gXHU2NkY0XHU2NUIwXHU5QUQ4XHU0RUFFXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZnJvbSA9XG5cdFx0XHRcdFx0XHRcdFx0XHRjbS5zdGF0ZS5kb2MubGluZShzdGFydFBvcy5saW5lICsgMSkuZnJvbSArIHN0YXJ0UG9zLmNoO1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHRvID0gZnJvbSArIGZ1bGxDb250ZW50Lmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZnJvbSAhPT0gdG8pIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNtLmRpc3BhdGNoKHsgZWZmZWN0czogc2V0SGlnaGxpZ2h0Lm9mKHsgZnJvbSwgdG8gfSkgfSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHRcdFx0Ly8gXHU4REYzXHU4RkM3XHU4OUUzXHU2NzkwXHU1OTMxXHU4RDI1XHU3Njg0IEpTT04gXHU4ODRDXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGZ1bGxDb250ZW50KSB7XG5cdFx0XHRcdFx0dGhpcy5pbnNlcnRlZFJhbmdlID0geyBmcm9tOiBzdGFydFBvcyEsIHRvOiBlbmRQb3MhIH07XG5cdFx0XHRcdFx0dGhpcy5hY3RpdmVFZGl0b3IgPSBlZGl0b3I7XG5cdFx0XHRcdFx0dGhpcy5hY3RpdmVDTSA9IGNtO1xuXG5cdFx0XHRcdFx0Y29uc3QgY21Eb20gPSBjbS5kb207XG5cdFx0XHRcdFx0dGhpcy5rZXlIYW5kbGVyID0gKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdFx0XHRcdGlmIChlLmtleSA9PT0gJ1RhYicpIHtcblx0XHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmNsZWFyQ29tcGxldGlvbigpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcblx0XHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVuZG9Db21wbGV0aW9uKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRjbURvbS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5rZXlIYW5kbGVyLCB0cnVlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXcgTm90aWNlKCdcdTg4NjVcdTUxNjhcdTU5MzFcdThEMjVcdUZGMUFGSU0gXHU2QTIxXHU1NzhCXHU4RkQ0XHU1NkRFXHU0RTg2XHU3QTdBXHU1MTg1XHU1QkI5XFxuXHU4QkU1XHU2QTIxXHU1RjBGXHU1QkY5XHU4MUVBXHU3MTM2XHU4QkVEXHU4QTAwXHUzMDAxTWFya2Rvd24gXHU3Njg0XHU4ODY1XHU1MTY4XHU2NTQ4XHU2NzlDXHU0RTBEXHU0RjczXHVGRjA4RGVlcFNlZWsgRklNIFx1NEUzQlx1ODk4MVx1OTQ4OFx1NUJGOVx1NEVFM1x1NzgwMVx1NTczQVx1NjY2Rlx1OEJCRVx1OEJBMVx1RkYwOScpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdFx0XHRjb25zdCBjb250ZW50ID0gZGF0YS5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnQ7XG5cdFx0XHRcdGlmIChjb250ZW50KSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnRQb3MgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XG5cdFx0XHRcdFx0ZWRpdG9yLnJlcGxhY2VSYW5nZShjb250ZW50LCBzdGFydFBvcyk7XG5cblx0XHRcdFx0XHQvLyBcdTY4MzlcdTYzNkVcdTUxODVcdTVCQjlcdTg4NENcdTY1NzBcdThCQTFcdTdCOTdcdTdFRDNcdTY3NUZcdTRGNERcdTdGNkVcblx0XHRcdFx0XHRjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuXHRcdFx0XHRcdGNvbnN0IGVuZFBvczogRWRpdG9yUG9zaXRpb24gPSB7XG5cdFx0XHRcdFx0XHRsaW5lOiBzdGFydFBvcy5saW5lICsgbGluZXMubGVuZ3RoIC0gMSxcblx0XHRcdFx0XHRcdGNoOlxuXHRcdFx0XHRcdFx0XHRsaW5lcy5sZW5ndGggPT09IDFcblx0XHRcdFx0XHRcdFx0XHQ/IHN0YXJ0UG9zLmNoICsgbGluZXNbMF0ubGVuZ3RoXG5cdFx0XHRcdFx0XHRcdFx0OiBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS5sZW5ndGgsXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdC8vIFx1OEJCMFx1NUY1NVx1NjNEMlx1NTE2NVx1ODMwM1x1NTZGNFx1RkYwQ1x1NzUyOFx1NEU4RSBFc2MgXHU2NEE0XHU5NTAwXG5cdFx0XHRcdFx0dGhpcy5pbnNlcnRlZFJhbmdlID0geyBmcm9tOiBzdGFydFBvcywgdG86IGVuZFBvcyB9O1xuXHRcdFx0XHRcdHRoaXMuYWN0aXZlRWRpdG9yID0gZWRpdG9yO1xuXG5cdFx0XHRcdFx0Ly8gXHU4M0I3XHU1M0Q2IENvZGVNaXJyb3IgRWRpdG9yVmlldyBcdTVCOUVcdTRGOEJcblx0XHRcdFx0XHRjb25zdCBjbSA9IChlZGl0b3IgYXMgYW55KS5jbSBhcyBFZGl0b3JWaWV3O1xuXHRcdFx0XHRcdHRoaXMuYWN0aXZlQ00gPSBjbTtcblxuXHRcdFx0XHRcdC8vIFx1NUMwNlx1ODg0Q1x1NTIxN1x1NEY0RFx1N0Y2RVx1OEY2Q1x1NEUzQVx1NjU4N1x1Njg2M1x1NTA0Rlx1NzlGQlx1OTFDRlxuXHRcdFx0XHRcdGNvbnN0IGZyb20gPVxuXHRcdFx0XHRcdFx0Y20uc3RhdGUuZG9jLmxpbmUoc3RhcnRQb3MubGluZSArIDEpLmZyb20gKyBzdGFydFBvcy5jaDtcblx0XHRcdFx0XHRjb25zdCB0byA9XG5cdFx0XHRcdFx0XHRjbS5zdGF0ZS5kb2MubGluZShlbmRQb3MubGluZSArIDEpLmZyb20gKyBlbmRQb3MuY2g7XG5cblx0XHRcdFx0XHRpZiAoZnJvbSA9PT0gdG8pIHJldHVybjsgLy8gXHU3QTdBXHU1MTg1XHU1QkI5XHU4REYzXHU4RkM3XG5cblx0XHRcdFx0XHQvLyBcdTVFOTRcdTc1MjhcdTlBRDhcdTRFQUVcblx0XHRcdFx0XHRjbS5kaXNwYXRjaCh7IGVmZmVjdHM6IHNldEhpZ2hsaWdodC5vZih7IGZyb20sIHRvIH0pIH0pO1xuXG5cdFx0XHRcdFx0Ly8gXHU3NkQxXHU1NDJDIFRhYiBcdTUzRDZcdTZEODhcdTlBRDhcdTRFQUUgLyBFc2MgXHU2NEE0XHU5NTAwXHU4ODY1XHU1MTY4XHVGRjA4XHU2MzAyXHU1NzI4IENNIERPTSBcdTRFMEFcdTkwN0ZcdTUxNERcdTg4QUIgT2JzaWRpYW4gXHU2MkU2XHU2MjJBXHVGRjA5XG5cdFx0XHRcdFx0Y29uc3QgY21Eb20gPSBjbS5kb207XG5cdFx0XHRcdFx0dGhpcy5rZXlIYW5kbGVyID0gKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdFx0XHRcdGlmIChlLmtleSA9PT0gJ1RhYicpIHtcblx0XHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmNsZWFyQ29tcGxldGlvbigpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcblx0XHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVuZG9Db21wbGV0aW9uKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRjbURvbS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5rZXlIYW5kbGVyLCB0cnVlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXcgTm90aWNlKCdcdTg4NjVcdTUxNjhcdTU5MzFcdThEMjVcdUZGMUFcdTZBMjFcdTU3OEJcdThGRDRcdTU2REVcdTRFODZcdTdBN0FcdTUxODVcdTVCQjlcdUZGMENcdThCRDVcdThCRDVcdTYzNjIgcXdlbi1wbHVzIFx1NjIxNiBxd2VuMy43LW1heCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZTogdW5rbm93bikge1xuXHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xuXHRcdFx0XHRuZXcgTm90aWNlKHRoaXMudGltZWRPdXQgPyAnXHU4ODY1XHU1MTY4XHU4RDg1XHU2NUY2XHVGRjFBQUkgXHU3NTFGXHU2MjEwXHU4RDg1XHU4RkM3IDIgXHU1MjA2XHU5NDlGXHVGRjBDXHU1REYyXHU1MDVDXHU2QjYyJyA6ICdcdTVERjJcdTUzRDZcdTZEODhcdTg4NjVcdTUxNjgnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXG5cdFx0XHRcdFx0YFx1ODg2NVx1NTE2OFx1NTFGQVx1OTUxOTogJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSl9YFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGltZW91dElkKTtcblx0XHRcdHRoaXMudGltZWRPdXQgPSBmYWxzZTtcblx0XHRcdHRoaXMuYWJvcnRDb250cm9sbGVyID0gbnVsbDtcblx0XHRcdG5vdGljZS5oaWRlKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIFx1NkUwNVx1OTY2NFx1ODg2NVx1NTE2OFx1OUFEOFx1NEVBRVx1NTQ4Q1x1NjMwOVx1OTUyRVx1NzZEMVx1NTQyQ1x1RkYwOFx1NTE4NVx1NUJCOVx1NEZERFx1NzU1OVx1RkYwOSAqL1xuXHRwcml2YXRlIGNsZWFyQ29tcGxldGlvbigpIHtcblx0XHR0aGlzLnJlbW92ZUtleUhhbmRsZXIoKTtcblx0XHRpZiAodGhpcy5hY3RpdmVDTSkge1xuXHRcdFx0dGhpcy5hY3RpdmVDTS5kaXNwYXRjaCh7IGVmZmVjdHM6IHNldEhpZ2hsaWdodC5vZihudWxsKSB9KTtcblx0XHRcdHRoaXMuYWN0aXZlQ00gPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBcdTY0QTRcdTk1MDBcdTg4NjVcdTUxNjhcdUZGMUFcdTUyMjBcdTk2NjRcdTYzRDJcdTUxNjVcdTUxODVcdTVCQjkgKyBcdTZFMDVcdTk2NjRcdTlBRDhcdTRFQUUgKi9cblx0cHJpdmF0ZSB1bmRvQ29tcGxldGlvbigpIHtcblx0XHRpZiAodGhpcy5hY3RpdmVFZGl0b3IgJiYgdGhpcy5pbnNlcnRlZFJhbmdlKSB7XG5cdFx0XHR0aGlzLmFjdGl2ZUVkaXRvci5yZXBsYWNlUmFuZ2UoXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHR0aGlzLmluc2VydGVkUmFuZ2UuZnJvbSxcblx0XHRcdFx0dGhpcy5pbnNlcnRlZFJhbmdlLnRvXG5cdFx0XHQpO1xuXHRcdH1cblx0XHR0aGlzLmNsZWFyQ29tcGxldGlvbigpO1xuXHRcdHRoaXMuaW5zZXJ0ZWRSYW5nZSA9IG51bGw7XG5cdFx0dGhpcy5hY3RpdmVFZGl0b3IgPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVLZXlIYW5kbGVyKCkge1xuXHRcdGlmICh0aGlzLmtleUhhbmRsZXIgJiYgdGhpcy5hY3RpdmVDTSkge1xuXHRcdFx0dGhpcy5hY3RpdmVDTS5kb20ucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMua2V5SGFuZGxlciwgdHJ1ZSk7XG5cdFx0XHR0aGlzLmtleUhhbmRsZXIgPSBudWxsO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBDb21wbGV0ZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcblx0cGx1Z2luOiBDb21wbGV0ZVBsdWdpbjtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBDb21wbGV0ZVBsdWdpbikge1xuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0fVxuXG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5lbXB0eSgpO1xuXG5cdFx0Y29uc3QgbW9kZWxzID0gTU9ERUxTIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG5cblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdDb21wbGV0ZSBcdTkxNERcdTdGNkUnIH0pO1xuXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoJ2g0JywgeyB0ZXh0OiAnXHU5NjNGXHU5MUNDXHU0RTkxJyB9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ1x1NzY3RVx1NzBCQ1x1NEUxQVx1NTJBMVx1N0E3QVx1OTVGNCBJRCcpXG5cdFx0XHQuc2V0RGVzYygnXHU5NjNGXHU5MUNDXHU0RTkxXHU3NjdFXHU3MEJDXHU1RTczXHU1M0YwXHU3Njg0XHU0RTFBXHU1MkExXHU3QTdBXHU5NUY0XHU2ODA3XHU4QkM2Jylcblx0XHRcdC5hZGRUZXh0KCh0ZXh0KSA9PlxuXHRcdFx0XHR0ZXh0XG5cdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCdcdThCRjdcdThGOTNcdTUxNjVcdTc2N0VcdTcwQkNcdTRFMUFcdTUyQTFcdTdBN0FcdTk1RjQgSUQnKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy53b3Jrc3BhY2VJZClcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy53b3Jrc3BhY2VJZCA9IHZhbHVlLnRyaW0oKTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHQpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnXHU5NjNGXHU5MUNDXHU0RTkxXHU3NjdFXHU3MEJDIEFQSSBLZXknKVxuXHRcdFx0LnNldERlc2MoJ1x1NzUyOFx1NEU4RVx1OEMwM1x1NzUyOFx1NzY3RVx1NzBCQ1x1NUU3M1x1NTNGMFx1NTkyN1x1NkEyMVx1NTc4Qlx1NjcwRFx1NTJBMScpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT5cblx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcignXHU4QkY3XHU4RjkzXHU1MTY1XHU0RjYwXHU3Njg0XHU3NjdFXHU3MEJDIEFQSSBLZXknKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlLZXkpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpS2V5ID0gdmFsdWUudHJpbSgpO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdCk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdcdTg4NjVcdTUxNjhcdTZBMjFcdTU3OEInKVxuXHRcdFx0LnNldERlc2MoJ1x1OTAwOVx1NjJFOVx1NzUyOFx1NEU4RVx1NjU4N1x1NjcyQ1x1ODg2NVx1NTE2OFx1NzY4NFx1NkEyMVx1NTc4QicpXG5cdFx0XHQuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG5cdFx0XHRcdGRyb3Bkb3duXG5cdFx0XHRcdFx0LmFkZE9wdGlvbnMobW9kZWxzKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb2RlbClcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb2RlbCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoNCcsIHsgdGV4dDogJ0RlZXBTZWVrJyB9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ0RlZXBTZWVrIEFQSSBLZXknKVxuXHRcdFx0LnNldERlc2MoJ1x1NzUyOFx1NEU4RVx1OEMwM1x1NzUyOCBEZWVwU2VlayBcdTZBMjFcdTU3OEJcdTY3MERcdTUyQTEnKVxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+XG5cdFx0XHRcdHRleHRcblx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ1x1OEJGN1x1OEY5M1x1NTE2NVx1NEY2MFx1NzY4NCBEZWVwU2VlayBBUEkgS2V5Jylcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcFNlZWtBcGlLZXkpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcFNlZWtBcGlLZXkgPSB2YWx1ZS50cmltKCk7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ0RlZXBTZWVrIEZJTSBcdTZBMjFcdTU3OEInKVxuXHRcdFx0LnNldERlc2MoJ1x1NUY1M1x1NTI0RFx1RkYxQWRlZXBzZWVrLXY0LXBybycpO1xuXHR9XG59IiwgIntcbiAgXCJxd2VuMy43LW1heFwiOiBcInF3ZW4zLjctbWF4XCIsXG4gIFwicXdlbjMuNi1tYXhcIjogXCJxd2VuMy42LW1heFwiLFxuICBcInF3ZW4zLW1heFwiOiBcInF3ZW4zLW1heFwiLFxuICBcInF3ZW4tbWF4XCI6IFwicXdlbi1tYXhcIixcbiAgXCJxd2VuMy43LXBsdXNcIjogXCJxd2VuMy43LXBsdXNcIixcbiAgXCJxd2VuMy42LXBsdXNcIjogXCJxd2VuMy42LXBsdXNcIixcbiAgXCJxd2VuMy41LXBsdXNcIjogXCJxd2VuMy41LXBsdXNcIixcbiAgXCJxd2VuLXBsdXNcIjogXCJxd2VuLXBsdXNcIixcbiAgXCJxd2VuMy42LWZsYXNoXCI6IFwicXdlbjMuNi1mbGFzaFwiLFxuICBcInF3ZW4zLjUtZmxhc2hcIjogXCJxd2VuMy41LWZsYXNoXCIsXG4gIFwicXdlbi1mbGFzaFwiOiBcInF3ZW4tZmxhc2hcIixcbiAgXCJxd2VuMy1jb2RlclwiOiBcInF3ZW4zLWNvZGVyXCIsXG4gIFwicXdlbjIuNS1jb2RlclwiOiBcInF3ZW4yLjUtY29kZXJcIixcbiAgXCJxd2VuLWNvZGVyXCI6IFwicXdlbi1jb2RlclwiLFxuICBcInF3ZW4tdHVyYm9cIjogXCJxd2VuLXR1cmJvXCIsXG4gIFwicXdlbjMuNlwiOiBcInF3ZW4zLjZcIixcbiAgXCJxd2VuMy41XCI6IFwicXdlbjMuNVwiLFxuICBcInF3ZW4zXCI6IFwicXdlbjNcIixcbiAgXCJxd2VuMi41XCI6IFwicXdlbjIuNVwiLFxuICBcInF3ZW4tbWF0aFwiOiBcInF3ZW4tbWF0aFwiLFxuICBcInF3ZW4yLjUtbWF0aFwiOiBcInF3ZW4yLjUtbWF0aFwiLFxuICBcInNpbGljb25mbG93L2RlZXBzZWVrLXYzLjJcIjogXCJzaWxpY29uZmxvdy9kZWVwc2Vlay12My4yXCIsXG4gIFwic2lsaWNvbmZsb3cvZGVlcHNlZWstdjMuMS10ZXJtaW51c1wiOiBcInNpbGljb25mbG93L2RlZXBzZWVrLXYzLjEtdGVybWludXNcIixcbiAgXCJzaWxpY29uZmxvdy9kZWVwc2Vlay12My0wMzI0XCI6IFwic2lsaWNvbmZsb3cvZGVlcHNlZWstdjMtMDMyNFwiLFxuICBcInZhbmNoaW4vZGVlcHNlZWstdjMuMi10aGlua1wiOiBcInZhbmNoaW4vZGVlcHNlZWstdjMuMi10aGlua1wiLFxuICBcInZhbmNoaW4vZGVlcHNlZWstcjFcIjogXCJ2YW5jaGluL2RlZXBzZWVrLXIxXCIsXG4gIFwidmFuY2hpbi9kZWVwc2Vlay12M1wiOiBcInZhbmNoaW4vZGVlcHNlZWstdjNcIixcbiAgXCJxd2VuMy12bC1wbHVzXCI6IFwicXdlbjMtdmwtcGx1c1wiLFxuICBcInF3ZW4zLXZsLWZsYXNoXCI6IFwicXdlbjMtdmwtZmxhc2hcIixcbiAgXCJxd2VuLXZsLW1heFwiOiBcInF3ZW4tdmwtbWF4XCIsXG4gIFwicXdlbi12bC1wbHVzXCI6IFwicXdlbi12bC1wbHVzXCIsXG4gIFwicXdlbjMtdmxcIjogXCJxd2VuMy12bFwiLFxuICBcImtpbWkva2ltaS1rMi42XCI6IFwia2ltaS9raW1pLWsyLjZcIixcbiAgXCJraW1pL2tpbWktazIuNVwiOiBcImtpbWkva2ltaS1rMi41XCJcbn0iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFBdUY7OztBQ0F2RjtBQUFBLEVBQ0UsZUFBZTtBQUFBLEVBQ2YsZUFBZTtBQUFBLEVBQ2YsYUFBYTtBQUFBLEVBQ2IsWUFBWTtBQUFBLEVBQ1osZ0JBQWdCO0FBQUEsRUFDaEIsZ0JBQWdCO0FBQUEsRUFDaEIsZ0JBQWdCO0FBQUEsRUFDaEIsYUFBYTtBQUFBLEVBQ2IsaUJBQWlCO0FBQUEsRUFDakIsaUJBQWlCO0FBQUEsRUFDakIsY0FBYztBQUFBLEVBQ2QsZUFBZTtBQUFBLEVBQ2YsaUJBQWlCO0FBQUEsRUFDakIsY0FBYztBQUFBLEVBQ2QsY0FBYztBQUFBLEVBQ2QsV0FBVztBQUFBLEVBQ1gsV0FBVztBQUFBLEVBQ1gsT0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsYUFBYTtBQUFBLEVBQ2IsZ0JBQWdCO0FBQUEsRUFDaEIsNkJBQTZCO0FBQUEsRUFDN0Isc0NBQXNDO0FBQUEsRUFDdEMsZ0NBQWdDO0FBQUEsRUFDaEMsK0JBQStCO0FBQUEsRUFDL0IsdUJBQXVCO0FBQUEsRUFDdkIsdUJBQXVCO0FBQUEsRUFDdkIsaUJBQWlCO0FBQUEsRUFD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
