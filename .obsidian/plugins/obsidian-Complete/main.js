'use strict';

var obsidian = require('obsidian');

// ponytail: 编译后的继承辅助，移到顶部避免引用未定义
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
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.settings = { apiKey: '' };
        return _this;
    }
    CompletePlugin.prototype.onload = function () {
        var _this = this;
        this.loadSettings().then(function () {
            _this.addSettingTab(new CompleteSettingTab(_this.app, _this));
        });
    };
    CompletePlugin.prototype.onunload = function () {
    };
    CompletePlugin.prototype.loadSettings = function () {
        var _this = this;
        return this.loadData().then(function (data) {
            if (data) {
                _this.settings = Object.assign({ apiKey: '' }, data);
            }
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
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CompleteSettingTab.prototype.display = function () {
        var _this = this;
        var containerEl = this.containerEl;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Complete 配置' });
        new obsidian.Setting(containerEl)
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
    };
    return CompleteSettingTab;
}(obsidian.PluginSettingTab));

module.exports = CompletePlugin;
