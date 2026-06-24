// ========== HISTORY MANAGER ==========
class HistoryManager {
  constructor() {
    this.stack = [];
    this.index = -1;
  }

  push(grid) {
    // Serialize sparsely
    const beads = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const b = grid.grid[r][c];
        if (b) beads.push({ r, c, color: b.color, heat: b.heat, ironed: b.ironed });
      }
    }
    const snap = { rows: grid.rows, cols: grid.cols, beads };

    // Truncate forward history
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(snap);
    if (this.stack.length > CONFIG.HISTORY_MAX) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  _apply(snap, grid) {
    // Clear grid
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) grid.grid[r][c] = null;
    }
    grid.rows = snap.rows;
    grid.cols = snap.cols;
    grid.grid = Array.from({ length: snap.rows }, () => Array(snap.cols).fill(null));
    for (const b of snap.beads) {
      if (b.r < snap.rows && b.c < snap.cols) {
        grid.grid[b.r][b.c] = { color: b.color, heat: b.heat || 0, ironed: b.ironed || false };
      }
    }
  }

  undo(grid) {
    if (this.index <= 0) return false;
    this.index--;
    this._apply(this.stack[this.index], grid);
    return true;
  }

  redo(grid) {
    if (this.index >= this.stack.length - 1) return false;
    this.index++;
    this._apply(this.stack[this.index], grid);
    return true;
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }

  clear() { this.stack = []; this.index = -1; }

  serialize() {
    return { stack: this.stack, index: this.index };
  }

  deserialize(data) {
    if (!data || !data.stack) return;
    this.stack = data.stack;
    this.index = data.index;
  }
}
