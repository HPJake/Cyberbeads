// ========== CONFIGURATION ==========
const CONFIG = {
  DEFAULT_GRID: 15,
  MIN_GRID: 5,
  MAX_GRID: 100,
  CELL_PX: 40,
  BEAD_RADIUS: 19.5,
  HOLE_RADIUS_MAX: 8.0,
  EDGE_BULGE: 6,    // max outward arc bulge (px) for realistic wavy edges
  HEAT_RATE: 0.045,
  HEAT_ADJACENT: 0.025,
  COOL_RATE: 0.10,
  PEN_MAX_CELLS: 50,
  HISTORY_MAX: 60,
  TOOL_PEEK: 0.78,
  TOOL_EASE: 0.08,
  CLOTH_ALPHA: 0.32,
  TRAIL_LIFE: 700,
  TRAIL_PER_FRAME: 0.55,
  SIZZLE_CHANCE: 0.18,
  HUM_VOLUME: 0.10,
  BEAD_DIRTY_THROTTLE: 3,
  BEAD_DRAW_INTERVAL: 30,   // min ms between drawAllBeads calls (throttle to ~33fps)
  SAVE_DEBOUNCE: 600,
  EXPORT_CELL_PX: 64,
  MAX_FRAME_DT: 50,
};
