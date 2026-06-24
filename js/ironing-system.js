// ========== IRONING SYSTEM ==========
class IroningSystem {
  constructor(app) {
    this.app = app;
    this.grid = app.grid;
    this.active = false;
    this.allowReheat = true;
    this.realisticEdges = false;
    this.trails = [];
    this.heatedThisStroke = []; // {r, c, prevHeat}
    this.frameCount = 0;
    this.dirtyCounter = 0;
    this.maxHeat = 0;       // incremental tracking (O(1) instead of O(n²) scan)
  }

  start(allowReheat) {
    this.active = true;
    this.allowReheat = allowReheat;
    this.trails = [];
    this.heatedThisStroke = [];
    this.maxHeat = 0;
    this.app.input.setIroningMode(true);
    this.app.sound.startHum();
    this.app.onIronStateChange();
  }

  heatCell(r, c) {
    if (!this.active) return;
    const bead = this.grid.getBead(r, c);
    if (!bead || bead.ironed || this.grid.locked) return;

    const prevHeat = bead.heat;
    this.grid.addHeat(r, c, CONFIG.HEAT_RATE);
    this.maxHeat = Math.max(this.maxHeat, bead.heat);
    this.heatedThisStroke.push({ r, c, prevHeat });

    // Heat adjacent cells
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const adjBead = this.grid.getBead(r + dr, c + dc);
      if (adjBead && !adjBead.ironed && !this.grid.locked) {
        this.grid.addHeat(r + dr, c + dc, CONFIG.HEAT_ADJACENT);
        this.maxHeat = Math.max(this.maxHeat, adjBead.heat);
      }
    }

    // Trail particles
    const renderer = this.app.renderer;
    const pos = this.grid.gridToPx(r, c, renderer.offsetX, renderer.offsetY);
    if (Math.random() < CONFIG.TRAIL_PER_FRAME) {
      this.trails.push({
        x: pos.x + (Math.random() - 0.5) * CONFIG.CELL_PX,
        y: pos.y + (Math.random() - 0.5) * CONFIG.CELL_PX,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 1.8,
        life: CONFIG.TRAIL_LIFE,
        maxLife: CONFIG.TRAIL_LIFE,
        size: 2 + Math.random() * 4,
        hue: 15 + Math.random() * 25,
      });
    }

    if (Math.random() < CONFIG.SIZZLE_CHANCE) {
      this.app.sound.playSizzle();
    }
  }

  undoStep() {
    if (!this.active || this.heatedThisStroke.length === 0) {
      // Try history undo
      if (this.grid.canUndo()) {
        this.grid.undo();
        this.app.onBeadChange();
      }
      return;
    }
    // Reverse the last stroke
    for (const { r, c, prevHeat } of this.heatedThisStroke) {
      this.grid.setHeat(r, c, prevHeat);
    }
    this.heatedThisStroke = [];
    this.app.onBeadChange();
  }

  finishStroke() {
    if (this.heatedThisStroke.length > 0) {
      this.grid.snapshot();
      this.app.onBeadChange();
    }
    this.heatedThisStroke = [];
  }

  finish() {
    this.grid.snapshot();
    this.grid.finalizeIroning();
    this.active = false;
    this.trails = [];
    this.app.sound.stopHum();
    this.app.sound.playIronFinish();
    this.app.input.setIroningMode(false);
    this.app.onIronStateChange();
    this.app.onBeadChange();
    this.grid.save();
  }

  cancel() {
    this.active = false;
    this.realisticEdges = false;
    this.trails = [];
    this.heatedThisStroke = [];
    this.maxHeat = 0;
    this.app.sound.stopHum();
    this.app.input.setIroningMode(false);
    this.app.onIronStateChange();
    this.app.onBeadChange();
  }

  update(dt) {
    if (!this.active) return;
    this.dirtyCounter++;

    // Update trail particles
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= dt;
      t.x += t.vx * dt * 0.06;
      t.y += t.vy * dt * 0.06;
      if (t.life <= 0) this.trails.splice(i, 1);
    }

    // Track max heat for temperature bar (O(1) incremental, not O(n²) scan)
    this.app.updateIronTemp(this.maxHeat);
  }
}
