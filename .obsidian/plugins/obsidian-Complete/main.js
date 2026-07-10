'use strict';

var obsidian = require('obsidian');

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
        var MODELS = {
            'qwen3.7-max': 'qwen3.7-max',
            'qwen3.6-max': 'qwen3.6-max',
            'qwen3-max': 'qwen3-max',
            'qwen-max': 'qwen-max',
            'qwen3.7-plus': 'qwen3.7-plus',
            'qwen3.6-plus': 'qwen3.6-plus',
            'qwen3.5-plus': 'qwen3.5-plus',
            'qwen-plus': 'qwen-plus',
            'qwen3.6-flash': 'qwen3.6-flash',
            'qwen3.5-flash': 'qwen3.5-flash',
            'qwen-flash': 'qwen-flash',
            'qwen3-coder': 'qwen3-coder',
            'qwen2.5-coder': 'qwen2.5-coder',
            'qwen-coder': 'qwen-coder',
            'qwen-turbo': 'qwen-turbo',
            'qwen3.6': 'qwen3.6',
            'qwen3.5': 'qwen3.5',
            'qwen3': 'qwen3',
            'qwen2.5': 'qwen2.5',
            'qwen-math': 'qwen-math',
            'qwen2.5-math': 'qwen2.5-math',
            'siliconflow/deepseek-v3.2': 'siliconflow/deepseek-v3.2',
            'siliconflow/deepseek-v3.1-terminus': 'siliconflow/deepseek-v3.1-terminus',
            'siliconflow/deepseek-v3-0324': 'siliconflow/deepseek-v3-0324',
            'vanchin/deepseek-v3.2-think': 'vanchin/deepseek-v3.2-think',
            'vanchin/deepseek-r1': 'vanchin/deepseek-r1',
            'vanchin/deepseek-v3': 'vanchin/deepseek-v3',
            'qwen3-vl-plus': 'qwen3-vl-plus',
            'qwen3-vl-flash': 'qwen3-vl-flash',
            'qwen-vl-max': 'qwen-vl-max',
            'qwen-vl-plus': 'qwen-vl-plus',
            'qwen3-vl': 'qwen3-vl',
            'kimi/kimi-k2.6': 'kimi/kimi-k2.6',
            'kimi/kimi-k2.5': 'kimi/kimi-k2.5',
        };
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
