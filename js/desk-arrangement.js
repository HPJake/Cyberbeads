// ========== DESK ARRANGEMENT MANAGER ==========
class DeskArrangementManager {
  constructor(app) {
    this.app = app;
    this.items = [];
    this._nextId = 1;
    this._layer = document.getElementById('desk-items-layer');
    this._menu = document.getElementById('desk-item-menu');
    this._activeItem = null;

    this._loadFromStorage();
    this._initUI();
  }

  // --- STORAGE ---
  _STORAGE_KEY = 'cyber-beads-desk-items';

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this._STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return;
      this._nextId = 1;
      for (const d of data) {
        d.id = this._nextId++;
        this.items.push(d);
        this._createDOM(d);
      }
    } catch (e) { /* ignore corrupt data */ }
  }

  _saveToStorage() {
    try {
      const data = this.items.map(it => ({
        type: it.type,
        dataUrl: it.dataUrl,
        saveData: it.saveData || null,
        renderMode: it.renderMode || 'flat-normal',
        x: it.x, y: it.y,
        scaleX: it.scaleX || 1, scaleY: it.scaleY || 1,
        zIndex: it.zIndex || 1,
      }));
      localStorage.setItem(this._STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* storage full */ }
  }

  // --- INIT ---
  _initUI() {
    const introModal = document.getElementById('desk-intro-modal');
    const fileInput = document.getElementById('desk-file-input');

    // Click "布置桌面" → show intro modal
    document.getElementById('btn-desk-arrange').addEventListener('click', () => {
      introModal.style.display = 'flex';
    });

    // Intro modal: close button
    document.getElementById('desk-intro-close-btn').addEventListener('click', () => {
      introModal.style.display = 'none';
    });

    // Intro modal: upload button → trigger file input + close modal
    document.getElementById('desk-intro-upload-btn').addEventListener('click', () => {
      fileInput.click();
      introModal.style.display = 'none';
    });

    // Intro modal: close on overlay click
    introModal.addEventListener('click', (e) => {
      if (e.target === introModal) {
        introModal.style.display = 'none';
      }
    });

    // File input: handle uploaded files
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(f => this._handleFile(f));
      e.target.value = '';
    });

    // Close context menu on outside click
    document.addEventListener('pointerdown', (e) => {
      if (!this._menu.contains(e.target)) {
        this._hideMenu();
      }
    });

    // Context menu actions
    this._menu.querySelectorAll('.desk-menu-item').forEach(el => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = el.dataset.action;
        if (!action || !this._activeItem) return;
        this._handleMenuAction(action, this._activeItem);
        this._hideMenu();
      });
    });
  }

  // --- FILE HANDLING ---
  _handleFile(file) {
    if (file.name.endsWith('.json')) {
      this._handleJSONFile(file);
    } else if (file.name.endsWith('.png')) {
      this._handlePNGFile(file);
    }
  }

  _handleJSONFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.v !== 1 && data.v !== 2) {
          alert('存档格式不兼容（版本不匹配）。');
          return;
        }
        if (!data.beads || data.beads.length === 0) {
          alert('存档文件中没有豆子数据。');
          return;
        }
        const dataUrl = this._renderJSONToDataURL(data, 'flat-normal');
        this._addItem({
          type: 'json',
          dataUrl: dataUrl,
          saveData: data,
          renderMode: 'flat-normal',
          x: 0, y: 0,
          scaleX: 1, scaleY: 1,
          zIndex: this._getNextZ(),
        });
      } catch (err) {
        alert('无法读取存档文件。');
      }
    };
    reader.onerror = () => { alert('读取文件失败。'); };
    reader.readAsText(file);
  }

  _handlePNGFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      this._addItem({
        type: 'png',
        dataUrl: dataUrl,
        saveData: null,
        renderMode: null,
        x: 0, y: 0,
        scaleX: 1, scaleY: 1,
        zIndex: this._getNextZ(),
      });
    };
    reader.onerror = () => { alert('读取图片失败。'); };
    reader.readAsDataURL(file);
  }

  // --- RENDERING JSON TO DATA URL ---
  _renderJSONToDataURL(data, mode) {
    const CELL = CONFIG.CELL_PX; // 40
    const rows = data.rows;
    const cols = data.cols;
    const fullW = cols * CELL;
    const fullH = rows * CELL;

    // Build gridMap for getBead lookups
    const gridMap = new Array(rows);
    for (let r = 0; r < rows; r++) {
      gridMap[r] = new Array(cols).fill(null);
    }
    for (const b of data.beads) {
      if (b.r < rows && b.c < cols) {
        // For flat modes, treat all beads as fully ironed so neighbor detection works
        const isFlat = mode !== 'bead-mode';
        gridMap[b.r][b.c] = {
          color: b.color,
          heat: isFlat ? 1.0 : (b.heat || 0),
          ironed: isFlat ? true : (b.ironed || false)
        };
      }
    }
    const tempGrid = {
      rows, cols,
      getBead(r, c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
        return gridMap[r][c];
      }
    };

    // Render at full resolution
    const bigCanvas = document.createElement('canvas');
    bigCanvas.width = fullW;
    bigCanvas.height = fullH;
    const ctx = bigCanvas.getContext('2d');

    const R = CONFIG.BEAD_RADIUS;
    const HOLE = CONFIG.HOLE_RADIUS_MAX;
    const ty = 0.9986;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bead = gridMap[r][c];
        if (!bead) continue;
        const color = bead.color;
        if (color === ERASER_COLOR) continue;
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;

        ctx.save();
        ctx.translate(cx, cy);

        if (mode === 'bead-mode') {
          // 3D cylinder bead
          const wallR = R * 0.62;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, 0, R, R * ty, 0, 0, Math.PI * 2);
          if (wallR > 0.5) ctx.ellipse(0, 0, wallR, wallR * ty, 0, Math.PI * 2, 0, true);
          ctx.fill();
          if (wallR > 0.5) {
            ctx.fillStyle = darkenColor(color, 0.22);
            ctx.beginPath();
            ctx.ellipse(0, 0, wallR, wallR * ty, 0, 0, Math.PI * 2);
            if (HOLE > 0.3) ctx.ellipse(0, 0, HOLE, HOLE * ty, 0, Math.PI * 2, 0, true);
            ctx.fill();
          }
        } else {
          // flat-normal or flat-realistic
          const halfCell = CELL / 2;
          const heat = (mode === 'flat-realistic') ? 1.0 : 0.92;
          // Context already translated to cell center, draw top-left at (-halfCell, -halfCell)
          try {
            drawIronedFlatCell(ctx, tempGrid, r, c, color, heat, mode === 'flat-realistic', -halfCell, -halfCell);
          } catch (err) {
            console.error(`Desk render: failed drawing bead at (${r}, ${c})`, err);
          }
        }

        ctx.restore();
      }
    }

    // Scale down to max 400px for reasonable data URL size
    const MAX_DIM = 400;
    const scale = Math.min(MAX_DIM / fullW, MAX_DIM / fullH, 1);
    if (scale < 1) {
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = Math.round(fullW * scale);
      smallCanvas.height = Math.round(fullH * scale);
      const sctx = smallCanvas.getContext('2d');
      sctx.drawImage(bigCanvas, 0, 0, smallCanvas.width, smallCanvas.height);
      return smallCanvas.toDataURL('image/png');
    }
    return bigCanvas.toDataURL('image/png');
  }

  // --- ADD / REMOVE ---
  _getNextZ() { return this._nextId * 10; }

  _addItem(itemDef) {
    itemDef.id = this._nextId++;
    const pos = this._randomPosition();
    itemDef.x = pos.x;
    itemDef.y = pos.y;
    this.items.push(itemDef);
    this._createDOM(itemDef);
    this._saveToStorage();
    this.app.sound.playTick();
  }

  _randomPosition() {
    const padding = 20;
    const maxW = Math.max(window.innerWidth - padding - 200, padding + 50);
    const minX = padding;

    // Measure avoidance zones
    const getRect = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top - 10, bottom: r.bottom + 10, left: r.left - 10, right: r.right + 10 };
    };

    const zones = [getRect('toolbar'), getRect('palette'), getRect('artwork-name-input')].filter(Boolean);
    const titleBottom = 60;

    let x, y, attempts = 0;
    do {
      x = minX + Math.random() * (maxW - minX);
      y = titleBottom + Math.random() * (window.innerHeight - titleBottom - 120);
      attempts++;
    } while (attempts < 30 && zones.some(z => y > z.top && y < z.bottom && x > z.left && x < z.right));

    return { x, y };
  }

  _createDOM(itemDef) {
    const el = document.createElement('div');
    el.className = 'desk-canvas-item';
    el.dataset.itemId = itemDef.id;
    el.style.left = itemDef.x + 'px';
    el.style.top = itemDef.y + 'px';
    el.style.zIndex = itemDef.zIndex;

    const img = document.createElement('img');
    img.src = itemDef.dataUrl;
    img.draggable = false;

    // Set initial visual size: cap at 200px width via transform scale
    const maxInitW = 200;
    const applyInitScale = () => {
      if (img.naturalWidth && img.naturalWidth > 0) {
        const s = Math.min(1, maxInitW / img.naturalWidth);
        itemDef.scaleX = s;
        itemDef.scaleY = s;
        el.style.transform = `scale(${s}, ${s})`;
      }
    };
    img.onload = applyInitScale;
    // Also apply immediately in case image is cached
    if (img.complete) applyInitScale();

    el.appendChild(img);
    // transform already set in applyInitScale, but ensure it's set
    if (!itemDef.scaleX) {
      el.style.transform = `scale(1, 1)`;
      el.style.transformOrigin = 'top left';
      itemDef.scaleX = 1;
      itemDef.scaleY = 1;
    }
    el.style.transformOrigin = 'top left';

    // --- Pointer events ---
    let dragging = false;
    let moved = false;
    let startX, startY, startLeft, startTop;
    let longPressTimer = null;
    let longPressFired = false;

    const clearLongPress = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      this._bringToTop(itemDef.id);

      // Start long-press timer for touch
      longPressFired = false;
      clearLongPress();
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        this._showMenu(itemDef, e.clientX, e.clientY);
      }, 500);

      dragging = true;
      moved = false;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(el.style.left) || 0;
      startTop = parseFloat(el.style.top) || 0;
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        clearLongPress(); // cancel long-press if moved
      }
      if (longPressFired) return; // don't move if menu is showing
      el.style.left = (startLeft + dx) + 'px';
      el.style.top = (startTop + dy) + 'px';
      itemDef.x = parseFloat(el.style.left);
      itemDef.y = parseFloat(el.style.top);
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      clearLongPress();
      if (moved) this._saveToStorage();
    };

    el.addEventListener('pointerup', (e) => {
      try { el.releasePointerCapture(e.pointerId); } catch (ex) {}
      endDrag();
    });

    el.addEventListener('pointerleave', () => { endDrag(); });
    el.addEventListener('lostpointercapture', () => { endDrag(); });

    // Right-click context menu
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearLongPress();
      this._showMenu(itemDef, e.clientX, e.clientY);
    });

    // Wheel zoom
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * 0.001;
      let sx = itemDef.scaleX || 1;
      let sy = itemDef.scaleY || 1;
      const newScale = clamp(sx + delta * sx, 0.5, 3.0);
      itemDef.scaleX = newScale;
      itemDef.scaleY = newScale;
      el.style.transform = `scale(${newScale}, ${newScale})`;
      el.style.transformOrigin = 'top left';
      this._saveToStorage();
    }, { passive: false });

    // Touch pinch zoom
    let pinchDist = 0, pinchStartScale = 1;
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        clearLongPress();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist = Math.hypot(dx, dy);
        pinchStartScale = itemDef.scaleX || 1;
      }
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinchDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = clamp(pinchStartScale * (dist / pinchDist), 0.5, 3.0);
        itemDef.scaleX = newScale;
        itemDef.scaleY = newScale;
        el.style.transform = `scale(${newScale}, ${newScale})`;
        el.style.transformOrigin = 'top left';
      }
    }, { passive: false });
    el.addEventListener('touchend', () => { pinchDist = 0; });

    this._layer.appendChild(el);
    itemDef._el = el;
  }

  // --- Z-ORDER ---
  _bringToTop(id) {
    const item = this.items.find(it => it.id === id);
    if (!item) return;
    const maxZ = Math.max(...this.items.map(it => it.zIndex || 0), 0);
    item.zIndex = Math.min(maxZ + 1, 19); // cap below desktop-ref-window (z-index:20)
    if (item._el) item._el.style.zIndex = item.zIndex;
    this._saveToStorage();
  }

  _bringToFront(id) {
    const item = this.items.find(it => it.id === id);
    if (!item) return;
    const maxZ = Math.max(...this.items.map(it => it.zIndex || 0), 0);
    item.zIndex = Math.min(maxZ + 1, 19);
    if (item._el) item._el.style.zIndex = item.zIndex;
    this._saveToStorage();
  }

  _sendToBack(id) {
    const minZ = Math.min(...this.items.map(it => it.zIndex || 0), 0);
    const item = this.items.find(it => it.id === id);
    if (!item) return;
    item.zIndex = minZ - 1;
    if (item._el) item._el.style.zIndex = item.zIndex;
    this._saveToStorage();
  }

  _removeItem(id) {
    const idx = this.items.findIndex(it => it.id === id);
    if (idx < 0) return;
    const item = this.items[idx];
    if (item._el) item._el.remove();
    this.items.splice(idx, 1);
    this._saveToStorage();
    this.app.sound.playTick();
  }

  // --- CONTEXT MENU ---
  _showMenu(itemDef, x, y) {
    this._activeItem = itemDef;

    // Show/hide menu items based on type
    const beadActions = ['bead-mode', 'flat-normal', 'flat-realistic'];
    this._menu.querySelectorAll('.desk-menu-item').forEach(el => {
      const action = el.dataset.action;
      if (!action) return;
      if (itemDef.type === 'png' && beadActions.includes(action)) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    });

    // Hide dividers that would be adjacent to hidden items or each other
    // Simple approach: if all bead actions hidden, hide first divider too
    if (itemDef.type === 'png') {
      const dividerAfterBead = this._menu.querySelector('.desk-menu-item[data-action="bead-mode"]')
        ?.nextElementSibling?.nextElementSibling?.nextElementSibling; // 3 items then divider
      // Actually just hide the first divider for PNG
      const dividers = this._menu.querySelectorAll('.desk-menu-divider');
      if (dividers.length >= 1) dividers[0].style.display = 'none';
    } else {
      const dividers = this._menu.querySelectorAll('.desk-menu-divider');
      if (dividers.length >= 1) dividers[0].style.display = '';
    }

    // Position menu on-screen
    const menuW = 170;
    const menuH = 240;
    let mx = x, my = y;
    if (mx + menuW > window.innerWidth - 10) mx = window.innerWidth - menuW - 10;
    if (my + menuH > window.innerHeight - 10) my = window.innerHeight - menuH - 10;
    if (mx < 10) mx = 10;
    if (my < 10) my = 10;
    this._menu.style.left = mx + 'px';
    this._menu.style.top = my + 'px';
    this._menu.classList.add('active');
  }

  _hideMenu() {
    this._menu.classList.remove('active');
    this._activeItem = null;
  }

  _handleMenuAction(action, itemDef) {
    switch (action) {
      case 'bead-mode':
        this._changeRenderMode(itemDef, 'bead-mode');
        break;
      case 'flat-normal':
        this._changeRenderMode(itemDef, 'flat-normal');
        break;
      case 'flat-realistic':
        this._changeRenderMode(itemDef, 'flat-realistic');
        break;
      case 'to-front':
        this._bringToFront(itemDef.id);
        break;
      case 'to-back':
        this._sendToBack(itemDef.id);
        break;
      case 'remove':
        this._removeItem(itemDef.id);
        break;
    }
  }

  _changeRenderMode(itemDef, mode) {
    if (itemDef.type !== 'json') return;
    if (!itemDef.saveData) return;
    itemDef.renderMode = mode;
    try {
      itemDef.dataUrl = this._renderJSONToDataURL(itemDef.saveData, mode);
    } catch (err) {
      console.error('Desk render: _renderJSONToDataURL failed for mode', mode, err);
      return;
    }
    if (itemDef._el) {
      const img = itemDef._el.querySelector('img');
      if (img) img.src = itemDef.dataUrl;
    }
    this._saveToStorage();
  }
}
