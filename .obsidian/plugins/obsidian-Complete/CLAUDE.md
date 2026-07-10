# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Obsidian 插件项目，当前仅包含编译后的构建产物（`main.js`、`manifest.json`、`styles.css`），没有 TypeScript 源码和构建配置文件。

插件基于 Obsidian 官方 sample plugin 模板（作者 Licat），使用 CommonJS 模块格式，从 `obsidian` 包导入 API。

## 当前状态

- **manifest.json** 仍使用示例插件默认值（id: `obsidian-sample-plugin`，name: `Sample Plugin`），需要更新为实际插件信息
- **main.js** 是编译后的 bundle，内嵌了 source map（base64），原始源文件为 `main.ts`
- **styles.css** 仅包含示例样式（`body { color: red; }`）
- 无 `package.json`、`tsconfig.json`、源码目录或构建脚本

## 如需开发此插件

需要初始化开发环境：

```bash
npm init -y
npm install obsidian @types/node typescript esbuild
```

创建 `tsconfig.json` 和 `esbuild.config.mjs`，将 `main.ts` 编译为 `main.js`。构建命令通常为：

```bash
npx esbuild main.ts --bundle --external:obsidian --outfile=main.js --format=cjs --platform=node
```

## 参考文档

`Plugins-docs/` 目录（vault 根目录下）包含 Obsidian 插件开发的完整参考文档，涵盖：

- **入门**: `Plugins/Getting started/` — 插件结构、构建、开发工作流、移动端开发
- **编辑器扩展**: `Plugins/Editor/` — 装饰器、状态管理、视图插件、Markdown 后处理
- **用户界面**: `Plugins/User interface/` — 命令、模态框、设置面板、状态栏、视图
- **指南**: `Plugins/Guides/` — Bases 视图、延迟加载、声明式设置、性能优化
- **发布**: `Plugins/Releasing/` — 插件审核指南、GitHub Actions 自动发布
- **CSS 变量**: `Reference/CSS variables/` — 完整的样式定制参考

## 插件架构（基于 source map 中的原始 TypeScript）

```
MyPlugin (extends Plugin)
├── onInit()          — 插件初始化
├── onload()          — 注册 ribbon icon、状态栏、命令、设置面板
├── onunload()        — 清理
├── SampleModal (extends Modal) — 示例模态框
└── SampleSettingTab (extends PluginSettingTab) — 设置面板
```

Obsidian 插件生命周期：`onload()` → 运行中 → `onunload()`。所有注册（命令、ribbon、设置）在 `onload()` 中完成。
