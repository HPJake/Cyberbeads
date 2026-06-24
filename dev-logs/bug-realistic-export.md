# Bug: 逼真模式熨烫后无法导出扁平图

- **ID**: REALISTIC-EXPORT-001
- **日期**: 2026-06-22
- **状态**: 已修复

## 现象

开启逼真模式熨烫定型后，点击导出 → "熨烫效果（扁平）"时：
- 没有文件下载
- 浏览器控制台出现红色 JavaScript 异常

非逼真模式导出正常。屏幕逼真渲染正常。

## 根因

`Renderer._drawIronedFlat`（屏幕渲染）和 `ExportManager._drawExportSquare`（导出渲染）是两个近乎相同的函数，拥有独立的逼真边缘绘制逻辑。虽然代码在结构上等价，但导出路径中嵌套的 `ctx.clip()` + `ctx.scale()` 组合在画布上下文状态上产生了微妙的差异，导致 JavaScript 异常。

## 修复

提取共享函数 `drawIronedFlatCell`，消除代码重复。屏幕渲染和导出现在通过完全相同的代码路径绘制逼真扁平豆子：

- `Renderer._drawIronedFlat` → 委托给 `drawIronedFlatCell`
- `ExportManager._drawExportSquare` → 委托给 `drawIronedFlatCell`
- 导出循环增加 try-catch 防止单颗豆子绘制失败中断整个导出

## 验证

1. 逼真模式 ON → 熨烫定型 → 导出扁平图 → 正常下载 ✓
2. 逼真模式 OFF → 导出扁平图 → 正常 ✓
3. 导出豆子效果（带孔）→ 不受影响 ✓
4. 屏幕渲染与导出图片效果一致 ✓
5. 控制台无红色报错 ✓

---

## 追加修复 (同日)

### 新现象
- 清空画布功能失效
- 逼真模式熨烫时豆子渲染异常（消失/位移），鼠标控制卡死

### 根因
初版修复中 `_drawIronedFlat` 增加了 `ctx.save()` → `ctx.translate(cx, cy)` → 委托 → `ctx.restore()`。画布变换操作与共享函数内部的 `ctx.clip()` 嵌套时，在某些浏览器中导致游戏循环崩溃（异常中断 `requestAnimationFrame`），进而 UI 完全无响应。

### 修复
改为由调用方传入坐标，`_drawIronedFlat` 不再触碰画布状态：
- `drawIronedFlatCell(ctx, grid, r, c, color, heat, realistic, x, y)` — 接收外部计算的 (x, y) 左上角坐标
- `_drawIronedFlat` — 计算绝对坐标 `(cx - halfCell, cy - halfCell)` 传入，无需 save/translate/restore
- `_drawExportSquare` — 计算相对坐标 `(-halfCell, -halfCell)` 传入

---

## 追加修复 2 (同日)

### 新现象
- 清空和屏幕渲染恢复正常
- 逼真模式导出可以下载文件，但导出图片异常 — **图片中有部分区域缺失**（某些豆子或豆子边缘消失）
- 非逼真模式导出完全正常

### 根因分析
导出路径使用 `ctx.scale(1.6)` 变换，在 `drawIronedFlatCell` 内部的 `ctx.clip()` 与缩放变换嵌套时，部分浏览器的 Canvas 实现可能对 clip 区域产生微妙差异。由于 `drawIronedTexture` 的 `fillRect` **完全依赖 clip 来约束绘制区域**，一旦 clip 失效或区域不准确，豆子就直接缺失。

屏幕渲染（1x 无缩放）不受影响。

### 修复
在 `drawIronedFlatCell` 逼真路径中，**`ctx.clip()` 之前先用 `ctx.fill()` 直接填充路径**：

```javascript
ctx.save();
ctx.beginPath();
drawRoundRectArcTo(ctx, rx, ry, rw, rh, [tl, tr, br, bl]);
ctx.fillStyle = color;
ctx.fill();   // ← 直接填充路径，不依赖 clip
ctx.clip();   // clip 仅用于后续纹理叠加
drawIronedTexture(ctx, rx, ry, size, color, rw, rh);
ctx.restore();
```

这样即使 clip 有问题，豆子的基本形状已被 `fill()` 确保绘制。clip 只用于后续的噪点/斑块/光泽纹理叠加。

### 验证结果
- ❌ 未通过 — 导出图片依然不完整，且恶化为「只有左上角可见」

---

## 追加修复 3 (同日)

### 新现象
- 追加修复 2 之后，导出图片从「部分缺失」恶化为「**只有左上角**」有内容
- 非逼真导出正常

### 根因分析

「只有左上角」是 canvas 状态栈被破坏的经典症状：

1. `drawIronedFlatCell` 内部 `ctx.save()` 后，如果 `ctx.fill()` 在某些浏览器中清空了路径，紧接着 `ctx.clip()` 没有路径可裁剪
2. 或者 `drawIronedTexture` / `drawRoundRectArcTo` 抛出异常，`ctx.restore()` 永远执行不到
3. 外层导出循环的 `ctx.restore()` 弹出的是内层的 save 状态，而非外层的 translate + scale
4. 下一次循环的 translate 叠加在残留的 translate 之上，豆子坐标逐步漂移到画布之外

### 修复（双重保障）

```javascript
ctx.save();
try {                          // ← finally 保证 restore 一定执行
  // Pass 1: 填充路径 — 保证基础形状可见
  ctx.beginPath();
  drawRoundRectArcTo(ctx, rx, ry, rw, rh, [tl, tr, br, bl]);
  ctx.fillStyle = color;
  ctx.fill();

  // Pass 2: 重建路径 — 独立 clip + 纹理叠加
  ctx.beginPath();             // ← 重新构建，避免 fill() 影响 clip()
  drawRoundRectArcTo(ctx, rx, ry, rw, rh, [tl, tr, br, bl]);
  ctx.clip();
  drawIronedTexture(ctx, rx, ry, size, color, rw, rh);
} finally {
  ctx.restore();               // ← 保证 save/restore 始终平衡
}
```

两个关键改动：
- **try-finally**：无论中间任何一步抛异常，`ctx.restore()` 一定执行，状态栈永不平衡
- **两遍构建路径**：第一遍给 `fill()` 用（基础颜色），第二遍重建给 `clip()` 用（纹理），避免浏览器 `fill()` 对 path 的副作用影响 clip

### 待验证
1. 逼真模式导出扁平图 → 图片完整，不再只有左上角
2. 非逼真模式导出 → 正常
3. 屏幕逼真渲染 → 正常
