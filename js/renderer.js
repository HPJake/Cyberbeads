// ========== RENDERER ==========
class Renderer {
  constructor(container, gridModel) {
    this.container = container;
    this.grid = gridModel;
    this.bgCanvas = document.getElementById('bg-canvas');
    this.beadCanvas = document.getElementById('bead-canvas');
    this.fxCanvas = document.getElementById('fx-canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.beadCtx = this.beadCanvas.getContext('2d');
    this.fxCtx = this.fxCanvas.getContext('2d');
    this.canvasW = 0;
    this.canvasH = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.showRulers = false;
    this.RULER_PAD = 22; // extra padding per side for ruler numbers
  }

  resize() {
    const w = this.grid.cols * CONFIG.CELL_PX;
    const h = this.grid.rows * CONFIG.CELL_PX;
    this.canvasW = w;
    this.canvasH = h;
    this.offsetX = 0;
    this.offsetY = 0;
    const pad = this.showRulers ? this.RULER_PAD : 8;
    // Center canvas in container with padding for shadow / ruler space
    this.container.style.width = (w + pad * 2) + 'px';
    this.container.style.height = (h + pad * 2) + 'px';
    [this.bgCanvas, this.beadCanvas, this.fxCanvas].forEach(c => {
      c.width = w + pad * 2;
      c.height = h + pad * 2;
      c.style.width = (w + pad * 2) + 'px';
      c.style.height = (h + pad * 2) + 'px';
    });
    // Also resize ref-canvas if it exists
    const refCanvas = document.getElementById('ref-canvas');
    if (refCanvas) {
      refCanvas.width = w + pad * 2;
      refCanvas.height = h + pad * 2;
      refCanvas.style.width = (w + pad * 2) + 'px';
      refCanvas.style.height = (h + pad * 2) + 'px';
    }
    this.offsetX = pad;
    this.offsetY = pad;
  }

  drawPegboard() {
    const ctx = this.bgCtx;
    const w = this.canvasW + this.offsetX * 2;
    const h = this.canvasH + this.offsetY * 2;
    ctx.clearRect(0, 0, w, h);

    // Pegboard base - warm translucent white
    const boardGrad = ctx.createLinearGradient(0, 0, w, h);
    boardGrad.addColorStop(0, '#F8F3EC');
    boardGrad.addColorStop(0.5, '#F3EDE4');
    boardGrad.addColorStop(1, '#ECE4D8');
    ctx.fillStyle = boardGrad;
    const br = 8;
    ctx.beginPath();
    ctx.moveTo(this.offsetX + br, this.offsetY);
    ctx.lineTo(this.offsetX + this.canvasW - br, this.offsetY);
    ctx.arcTo(this.offsetX + this.canvasW, this.offsetY, this.offsetX + this.canvasW, this.offsetY + br, br);
    ctx.lineTo(this.offsetX + this.canvasW, this.offsetY + this.canvasH - br);
    ctx.arcTo(this.offsetX + this.canvasW, this.offsetY + this.canvasH, this.offsetX + this.canvasW - br, this.offsetY + this.canvasH, br);
    ctx.lineTo(this.offsetX + br, this.offsetY + this.canvasH);
    ctx.arcTo(this.offsetX, this.offsetY + this.canvasH, this.offsetX, this.offsetY + this.canvasH - br, br);
    ctx.lineTo(this.offsetX, this.offsetY + br);
    ctx.arcTo(this.offsetX, this.offsetY, this.offsetX + br, this.offsetY, br);
    ctx.closePath();
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(180,160,140,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Very faint cell grid lines
    ctx.strokeStyle = 'rgba(180,165,145,0.12)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= this.grid.rows; r++) {
      const y = this.offsetY + r * CONFIG.CELL_PX;
      ctx.beginPath();
      ctx.moveTo(this.offsetX, y);
      ctx.lineTo(this.offsetX + this.canvasW, y);
      ctx.stroke();
    }
    for (let c = 0; c <= this.grid.cols; c++) {
      const x = this.offsetX + c * CONFIG.CELL_PX;
      ctx.beginPath();
      ctx.moveTo(x, this.offsetY);
      ctx.lineTo(x, this.offsetY + this.canvasH);
      ctx.stroke();
    }

    // Every-5th-cell alignment lines (thicker, more visible)
    ctx.strokeStyle = 'rgba(160,140,120,0.28)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= this.grid.rows; r += 5) {
      const y = this.offsetY + r * CONFIG.CELL_PX;
      ctx.beginPath();
      ctx.moveTo(this.offsetX, y);
      ctx.lineTo(this.offsetX + this.canvasW, y);
      ctx.stroke();
    }
    for (let c = 0; c <= this.grid.cols; c += 5) {
      const x = this.offsetX + c * CONFIG.CELL_PX;
      ctx.beginPath();
      ctx.moveTo(x, this.offsetY);
      ctx.lineTo(x, this.offsetY + this.canvasH);
      ctx.stroke();
    }

    // Number rulers (only when enabled)
    if (this.showRulers) {
      const pad = this.offsetX; // dynamic pad (8 or RULER_PAD)
      const fx = 10; // font size for rulers
      ctx.fillStyle = '#8B7355';
      ctx.font = `${fx}px Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      for (let c = 0; c < this.grid.cols; c++) {
        const cx = this.offsetX + c * CONFIG.CELL_PX + CONFIG.CELL_PX / 2;
        // Top ruler (1-based, left → right)
        ctx.fillText(String(c + 1), cx, pad * 0.38);
        // Bottom ruler (reverse: right → left)
        ctx.fillText(String(this.grid.cols - c), cx, this.offsetY + this.canvasH + pad * 0.62);
      }

      ctx.textAlign = 'right';
      for (let r = 0; r < this.grid.rows; r++) {
        const cy = this.offsetY + r * CONFIG.CELL_PX + CONFIG.CELL_PX / 2;
        // Left ruler (1-based, top → bottom)
        ctx.fillText(String(r + 1), pad * 0.42, cy);
      }

      ctx.textAlign = 'left';
      for (let r = 0; r < this.grid.rows; r++) {
        const cy = this.offsetY + r * CONFIG.CELL_PX + CONFIG.CELL_PX / 2;
        // Right ruler (reverse: bottom → top)
        ctx.fillText(String(this.grid.rows - r), this.offsetX + this.canvasW + pad * 0.58, cy);
      }
      ctx.textAlign = 'center';
    }

    // Draw peg dots at cell CENTERS (one per cell, beads sit on these)
    const dotR = CONFIG.CELL_PX * 0.14;
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const px = this.offsetX + c * CONFIG.CELL_PX + CONFIG.CELL_PX / 2;
        const py = this.offsetY + r * CONFIG.CELL_PX + CONFIG.CELL_PX / 2;
        // Peg shadow
        ctx.fillStyle = 'rgba(160,140,120,0.3)';
        ctx.beginPath();
        ctx.arc(px + 0.5, py + 1, dotR, 0, Math.PI * 2);
        ctx.fill();
        // Peg highlight
        ctx.fillStyle = 'rgba(255,252,248,0.7)';
        ctx.beginPath();
        ctx.arc(px - 0.3, py - 0.5, dotR * 0.8, 0, Math.PI * 2);
        ctx.fill();
        // Peg base
        ctx.fillStyle = '#E8DDD0';
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fill();
        // Peg top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(px - dotR * 0.25, py - dotR * 0.25, dotR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawAllBeads() {
    const ctx = this.beadCtx;
    const w = this.canvasW + this.offsetX * 2;
    const h = this.canvasH + this.offsetY * 2;
    ctx.clearRect(0, 0, w, h);

    // Iterate only occupied cells (not all rows × cols)
    for (const key of this.grid.occupiedCells) {
      const comma = key.indexOf(',');
      const r = +key.slice(0, comma);
      const c = +key.slice(comma + 1);
      const bead = this.grid.grid[r][c];
      if (!bead) continue; // safety: shouldn't happen
      const cx = this.offsetX + c * CONFIG.CELL_PX + CONFIG.CELL_PX / 2;
      const cy = this.offsetY + r * CONFIG.CELL_PX + CONFIG.CELL_PX / 2;
      this._drawBeadAt(ctx, cx, cy, bead, r, c);
    }
  }

  _drawBeadAt(ctx, cx, cy, bead, r, c) {
    const heat = bead.heat || 0;
    const color = bead.color;
    if (color === ERASER_COLOR) return;
    const R = CONFIG.BEAD_RADIUS;
    const holeR = CONFIG.HOLE_RADIUS_MAX * (1 - clamp(heat / 0.92, 0, 1));

    if (heat >= 0.92) {
      this._drawIronedFlat(ctx, cx, cy, color, r, c, heat);
    } else {
      this._drawCylinderBead(ctx, cx, cy, R, color, holeR, heat);
    }
  }

  _drawCylinderBead(ctx, cx, cy, R, color, holeR, heat) {
    // 3-circle bead: outer→color, inner wall→dark, center hole→transparent
    // ~3° tilt like the reference — nearly top-down, very subtle Y squash
    const ty = 0.9986; // cos(3°)
    const heatFactor = clamp(heat / 0.92, 0, 1);
    const wallR = R * 0.62 * (1 - heatFactor);

    ctx.save();
    ctx.translate(cx, cy);

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

    ctx.restore();
  }

  _drawIronedFlat(ctx, cx, cy, color, r, c, heat) {
    const realistic = this.ironingSys ? this.ironingSys.realisticEdges : false;
    const halfCell = CONFIG.CELL_PX / 2;
    drawIronedFlatCell(ctx, this.grid, r, c, color, heat, realistic, cx - halfCell, cy - halfCell);
  }

  drawIroningCloth() {
    const ctx = this.fxCtx;
    const w = this.canvasW + this.offsetX * 2;
    const h = this.canvasH + this.offsetY * 2;

    // Semi-transparent cloth overlay
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, w, h);

    // Subtle cloth texture - fine horizontal lines
    ctx.strokeStyle = 'rgba(200,180,160,0.12)';
    ctx.lineWidth = 0.5;
    for (let y = this.offsetY; y <= this.offsetY + this.canvasH; y += 4) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX, y);
      ctx.lineTo(this.offsetX + this.canvasW, y);
      ctx.stroke();
    }

    // Occasional vertical weave
    ctx.strokeStyle = 'rgba(200,180,160,0.08)';
    for (let x = this.offsetX; x <= this.offsetX + this.canvasW; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, this.offsetY);
      ctx.lineTo(x, this.offsetY + this.canvasH);
      ctx.stroke();
    }
  }

  drawHeatTrails(trails) {
    const ctx = this.fxCtx;
    for (const t of trails) {
      const alpha = t.life / t.maxLife;
      const size = t.size * alpha;
      if (size < 0.3) continue;
      const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, size);
      grad.addColorStop(0, `rgba(255,${180 + Math.round(t.hue * 0.3)},${80 + Math.round(t.hue * 0.15)},${alpha * 0.7})`);
      grad.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawToolCursor(x, y, tool, color, penInkLevel) {
    const ctx = this.fxCtx;
    if (x < this.offsetX || x > this.offsetX + this.canvasW || y < this.offsetY || y > this.offsetY + this.canvasH) return;
    if (tool === 'none' || tool === 'hand') return;

    ctx.save();
    ctx.translate(x, y);

    if (tool === 'tweezers') {
      // Draw small tweezers cursor
      ctx.strokeStyle = '#8B6B4A';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      // Left prong
      ctx.beginPath();
      ctx.moveTo(-2, -4);
      ctx.lineTo(-6, 6);
      ctx.stroke();
      // Right prong
      ctx.beginPath();
      ctx.moveTo(2, -4);
      ctx.lineTo(6, 6);
      ctx.stroke();
      // Handle
      ctx.beginPath();
      ctx.moveTo(-2, -4);
      ctx.lineTo(-2, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, -4);
      ctx.lineTo(2, -12);
      ctx.stroke();
      // Cross bar
      ctx.beginPath();
      ctx.moveTo(-3, -9);
      ctx.lineTo(3, -9);
      ctx.stroke();

      // Color dot if selected
      if (color && color !== ERASER_COLOR) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, -1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = darkenColor(color, 0.3);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    } else if (tool === 'beadpen') {
      // Draw small pen cursor
      ctx.fillStyle = '#D4B896';
      ctx.strokeStyle = '#8B6B4A';
      ctx.lineWidth = 1.2;
      // Pen body (angled slightly)
      ctx.save();
      ctx.rotate(0.3);
      ctx.beginPath();
      ctx.roundRect(-2.5, -16, 5, 16, 2);
      ctx.fill();
      ctx.stroke();
      // Pen tip
      ctx.fillStyle = '#A08060';
      ctx.beginPath();
      ctx.moveTo(-2.5, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(2.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Color dot chain
      if (color && color !== ERASER_COLOR) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(i * 3 - 3, -3, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Ink level bar (small bar next to cursor)
      const ink = penInkLevel != null ? penInkLevel : 1;
      const barX = 10, barY = -14, barW = 3, barH = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.roundRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1, 1.5);
      ctx.fill();
      // Ink fill
      const inkH = barH * ink;
      const inkGrad = ctx.createLinearGradient(0, barY + barH - inkH, 0, barY + barH);
      inkGrad.addColorStop(0, '#F4A7B9');
      inkGrad.addColorStop(1, '#D4788A');
      ctx.fillStyle = inkGrad;
      ctx.beginPath();
      ctx.roundRect(barX, barY + barH - inkH, barW, inkH, 1);
      ctx.fill();
      // Low ink warning
      if (ink < 0.25) {
        ctx.fillStyle = 'rgba(255,100,80,0.7)';
        ctx.beginPath();
        ctx.arc(barX + barW / 2, barY - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawIronCursor(x, y) {
    const ctx = this.fxCtx;
    ctx.save();
    ctx.translate(x, y);

    // Cute iron shape - enlarged
    // Warm glow under iron (drawn first, behind iron)
    const glowGrad = ctx.createRadialGradient(0, 10, 3, 0, 10, 28);
    glowGrad.addColorStop(0, 'rgba(255,180,100,0.5)');
    glowGrad.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 10, 28, 0, Math.PI * 2);
    ctx.fill();

    // Iron body (40x32 rounded rect)
    const bodyGrad = ctx.createLinearGradient(0, -27, 0, 5);
    bodyGrad.addColorStop(0, '#F0D0B0');
    bodyGrad.addColorStop(1, '#D4A080');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-20, -27, 40, 32, 9);
    ctx.fill();
    ctx.strokeStyle = '#A07050';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Sole plate line
    ctx.strokeStyle = '#B88060';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-17, -2);
    ctx.lineTo(17, -2);
    ctx.stroke();

    // Handle (16x16 above body)
    ctx.fillStyle = '#8B6B4A';
    ctx.beginPath();
    ctx.roundRect(-8, -41, 16, 16, 5);
    ctx.fill();
    ctx.strokeStyle = '#6B4B30';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Handle arch (hole)
    ctx.clearRect(-5, -38, 10, 8);
    ctx.strokeStyle = '#8B6B4A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -31, 7, Math.PI, 0);
    ctx.stroke();

    // Steam wisps
    ctx.strokeStyle = 'rgba(200,180,160,0.35)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const sx = -8 + i * 8;
      ctx.beginPath();
      ctx.moveTo(sx, -41);
      ctx.quadraticCurveTo(sx + (i - 1) * 2, -50, sx + (i - 1) * 4, -56 + Math.sin(Date.now() / 500 + i) * 3);
      ctx.stroke();
    }

    ctx.restore();
  }

  clearFx() {
    const w = this.canvasW + this.offsetX * 2;
    const h = this.canvasH + this.offsetY * 2;
    this.fxCtx.clearRect(0, 0, w, h);
  }
}
