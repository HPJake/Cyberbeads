// ========== SHARED DRAWING UTILITIES ==========
function drawIronedTexture(ctx, x, y, size, color, w, h) {
  w = w || size;
  h = h || size;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);

  // Denser fine noise
  const seed = (Math.round(x) * 17 + Math.round(y) * 31) % 9973;
  for (let i = 0; i < 90; i++) {
    const rx = ((seed + i * 9301) % 233280) / 233280;
    const ry = ((seed + i * 49297) % 233280) / 233280;
    const px = x + rx * w;
    const py = y + ry * h;
    const alpha = 0.04 + ((seed + i * 137) % 100) / 100 * 0.10;
    const dotSize = 1.2 + ((seed + i * 211) % 100) / 100 * 0.8;
    if ((seed + i) % 3 !== 0) {
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    } else {
      ctx.fillStyle = `rgba(60,40,20,${alpha * 0.9})`;
    }
    ctx.fillRect(px, py, dotSize, dotSize);
  }

  // Larger subtle blotches for melted plastic unevenness
  for (let i = 0; i < 12; i++) {
    const rx = ((seed + i * 104729) % 233280) / 233280;
    const ry = ((seed + i * 1543) % 233280) / 233280;
    const px = x + rx * w;
    const py = y + ry * h;
    const r = 1.5 + ((seed + i * 7919) % 100) / 100 * 2.5;
    const alpha = 0.02 + ((seed + i * 4567) % 100) / 100 * 0.04;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    if ((seed + i) % 2 === 0) {
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    } else {
      grad.addColorStop(0, `rgba(40,30,15,${alpha})`);
    }
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Surface gloss
  const gloss = ctx.createRadialGradient(x + w * 0.25, y + h * 0.25, 0, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.9);
  gloss.addColorStop(0, 'rgba(255,255,255,0.08)');
  gloss.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  gloss.addColorStop(1, 'rgba(0,0,0,0.04)');
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, w, h);
}

// Draw a circular arc from (x1,y1) to (x2,y2) bulging in outward direction (ox,oy).
// (ox,oy) = unit normal pointing out of the cell (e.g. top edge = (0,-1)).
// bulge = max pixel distance the arc extends beyond the straight edge.
// Used by the realistic ironed-bead path: edges without neighbors bulge outward
// as the original circular bead shape, while edges with neighbors stay straight.
function drawEdgeArc(ctx, x1, y1, x2, y2, bulge, ox, oy) {
  if (bulge < 0.5) {
    ctx.lineTo(x2, y2);
    return;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const S = Math.sqrt(dx * dx + dy * dy); // edge length

  // D = signed distance from edge midpoint to arc center (outward = positive)
  const D = (bulge * bulge - S * S / 4) / (2 * bulge);
  const R = Math.sqrt(S * S / 4 + D * D);

  // Midpoint of the edge
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Arc center
  const cx = mx + ox * D;
  const cy = my + oy * D;

  // Start and end angles from center to corner points
  const startAngle = Math.atan2(y1 - cy, x1 - cx);
  const endAngle = Math.atan2(y2 - cy, x2 - cx);

  // Draw clockwise arc — the short way that bulges outward
  ctx.arc(cx, cy, R, startAngle, endAngle, false);
}

// Shared realistic flat-bead cell drawing — used by both screen renderer and export.
// (x, y) = top-left corner of the cell in the current coordinate system.
//
// Per-edge arc algorithm:
// Each bead is a circle that fills its square when ironed.
//   - Edge WITH neighbor → mutual compression → straight line
//   - Edge WITHOUT neighbor → circular arc bulges outward (the scalloped edge)
// Adjacent free edges meet at a shared corner, their arcs connecting naturally.
function drawIronedFlatCell(ctx, grid, r, c, color, heat, realistic, x, y) {
  const size = CONFIG.CELL_PX;

  if (!realistic) {
    drawIronedTexture(ctx, x, y, size, color);
    return;
  }

  // === Neighbor detection ===
  const isIroned = (row, col) => {
    const b = grid.getBead(row, col);
    return b && b.heat >= 0.92;
  };
  const hasTop = isIroned(r - 1, c);
  const hasBottom = isIroned(r + 1, c);
  const hasLeft = isIroned(r, c - 1);
  const hasRight = isIroned(r, c + 1);

  // === Bulge calculation (transitions with heat) ===
  const flatness = clamp((heat - 0.92) / 0.08, 0, 1);
  const bulge = CONFIG.EDGE_BULGE * flatness;

  // Expanded bounding box for texture fill (covers arc overflows)
  let ex = x, ey = y, ew = size, eh = size;
  if (!hasTop) { ey -= bulge; eh += bulge; }
  if (!hasBottom) { eh += bulge; }
  if (!hasLeft) { ex -= bulge; ew += bulge; }
  if (!hasRight) { ew += bulge; }

  ctx.save();
  try {
    // === Build per-edge path ===
    ctx.beginPath();
    ctx.moveTo(x, y); // top-left corner

    // Top edge: (x, y) → (x+size, y), outward = up (0,-1)
    if (hasTop || bulge < 0.5) {
      ctx.lineTo(x + size, y);
    } else {
      drawEdgeArc(ctx, x, y, x + size, y, bulge, 0, -1);
    }

    // Right edge: (x+size, y) → (x+size, y+size), outward = right (1,0)
    if (hasRight || bulge < 0.5) {
      ctx.lineTo(x + size, y + size);
    } else {
      drawEdgeArc(ctx, x + size, y, x + size, y + size, bulge, 1, 0);
    }

    // Bottom edge: (x+size, y+size) → (x, y+size), outward = down (0,1)
    if (hasBottom || bulge < 0.5) {
      ctx.lineTo(x, y + size);
    } else {
      drawEdgeArc(ctx, x + size, y + size, x, y + size, bulge, 0, 1);
    }

    // Left edge: (x, y+size) → (x, y), outward = left (-1,0)
    if (hasLeft || bulge < 0.5) {
      ctx.lineTo(x, y);
    } else {
      drawEdgeArc(ctx, x, y + size, x, y, bulge, -1, 0);
    }

    ctx.closePath();

    // Fill base shape directly (guaranteed visible regardless of clip)
    ctx.fillStyle = color;
    ctx.fill();

    // Clip and layer texture (noise, blotches, gloss) on top
    ctx.clip();
    drawIronedTexture(ctx, ex, ey, size, color, ew, eh);
  } finally {
    ctx.restore();
  }
}
