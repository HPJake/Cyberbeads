// ========== POLYFILLS ==========
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') {
      r = { tl: r, tr: r, br: r, bl: r };
    } else if (Array.isArray(r)) {
      r = { tl: r[0], tr: r[1], br: r[2], bl: r[3] };
    }
    this.beginPath();
    this.moveTo(x + r.tl, y);
    this.lineTo(x + w - r.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    this.lineTo(x + w, y + h - r.br);
    this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    this.lineTo(x + r.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    this.lineTo(x, y + r.tl);
    this.quadraticCurveTo(x, y, x + r.tl, y);
    this.closePath();
  };
}

// ========== UTILITY FUNCTIONS ==========
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function parseHex(hex) {
  if (hex === 'transparent' || hex === ERASER_COLOR) return null;
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function lightenColor(hex, amount) {
  const c = parseHex(hex);
  if (!c) return 'rgba(0,0,0,0)';
  const r = Math.min(255, Math.round(c.r + (255 - c.r) * amount));
  const g = Math.min(255, Math.round(c.g + (255 - c.g) * amount));
  const b = Math.min(255, Math.round(c.b + (255 - c.b) * amount));
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amount) {
  const c = parseHex(hex);
  if (!c) return 'rgba(0,0,0,0)';
  const r = Math.max(0, Math.round(c.r * (1 - amount)));
  const g = Math.max(0, Math.round(c.g * (1 - amount)));
  const b = Math.max(0, Math.round(c.b * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

function hexToRgbStr(hex) {
  const c = parseHex(hex);
  if (!c) return 'rgba(0,0,0,0)';
  return `rgb(${c.r},${c.g},${c.b})`;
}

function contrastTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance (perceived brightness)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1a1a1a' : '#ffffff';
}

// Find the closest MARD color code for a given HEX (Euclidean RGB distance)
function findClosestMardCode(hex) {
  if (!hex || hex === 'transparent') return null;
  const c = parseHex(hex);
  if (!c) return null;
  let bestCode = null, bestDist = Infinity;
  for (const [code, mHex] of Object.entries(MARD_COLORS)) {
    const m = parseHex(mHex);
    if (!m) continue;
    const dr = c.r - m.r, dg = c.g - m.g, db = c.b - m.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; bestCode = code; }
  }
  return bestCode;
}
