'use strict';

var obsidian = require('obsidian');
var fs = require('fs');

var extendStatics = function (d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var CompletePlugin = /** @class */ (function (_super) {
    __extends(CompletePlugin, _super);
    function CompletePlugin() {
        return _super.apply(this, arguments) || this;
    }
    CompletePlugin.prototype.onload = function () {
        var _this = this;
        this.addCommand({
            id: 'trigger-complete',
            name: '触发 AI 补全',
            editorCallback: function (editor, view) {
                // TODO: 实现 AI 补全逻辑
                new obsidian.Notice('补全功能开发中...');
            }
        });
        this.loadSettings().then(function () {
            _this.addSettingTab(new CompleteSettingTab(_this.app, _this));
        });
    };
    // 配置保存在 .obsidian/plugins/obsidian-Complete/data.json
    CompletePlugin.prototype.loadSettings = function () {
        var _this = this;
        return this.loadData().then(function (data) {
            _this.settings = Object.assign({ apiKey: '', workspaceId: '', model: 'qwen3.7-plus' }, data);
        });
    };
    CompletePlugin.prototype.saveSettings = function () {
        return this.saveData(this.settings);
    };
    return CompletePlugin;
}(obsidian.Plugin));

var CompleteSettingTab = /** @class */ (function (_super) {
    __extends(CompleteSettingTab, _super);
    function CompleteSettingTab() {
        return _super.apply(this, arguments) || this;
    }
    CompleteSettingTab.prototype.display = function () {
        var _this = this;
        this.containerEl.empty();
        var MODELS = JSON.parse(fs.readFileSync(
    this.app.vault.adapter.getFullPath(this.plugin.manifest.dir + '/models.json'), 'utf8'));
        this.containerEl.createEl('h2', { text: 'Complete 配置' });
        new obsidian.Setting(this.containerEl)
            .setName('百炼业务空间 ID')
            .setDesc('阿里云百炼平台的业务空间标识')
            .addText(function (text) {
                return text
                    .setPlaceholder('请输入百炼业务空间 ID')
                    .setValue(_this.plugin.settings.workspaceId)
                    .onChange(function (value) {
                        _this.plugin.settings.workspaceId = value.trim();
                        _this.plugin.saveSettings();
                    });
            });
        new obsidian.Setting(this.containerEl)
            .setName('阿里云百炼 API Key')
            .setDesc('用于调用百炼平台大模型服务')
            .addText(function (text) {
                return text
                    .setPlaceholder('请输入你的百炼 API Key')
                    .setValue(_this.plugin.settings.apiKey)
                    .onChange(function (value) {
                        _this.plugin.settings.apiKey = value.trim();
                        _this.plugin.saveSettings();
                    });
            });
        new obsidian.Setting(this.containerEl)
            .setName('补全模型')
            .setDesc('选择用于代码补全的模型')
            .addDropdown(function (dropdown) {
                dropdown.addOptions(MODELS)
                    .setValue(_this.plugin.settings.model)
                    .onChange(function (value) {
                        _this.plugin.settings.model = value;
                        _this.plugin.saveSettings();
                    });
            });
    };
    return CompleteSettingTab;
}(obsidian.PluginSettingTab));

module.exports = CompletePlugin;
