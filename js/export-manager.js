// ========== EXPORT MANAGER ==========
class ExportManager {
  // Render beads to an offscreen canvas (no download). Used by both export & preview.
  static exportToCanvas(grid, mode, realisticEdges = false, transparent = false) {
    const cellPx = CONFIG.EXPORT_CELL_PX;
    const w = grid.cols * cellPx;
    const h = grid.rows * cellPx;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    if (!transparent) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const bead = grid.grid[r][c];
        if (!bead) continue;
        const cx = c * cellPx + cellPx / 2;
        const cy = r * cellPx + cellPx / 2;
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
