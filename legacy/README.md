# legacy —— 已过时的旧版前端（存档）

> ⚠️ **这些文件已过时，不要再修改或部署。**

## 这是什么

单词自测工具的**第一版实现**：零依赖、纯静态、单页三文件 + 一份词库。

| 文件 | 说明 |
|---|---|
| `index.html` | 页面结构（深色玻璃拟态，紫/鹅黄配色） |
| `styles.css` | 样式，含 A4 打印排版 |
| `app.js` | 全部逻辑（原生 JS，IIFE） |
| `words.js` | 词库数据，`window.WORDS = [...]`，5877 条 |

## 为什么被淘汰

改为 **React + shadcn/ui + 黑白配色**，新实现在仓库的 `app/` 目录：

```
app/
├── src/
│   ├── App.tsx              主状态、键盘、路由
│   ├── components/          HomeView / CardView / ResultView
│   ├── components/ui/       shadcn/ui 组件（Button/Card/Select/...）
│   ├── lib/                 quiz(排序筛选) / exports(导出) / store(存档)
│   └── data/words.json      词库（同 5877 条）
├── test/render.test.tsx     61 项渲染与逻辑测试
└── package.json
```

新版优势：组件化、类型安全、可测试、构建产物 gzip 后小 2/3、配色为纯灰阶黑白。

## 保留原因

仅作对照与回退参考。**线上已切换到 React 版，这些文件不再参与部署。**

## 如果确实需要跑起来看

直接双击 `index.html` 即可（零依赖，无需构建）。注意它的进度存储键与 React 版**不互通**：

- 旧版：`localStorage` 键为词库/进度相关旧键
- 新版：`wordquiz.react.v1`

## 相关文件不在本目录

- 词库**生成脚本**（`tools_*.py`）与**原始数据**（`data/`）仍在仓库根目录，它们是新版的数据源，**没有过时**。
- 但 `tools_build_words.py` 的输出已改为 `app/src/data/words.json`，不再生成这里的 `words.js`。

归档日期：2026-10-17
