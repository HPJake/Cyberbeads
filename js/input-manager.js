// ========== INPUT MANAGER ==========
class InputManager {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('canvas-container');
    this.grid = app.grid;
    this.renderer = app.renderer;

    this.pointerDown = false;
    this.pointerX = -100;
    this.pointerY = -100;
    this.lastCell = null;
    this.penCells = new Set();
    this.penInkUsed = 0;
    this.isIroning = false;
    this.ironLastHeatCell = null;
    this.lastMoveTime = 0;  // throttle non-ironing pointermove

    this._setupEvents();
  }

  _setupEvents() {
    this.container.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.container.setPointerCapture(e.pointerId);
      this.pointerDown = true;
      this._updatePointer(e);
      this._onDown();
    });

    this.container.addEventListener('pointermove', (e) => {
      e.preventDefault();
      this._updatePointer(e);
      this._onMove();
    });

    this.container.addEventListener('pointerup', (e) => {
      e.preventDefault();
      this._onUp();
      this.pointerDown = false;
      this.lastCell = null;
      this.penCells.clear();
      this.penInkUsed = 0;
      this.app.penInkLevel = 1;
      try { this.container.releasePointerCapture(e.pointerId); } catch (ex) { /* */ }
    });

    this.container.addEventListener('pointerleave', () => {
      if (this.pointerDown) this._onUp();
      this.pointerDown = false;
      this.lastCell = null;
      this.penCells.clear();
      this.penInkUsed = 0;
      this.app.penInkLevel = 1;
    });
  }

  _updatePointer(e) {
    const rect = this.container.getBoundingClientRect();
    this.pointerX = (e.clientX - rect.left) / this.app.zoomLevel;
    this.pointerY = (e.clientY - rect.top) / this.app.zoomLevel;
  }

  _getCell() {
    return this.grid.pxToGrid(this.pointerX, this.pointerY, this.renderer.offsetX, this.renderer.offsetY);
  }

  _onDown() {
    const cell = this._getCell();
    if (!cell) return;

    if (this.isIroning) {
      this._ironAt(cell);
      return;
    }

    const tool = this.app.toolDrawer.getTool();
    if (tool === 'tweezers') {
      this._tweezerPlace(cell);
    } else {
      this.penCells.clear();
      this.penInkUsed = 0;
      this._penPlace(cell);
      this.lastCell = cell;
    }
  }

  _onMove() {
    if (!this.pointerDown) return;

    if (this.isIroning) {
      const cell = this._getCell();
      if (cell) this._ironAt(cell);
      return;
    }

    // Throttle non-ironing moves to ~12ms (~83Hz) — still above 60fps, reduces waste
    const now = performance.now();
    if (now - this.lastMoveTime < 12) return;
    this.lastMoveTime = now;

    const tool = this.app.toolDrawer.getTool();
    if (tool === 'tweezers') return; // No drag for tweezers

    const cell = this._getCell();
    if (!cell) return;
    if (this.lastCell && cell.row === this.lastCell.row && cell.col === this.lastCell.col) return;
    this._penPlace(cell);
    this.lastCell = cell;
  }

  _onUp() {
    if (this.isIroning) {
      this.ironLastHeatCell = null;
      if (this.app.ironingSys) this.app.ironingSys.finishStroke();
      return;
    }

    const tool = this.app.toolDrawer.getTool();
    if (tool === 'tweezers') {
      // Snapshot taken per click in _tweezerPlace
    } else {
      if (this.penCells.size > 0) {
        this.grid.snapshot();
        this.app.onBeadChange();
      }
    }
  }

  _tweezerPlace(cell) {
    const color = this.app.activeColor;
    if (color === ERASER_COLOR) {
      if (this.grid.removeBead(cell.row, cell.col)) {
        this.grid.snapshot();
        this.app.sound.playPop();
        this.app.onBeadChange();
      }
    } else {
      if (this.grid.placeBead(cell.row, cell.col, color)) {
        this.grid.snapshot();
        this.app.sound.playPlace();
        this.app.onBeadChange();
      }
    }
  }

  _penPlace(cell) {
    if (this.penInkUsed >= CONFIG.PEN_MAX_CELLS) return;
    const key = `${cell.row},${cell.col}`;
    if (this.penCells.has(key)) return;
    const color = this.app.activeColor;
    let changed = false;
    if (color === ERASER_COLOR) {
      changed = this.grid.removeBead(cell.row, cell.col);
    } else {
      changed = this.grid.placeBead(cell.row, cell.col, color);
    }
    if (changed) {
      this.penCells.add(key);
      this.penInkUsed++;
      this.app.sound.playPop();
      this.app.onBeadChange();
      this.app.penInkLevel = 1 - this.penInkUsed / CONFIG.PEN_MAX_CELLS;
    }
  }

  _ironAt(cell) {
    // Will be handled by IroningSystem
    if (this.app.ironingSys) {
      if (this.ironLastHeatCell) {
        // Interpolate between last cell and current to fill gaps from fast pointer movement
        const dr = cell.row - this.ironLastHeatCell.row;
        const dc = cell.col - this.ironLastHeatCell.col;
        const steps = Math.max(Math.abs(dr), Math.abs(dc));
        for (let i = 0; i <= steps; i++) {
          const t = steps === 0 ? 0 : i / steps;
          const ri = Math.round(this.ironLastHeatCell.row + dr * t);
          const ci = Math.round(this.ironLastHeatCell.col + dc * t);
          this.app.ironingSys.heatCell(ri, ci);
        }
      } else {
        this.app.ironingSys.heatCell(cell.row, cell.col);
      }
      this.ironLastHeatCell = cell;
    }
  }

  setIroningMode(active) {
    this.isIroning = active;
  }

  getPointerPos() {
    return { x: this.pointerX, y: this.pointerY };
  }
}
