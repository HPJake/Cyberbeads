# Cyber Beads (赛博拼豆)

Single-file HTML5 fuse bead simulator. Zero dependencies.

## File

- `cyber-beads.html` — 完整应用 (HTML + CSS + JS)

## Project Docs

- `docs/README.md` — 游戏说明文档
- `dev-logs/` — 开发日志（按日期记录 bug 修复和功能变更）

## Architecture

### Classes (bottom-up)

1. **CONFIG** — 全局常量 (CELL_PX, BEAD_RADIUS, EDGE_BULGE, heat rates, etc.)
2. **GridModel** — 豆子数据网格、撤销/重做、localStorage 存取
3. **Renderer** — 绘制底板、豆子 (3D cylinder / ironed flat)、效果层
4. **SoundEngine** — Web Audio API 音效
5. **IroningSystem** — 加热逻辑、拖尾粒子、逼真边缘开关
6. **ToolDrawer** — 屏幕底部工具卡片动画
7. **InputManager** — 指针事件 (放置/擦除/熨烫)
8. **ExportManager** — 静态方法，高分辨率 PNG 导出
9. **App** — 总调度器，连接所有模块，驱动游戏循环

### Global data

- **MARD_COLORS** — MARD 291 色号 → HEX 映射表 (来源: pindou.skin, 2026-06-23)
- **MARD_HEX_TO_CODE** — HEX → 色号 反向映射表
- **PALETTE_SETS** — 预设调色板 (马卡龙、复古、原色、大地、自定义等)
- **findClosestMardCode(hex)** — 自定义颜色就近匹配 MARD 色号

### Shared helper functions

- `drawIronedTexture` — 扁平豆子的噪点/斑块/光泽纹理
- `drawEdgeArc` — 逐边圆弧辅助：无邻居边缘凸出半圆弧，有邻居保持直线
- `drawIronedFlatCell` — 共享的逼真扁平豆子绘制（屏幕 + 导出共用）

### Key data flow

- `App` 拥有 `GridModel`、`Renderer`、`IroningSystem`
- Renderer 通过 `this.ironingSys` 访问熨烫状态（由 App 外部注入）
- 导出从 `IroningSystem.realisticEdges` 读取逼真模式状态
- 豆子状态: `{ color, heat: 0-1, ironed: bool }`

## Coordinate Conventions

- **Screen**: 豆子中心绝对坐标: `offsetX + c * CELL_PX + CELL_PX/2`
- **Export**: 原点已平移到豆子中心，使用负半格偏移 `(-20, -20)`
- **CELL_PX**: 40 (屏幕)，导出时通过 `ctx.scale(1.6)` 放大到 EXPORT_CELL_PX (64)

## Realistic Mode (逼真模式)

- 开关: `IroningSystem.realisticEdges` (默认 false)
- **逐边圆弧算法**: 每颗豆子视为圆形，熨烫后填满方格
  - 某方向有邻居 → 互相挤压 → 直线边
  - 某方向无邻居 → 保持圆形弧边 → 半圆弧凸出格子
  - 多个自由边在角落自然交汇，形成波浪扇贝花边
- 过渡动画: `flatness = clamp((heat - 0.92) / 0.08, 0, 1)` 控制花边凸出程度
- 凸出量: `EDGE_BULGE (18px) * flatness`
- 共享绘制: `drawIronedFlatCell(ctx, grid, r, c, color, heat, realistic, x, y)`

## Working Conventions

- 所有修改在 `cyber-beads.html` 单文件中进行
- 修改后刷新浏览器即可测试
- 开发日志写入 `dev-logs/` 文件夹，文件名格式: `YYYY-MM-DD-简述.md`
