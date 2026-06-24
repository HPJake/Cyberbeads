// ========== GRID MODEL ==========
class GridModel {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.history = new HistoryManager();
    this.locked = false;
    this.occupiedCells = new Set(); // "r,c" keys for cells with beads
  }

  getBead(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.grid[r][c];
  }

  canEdit(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    const b = this.grid[r][c];
    if (b && b.ironed) return false;
    return !this.locked;
  }

  placeBead(r, c, color) {
    if (!this.canEdit(r, c)) return false;
    if (this.grid[r][c] && this.grid[r][c].color === color && this.grid[r][c].heat === 0 && !this.grid[r][c].ironed) return false;
    this.grid[r][c] = { color, heat: 0, ironed: false };
    this.occupiedCells.add(`${r},${c}`);
    return true;
  }

  removeBead(r, c) {
    if (!this.canEdit(r, c)) return false;
    if (!this.grid[r][c]) return false;
    if (this.grid[r][c].ironed) return false;
    this.grid[r][c] = null;
    this.occupiedCells.delete(`${r},${c}`);
    return true;
  }

  addHeat(r, c, amount) {
    const b = this.getBead(r, c);
    if (!b || b.ironed || this.locked) return;
    b.heat = clamp(b.heat + amount, 0, 1);
  }

  setHeat(r, c, value) {
    const b = this.getBead(r, c);
    if (!b || b.ironed || this.locked) return;
    b.heat = clamp(value, 0, 1);
  }

  getBeadsInRect(rowStart, rowEnd, colStart, colEnd) {
    const beads = [];
    for (let r = Math.max(0, rowStart); r <= Math.min(this.rows - 1, rowEnd); r++) {
      for (let c = Math.max(0, colStart); c <= Math.min(this.cols - 1, colEnd); c++) {
        if (this.grid[r][c]) beads.push({ r, c, bead: this.grid[r][c] });
      }
    }
    return beads;
  }

  hasAnyBead() {
    return this.occupiedCells.size > 0;
  }

  resize(rows, cols) {
    // Preserve beads that fit within new bounds
    const oldGrid = this.grid;
    const oldRows = this.rows, oldCols = this.cols;
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (let r = 0; r < Math.min(oldRows, rows); r++) {
      for (let c = 0; c < Math.min(oldCols, cols); c++) {
        if (oldGrid[r][c]) this.grid[r][c] = oldGrid[r][c];
      }
    }
    this.history.clear();
    this.locked = false;
    this._rebuildOccupiedSet();
  }

  clear() {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        this.grid[r][c] = null;
    this.locked = false;
    this.occupiedCells.clear();
  }

  snapshot() { this.history.push(this); }

  undo() {
    const ok = this.history.undo(this);
    if (ok) this._rebuildOccupiedSet();
    return ok;
  }
  redo() {
    const ok = this.history.redo(this);
    if (ok) this._rebuildOccupiedSet();
    return ok;
  }
  canUndo() { return this.history.canUndo(); }
  canRedo() { return this.history.canRedo(); }

  finalizeIroning() {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.grid[r][c] && this.grid[r][c].heat >= 0.90)
          this.grid[r][c].ironed = true;
    this.locked = true;
  }

  _rebuildOccupiedSet() {
    this.occupiedCells.clear();
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.grid[r][c]) this.occupiedCells.add(`${r},${c}`);
  }

  pxToGrid(px, py, ox, oy) {
    const col = Math.floor((px - ox) / CONFIG.CELL_PX);
    const row = Math.floor((py - oy) / CONFIG.CELL_PX);
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) return { row, col };
    return null;
  }

  gridToPx(row, col, ox, oy) {
    return {
      x: ox + col * CONFIG.CELL_PX + CONFIG.CELL_PX / 2,
      y: oy + row * CONFIG.CELL_PX + CONFIG.CELL_PX / 2,
    };
  }

  save(appState = {}) {
    const beads = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const b = this.grid[r][c];
        if (b) beads.push({ r, c, color: b.color, heat: b.heat, ironed: b.ironed });
      }
    const data = {
      v: 2, rows: this.rows, cols: this.cols,
      beads, locked: this.locked,
      history: this.history.serialize(),
      app: {
        customColors: (appState.customColors || []).map(c => ({ name: c.name, hex: c.hex })),
        artworkName: appState.artworkName || '',
        activePaletteKey: appState.activePaletteKey || 'macaron',
        activeColor: appState.activeColor || '',
        tool: appState.tool || 'tweezers',
        zoomLevel: appState.zoomLevel != null ? appState.zoomLevel : 1.0,
      },
      ts: Date.now(),
    };
    try { localStorage.setItem('cyber-beads-save', JSON.stringify(data)); } catch (e) { /* storage full */ }
  }

  load() {
    try {
      const raw = localStorage.getItem('cyber-beads-save');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.v !== 1 && data.v !== 2) return null;
      this.rows = data.rows;
      this.cols = data.cols;
      this.locked = data.locked || false;
      this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
      for (const b of data.beads) {
        if (b.r < this.rows && b.c < this.cols)
          this.grid[b.r][b.c] = { color: b.color, heat: b.heat || 0, ironed: b.ironed || false };
      }
      this.history.deserialize(data.history);
      this._rebuildOccupiedSet();
      return data; // Return full data so App can restore app-level state
    } catch (e) { return null; }
  }
}
