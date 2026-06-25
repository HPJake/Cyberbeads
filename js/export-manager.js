// ========== EXPORT MANAGER ==========
class ExportManager {
  // Find the bounding box of all beads, with 2-cell margin on each side.
  // Returns { r1, c1, r2, c2 } (inclusive), or null if no beads exist.
  static getBeadBoundingBox(grid) {
    if (grid.occupiedCells.size === 0) return null;
    let r1 = Infinity, c1 = Infinity, r2 = -Infinity, c2 = -Infinity;
    for (const key of grid.occupiedCells) {
      const [r, c] = key.split(',').map(Number);
      if (r < r1) r1 = r;
      if (r > r2) r2 = r;
      if (c < c1) c1 = c;
      if (c > c2) c2 = c;
    }
    // Add 2-cell margin on each side (allow beyond grid for edge beads)
    r1 = r1 - 2;
    c1 = c1 - 2;
    r2 = r2 + 2;
    c2 = c2 + 2;
    return { r1, c1, r2, c2 };
  }

  // Render beads to an offscreen canvas (no download). Used by both export & preview.
  // cropBox: { r1, c1, r2, c2 } (inclusive) — if provided, only renders that region.
  static exportToCanvas(grid, mode, realisticEdges = false, transparent = false, cropBox = null) {
    const cellPx = CONFIG.EXPORT_CELL_PX;
    const startR = cropBox ? cropBox.r1 : 0;
    const startC = cropBox ? cropBox.c1 : 0;
    const endR = cropBox ? cropBox.r2 : grid.rows - 1;
    const endC = cropBox ? cropBox.c2 : grid.cols - 1;
    const rows = endR - startR + 1;
    const cols = endC - startC + 1;
    const w = cols * cellPx;
    const h = rows * cellPx;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    if (!transparent) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }

    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const bead = grid.grid[r][c];
        if (!bead) continue;
        const cx = (c - startC) * cellPx + cellPx / 2;
        const cy = (r - startR) * cellPx + cellPx / 2;
        const color = bead.color;
        if (color === ERASER_COLOR) continue;

        ctx.save();
        ctx.translate(cx, cy);
        const scale = cellPx / CONFIG.CELL_PX;
        ctx.scale(scale, scale);
        const R = CONFIG.BEAD_RADIUS;

        try {
          if (mode === 'bead') {
            ExportManager._drawExportCylinder(ctx, R, color);
          } else {
            if (bead.heat >= 0.92) {
              ExportManager._drawExportSquare(ctx, color, grid, r, c, realisticEdges, bead.heat);
            } else {
              const holeR = CONFIG.HOLE_RADIUS_MAX * (1 - clamp(bead.heat / 0.92, 0, 1));
              ExportManager._drawExportCylinder(ctx, R, color, holeR);
            }
          }
        } catch (err) {
          console.error(`Export: failed drawing bead at (${r}, ${c})`, err);
        }
        ctx.restore();
      }
    }

    return canvas;
  }

  static export(grid, mode, realisticEdges = false) {
    const canvas = ExportManager.exportToCanvas(grid, mode, realisticEdges, false);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const artName = document.getElementById('artwork-name-input')?.value.trim();
      a.download = artName ? `${artName}.png` : `cyber-beads-${mode}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  static _drawExportCylinder(ctx, R, color, holeR = CONFIG.HOLE_RADIUS_MAX) {
    // 3-circle bead: outer→color, inner wall→dark, center hole→transparent
    const ty = 0.9986; // cos(3°)
    const wallR = holeR > 0.3 ? R * 0.62 * (holeR / CONFIG.HOLE_RADIUS_MAX) : 0;

    // === 1. Outer ring (bead body) ===
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, R, R * ty, 0, 0, Math.PI * 2);
    if (wallR > 0.5) {
      ctx.ellipse(0, 0, wallR, wallR * ty, 0, Math.PI * 2, 0, true);
    }
    ctx.fill();

    // === 2. Inner wall ring (depth illusion) ===
    if (wallR > 0.5) {
      ctx.fillStyle = darkenColor(color, 0.22);
      ctx.beginPath();
      ctx.ellipse(0, 0, wallR, wallR * ty, 0, 0, Math.PI * 2);
      if (holeR > 0.3) {
        ctx.ellipse(0, 0, holeR, holeR * ty, 0, Math.PI * 2, 0, true);
      }
      ctx.fill();
    }
  }

  static _drawExportSquare(ctx, color, grid, r, c, realistic = false, heat = 0.92) {
    const halfCell = CONFIG.CELL_PX / 2;
    drawIronedFlatCell(ctx, grid, r, c, color, heat, realistic, -halfCell, -halfCell);
  }
}
