# Complete

Obsidian AI 补全插件，集成 DeepSeek 和阿里云百炼平台 API，为你的笔记提供智能续写功能。

## 功能特性

- **智能补全**：使用快捷键触发 AI 自动续写当前内容
- **多平台支持**：
  - 阿里云百炼平台（通义千问系列模型）
  - DeepSeek API
- **丰富的模型选择**：支持 Qwen、Kimi、DeepSeek 等多个模型系列
- **实时预览**：补全内容高亮显示，可快速接受或取消

## 安装

1. 将插件文件夹复制到你的 Obsidian vault 的 `.obsidian/plugins/` 目录
2. 在 Obsidian 设置中启用 "Complete" 插件
3. 配置 API 密钥

## 配置

在插件设置中配置以下信息：

### 阿里云百炼平台

- **API Key**：你的阿里云百炼 API 密钥
- **Workspace ID**：工作空间 ID
- **模型**：选择可用的通义千问模型

### DeepSeek

- **API Key**：你的 DeepSeek API 密钥

## 使用方法

1. 在编辑器中编写内容
2. 将光标放在需要补全的位置
3. 按下快捷键触发 AI 补全（默认快捷键可在设置中查看）
4. 补全内容会以高亮形式显示
5. 按 `Tab` 接受补全，按 `Esc` 取消

## 支持的模型

### 阿里云百炼（通义千问）

- qwen3.7-max / qwen3.6-max / qwen3-max / qwen-max
- qwen3.7-plus / qwen3.6-plus / qwen3.5-plus / qwen-plus
- qwen3.6-flash / qwen3.5-flash / qwen-flash
- qwen3-coder / qwen2.5-coder / qwen-coder
- qwen-turbo / qwen3.6 / qwen3.5 / qwen3 / qwen2.5
- qwen-math / qwen2.5-math
- qwen3-vl-plus / qwen3-vl-flash / qwen-vl-max / qwen-vl-plus / qwen3-vl

### DeepSeek（通过百炼平台）

- siliconflow/deepseek-v3.2
- siliconflow/deepseek-v3.1-terminus
- siliconflow/deepseek-v3-0324
- vanchin/deepseek-v3.2-think
- vanchin/deepseek-r1
- vanchin/deepseek-v3

### Kimi

- kimi/kimi-k2.6
- kimi/kimi-k2.5

## 作者

YBMecho

## 版本

1.0.0

## 许可

本插件遵循 Obsidian 插件开发规范。
