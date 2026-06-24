// ========== APP ORCHESTRATOR ==========
class App {
  constructor() {
    this.grid = new GridModel(CONFIG.DEFAULT_GRID, CONFIG.DEFAULT_GRID);
    this.sound = new SoundEngine();
    this.renderer = new Renderer(document.getElementById('canvas-container'), this.grid);
    this.toolDrawer = new ToolDrawer(this);
    this.input = new InputManager(this);
    this.ironingSys = new IroningSystem(this);
    this.renderer.ironingSys = this.ironingSys;

    this.activeColor = PALETTE[0].hex;
    this.penInkLevel = 1;
    this.beadDirty = true;
    this.lastFrameTime = 0;
    this.saveTimeout = null;

    this._initUI();
    this._initKeyboard();
    this._initZoom();

    // Desktop arrangement (decorate with saved bead patterns)
    this.deskArranger = new DeskArrangementManager(this);

    // Check for existing save
    const savePreview = this._getSavePreview();
    if (savePreview && savePreview.beads && savePreview.beads.length > 0) {
      // Show continue modal — completion handled below
      this._showContinueModal(savePreview);
    } else {
      this._startFresh();
    }

    document.addEventListener('pointerdown', () => this.sound.ensure(), { once: true });
    document.addEventListener('keydown', () => this.sound.ensure(), { once: true });

    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this._gameLoop(t));

  }

  _initUI() {
    // Palette dropdown
    this._buildPaletteDropdown();

    // Build initial swatches
    this._buildSwatches();

    // Custom color picker
    this._initColorPicker();

    // Buttons
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.redo());
    document.getElementById('btn-clear').addEventListener('click', () => this._showClearModal());
    document.getElementById('btn-iron').addEventListener('click', () => this._showIronModal());
    document.getElementById('btn-export').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('export-menu').classList.toggle('active');
    });
    document.querySelectorAll('.export-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.getElementById('export-menu').classList.remove('active');
        if (e.target.dataset.mode === 'blueprint') {
          this._showBlueprintModal();
        } else {
          this._showExportPreview(e.target.dataset.mode);
        }
      });
    });
    document.addEventListener('click', (e) => {
      document.getElementById('export-menu').classList.remove('active');
      document.getElementById('save-menu').classList.remove('active');
      // Blur artwork name input when clicking elsewhere
      const nameInput = document.getElementById('artwork-name-input');
      if (nameInput && e.target !== nameInput && !nameInput.contains(e.target)) {
        nameInput.blur();
      }
    });
    // Save on artwork name change
    const nameInput = document.getElementById('artwork-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', () => this._debounceSave());
    }

    // Save management dropdown
    document.getElementById('btn-save-mgmt').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('export-menu').classList.remove('active');
      document.getElementById('save-menu').classList.toggle('active');
    });
    document.querySelectorAll('#save-menu .save-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.getElementById('save-menu').classList.remove('active');
        const action = e.target.dataset.action || e.target.closest('.save-opt').dataset.action;
        if (action === 'export') this._exportSaveFile();
        else if (action === 'import') this._importSaveFile();
        else if (action === 'delete') this._confirmDeleteSave();
      });
    });

    // Reference image import
    this._initReferenceSystem();

    // Ruler toggle
    document.getElementById('ruler-toggle').addEventListener('change', () => {
      this.renderer.showRulers = document.getElementById('ruler-toggle').checked;
      this.renderer.resize();
      this.renderer.drawPegboard();
      this.beadDirty = true;
      this._positionSideControls();
      if (this._drawReferenceUnderlay) this._drawReferenceUnderlay();
    });

    // Grid slider
    const slider = document.getElementById('grid-slider');
    const sizeLabel = document.getElementById('grid-size-val');
    slider.addEventListener('input', () => {
      const v = Math.round(slider.value / 5) * 5;
      slider.value = v;
      sizeLabel.textContent = v;
    });
    document.getElementById('btn-resize').addEventListener('click', () => {
      const newSize = parseInt(slider.value);
      if (newSize === this.grid.rows && newSize === this.grid.cols) return;
      this._pendingResize = newSize;
      this._showResizeModal();
    });

    // Mute
    document.getElementById('mute-btn').addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      const btn = document.getElementById('mute-btn');
      btn.textContent = muted ? '🔇' : '🔊';
      btn.classList.toggle('muted', muted);
    });

    // Ironing toolbar
    document.getElementById('btn-iron-exit').addEventListener('click', () => {
      if (this.ironingSys.active) {
        this.ironingSys.finishStroke();
        this.ironingSys.cancel();
      }
    });
    document.getElementById('btn-iron-finish').addEventListener('click', () => {
      if (this.ironingSys.active) {
        this.ironingSys.finishStroke();
        this.ironingSys.finish();
      }
    });
    document.getElementById('btn-iron-undo').addEventListener('click', () => {
      if (this.ironingSys.active) {
        this.ironingSys.finishStroke();
        this.ironingSys.undoStep();
      }
    });
    document.getElementById('btn-realistic').addEventListener('click', () => {
      if (!this.ironingSys.active) return;
      this.ironingSys.realisticEdges = !this.ironingSys.realisticEdges;
      const btn = document.getElementById('btn-realistic');
      btn.classList.toggle('primary', this.ironingSys.realisticEdges);
      btn.textContent = this.ironingSys.realisticEdges ? '✨ 逼真 (开)' : '✨ 逼真';
      this.beadDirty = true;
    });

    // Modal buttons
    document.getElementById('iron-confirm').addEventListener('click', () => {
      const allow = document.getElementById('iron-allow-reheat').checked;
      document.getElementById('iron-modal').classList.remove('active');
      this.ironingSys.start(allow);
    });
    document.getElementById('iron-cancel').addEventListener('click', () => {
      document.getElementById('iron-modal').classList.remove('active');
    });

    document.getElementById('clear-confirm').addEventListener('click', () => {
      document.getElementById('clear-modal').classList.remove('active');
      this.grid.snapshot();
      this.grid.clear();
      this.onBeadChange();
      this.grid.save();
      this.sound.playTick();
    });
    document.getElementById('clear-cancel').addEventListener('click', () => {
      document.getElementById('clear-modal').classList.remove('active');
    });

    document.getElementById('resize-confirm').addEventListener('click', () => {
      document.getElementById('resize-modal').classList.remove('active');
      const s = this._pendingResize || CONFIG.DEFAULT_GRID;
      this.grid.resize(s, s);
      this.ironingSys.cancel();
      this.renderer.resize();
      this.renderer.drawPegboard();
      this.renderer.drawAllBeads();
      this.beadDirty = true;
      this.grid.snapshot();
      this.grid.save();
      if (this._drawReferenceUnderlay) { this._drawReferenceUnderlay(); this._positionSideControls(); }
      document.getElementById('grid-size-val').textContent = s;
      document.getElementById('grid-slider').value = s;
      this.sound.playTick();
      this._updateUndoRedoButtons();
    });
    document.getElementById('resize-cancel').addEventListener('click', () => {
      document.getElementById('resize-modal').classList.remove('active');
      document.getElementById('grid-slider').value = this.grid.rows;
      document.getElementById('grid-size-val').textContent = this.grid.rows;
    });
  }

  _initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this.redo();
      }
    });
  }

  _initColorPicker() {
    this.pickerHue = 0;
    this.pickerSat = 1;
    this.pickerBri = 1;
    this.pickerOpen = false;

    const panel = document.getElementById('color-picker-panel');
    const field = document.getElementById('color-field');
    const fieldCursor = document.getElementById('color-field-cursor');
    const hueSlider = document.getElementById('hue-slider');
    const hueCursor = document.getElementById('hue-slider-cursor');
    const previewOld = document.getElementById('color-preview-old');
    const previewNew = document.getElementById('color-preview-new');
    const applyBtn = document.getElementById('picker-apply-btn');

    // Open/close picker
    document.getElementById('btn-custom-color').addEventListener('click', () => {
      this.pickerOpen = !this.pickerOpen;
      panel.classList.toggle('active', this.pickerOpen);
      if (this.pickerOpen) {
        // Position below the custom color button
        const btnRect = document.getElementById('btn-custom-color').getBoundingClientRect();
        panel.style.left = Math.max(10, btnRect.left - 80) + 'px';
        panel.style.top = (btnRect.bottom + 6) + 'px';
        // Init picker from current color
        this._pickerFromHex(this.activeColor);
        this._updatePickerUI(field, fieldCursor, hueSlider, hueCursor, previewOld, previewNew);
      }
    });

    // Hue slider interaction
    const onHueMove = (e) => {
      const rect = hueSlider.getBoundingClientRect();
      const y = clamp(e.clientY - rect.top, 0, rect.height);
      this.pickerHue = y / rect.height;
      this._updatePickerUI(field, fieldCursor, hueSlider, hueCursor, previewOld, previewNew);
    };
    hueSlider.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hueSlider.setPointerCapture(e.pointerId);
      onHueMove(e);
    });
    hueSlider.addEventListener('pointermove', (e) => {
      if (e.buttons) onHueMove(e);
    });

    // Color field interaction
    const onFieldMove = (e) => {
      const rect = field.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const y = clamp(e.clientY - rect.top, 0, rect.height);
      this.pickerSat = x / rect.width;
      this.pickerBri = 1 - y / rect.height;
      this._updatePickerUI(field, fieldCursor, hueSlider, hueCursor, previewOld, previewNew);
    };
    field.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      field.setPointerCapture(e.pointerId);
      onFieldMove(e);
    });
    field.addEventListener('pointermove', (e) => {
      if (e.buttons) onFieldMove(e);
    });

    // Apply button
    applyBtn.addEventListener('click', () => {
      const hex = this._pickerToHex();
      this._addCustomColor(hex);
      this.pickerOpen = false;
      panel.classList.remove('active');
    });

    // MARD code confirm button
    const mardInput = document.getElementById('mard-code-input');
    const mardConfirmBtn = document.getElementById('mard-confirm-btn');

    const applyMardCode = () => {
      const code = mardInput.value.trim().toUpperCase();
      if (!code) return;
      const hex = MARD_COLORS[code];
      if (hex) {
        // Update picker to show this color (don't apply yet)
        this._pickerFromHex(hex);
        this._updatePickerUI(field, fieldCursor, hueSlider, hueCursor, previewOld, previewNew);
        mardInput.style.borderColor = '#DDD0B8';
      } else {
        // Flash input red
        mardInput.style.borderColor = '#E74C3C';
        mardInput.style.transition = 'border-color 0.15s';
        setTimeout(() => {
          mardInput.style.borderColor = '#DDD0B8';
          setTimeout(() => { mardInput.style.transition = ''; }, 300);
        }, 600);
      }
    };

    mardConfirmBtn.addEventListener('click', applyMardCode);
    mardInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyMardCode();
    });

    // Screen color picker (EyeDropper API: Chrome 95+, Edge 95+)
    const eyedropperBtn = document.getElementById('picker-eyedropper-btn');
    if (typeof EyeDropper === 'undefined') {
      eyedropperBtn.disabled = true;
      eyedropperBtn.title = '屏幕取色需要 Chrome 95+ 或 Edge 95+';
    } else {
      eyedropperBtn.addEventListener('click', async () => {
        try {
          const eyeDropper = new EyeDropper();
          const result = await eyeDropper.open();
          const pickedHex = result.sRGBHex;
          // Find the closest MARD 291 color
          const code = findClosestMardCode(pickedHex);
          if (code) {
            const hex = MARD_COLORS[code];
            mardInput.value = code;
            this._pickerFromHex(hex);
            this._updatePickerUI(field, fieldCursor, hueSlider, hueCursor, previewOld, previewNew);
          }
        } catch (e) {
          // User cancelled (AbortError) — silently ignore
          if (e.name !== 'AbortError') {
            console.warn('EyeDropper error:', e);
          }
        }
      });
    }
  }

  _pickerFromHex(hex) {
    if (hex === ERASER_COLOR) hex = '#FFFFFF';
    const c = parseHex(hex);
    if (!c) { this.pickerHue = 0; this.pickerSat = 0; this.pickerBri = 1; return; }
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    this.pickerBri = max;
    const d = max - min;
    this.pickerSat = max === 0 ? 0 : d / max;
    if (d === 0) this.pickerHue = 0;
    else if (max === r) this.pickerHue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) this.pickerHue = ((b - r) / d + 2) / 6;
    else this.pickerHue = ((r - g) / d + 4) / 6;
  }

  _pickerToHex() {
    const h = this.pickerHue * 6;
    const s = this.pickerSat;
    const v = this.pickerBri;
    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;
    let r, g, b;
    const hi = Math.floor(h);
    if (hi === 0) { r = c; g = x; b = 0; }
    else if (hi === 1) { r = x; g = c; b = 0; }
    else if (hi === 2) { r = 0; g = c; b = x; }
    else if (hi === 3) { r = 0; g = x; b = c; }
    else if (hi === 4) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  _updatePickerUI(field, fieldCursor, hueSlider, hueCursor, previewOld, previewNew) {
    // Color field background
    const hueColor = this._hsvToRgbStr(this.pickerHue, 1, 1);
    field.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`;
    // Cursors
    fieldCursor.style.left = (this.pickerSat * 100) + '%';
    fieldCursor.style.top = ((1 - this.pickerBri) * 100) + '%';
    hueCursor.style.top = (this.pickerHue * 100) + '%';
    hueSlider.style.background = `linear-gradient(to bottom, red, yellow, lime, cyan, blue, magenta, red)`;
    // Previews
    previewOld.style.background = this.activeColor === ERASER_COLOR ? '#F5F0E8' : this.activeColor;
    previewNew.style.background = this._pickerToHex();
  }

  _hsvToRgbStr(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = v - c;
    let r, g, b;
    const hi = Math.floor(h * 6);
    if (hi === 0) { r = c; g = x; b = 0; }
    else if (hi === 1) { r = x; g = c; b = 0; }
    else if (hi === 2) { r = 0; g = c; b = x; }
    else if (hi === 3) { r = 0; g = x; b = c; }
    else if (hi === 4) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return `rgb(${Math.round((r+m)*255)},${Math.round((g+m)*255)},${Math.round((b+m)*255)})`;
  }

  _initZoom() {
    this.zoomLevel = 1.0;
    const container = document.getElementById('canvas-container');
    const indicator = document.getElementById('zoom-indicator');
    let hideTimeout = null;
    let initialPinchDist = 0;
    let initialZoom = 1;

    container.style.transformOrigin = '50% 0%';

    const showIndicator = () => {
      indicator.textContent = Math.round(this.zoomLevel * 100) + '%';
      indicator.classList.add('visible');
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => indicator.classList.remove('visible'), 1500);
    };

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      this.zoomLevel = clamp(this.zoomLevel + delta * this.zoomLevel, 0.5, 3.0);
      container.style.transform = `scale(${this.zoomLevel})`;
      showIndicator();
      this._positionSideControls();
      if (this._debounceSave) this._debounceSave();
    }, { passive: false });

    // Touch pinch-to-zoom
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
        initialZoom = this.zoomLevel;
      }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / initialPinchDist;
        this.zoomLevel = clamp(initialZoom * scale, 0.5, 3.0);
        container.style.transform = `scale(${this.zoomLevel})`;
        showIndicator();
        this._positionSideControls();
        if (this._debounceSave) this._debounceSave();
      }
    }, { passive: false });

    showIndicator();
  }

  _selectColor(hex, swatchEl) {
    this.activeColor = hex;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    if (swatchEl) swatchEl.classList.add('selected');
    this.toolDrawer.showColorPreview(hex);
  }

  _buildSwatches() {
    const swatchContainer = document.getElementById('palette-swatches');
    swatchContainer.innerHTML = '';

    const palette = PALETTE_SETS[ACTIVE_PALETTE_KEY];
    const colors = palette.colors;

    if (colors.length === 0) {
      // Custom palette — empty state
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:11px;color:#B0A090;padding:4px 8px;';
      hint.textContent = '使用下方🎨自选色添加颜色';
      swatchContainer.appendChild(hint);
    }

    colors.forEach((c, i) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      if (c.hex === this.activeColor) {
        swatch.classList.add('selected');
      } else if (i === 0 && !document.querySelector('.color-swatch.selected')) {
        swatch.classList.add('selected');
        this.activeColor = c.hex;
      }
      swatch.style.background = c.hex;
      const mardCode = MARD_HEX_TO_CODE[c.hex.toUpperCase()] || findClosestMardCode(c.hex);
      swatch.title = mardCode ? `${c.name} · ${mardCode}` : c.name;
      swatch.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._selectColor(c.hex, swatch);
      });
      // For custom palette, long-press or right-click to remove
      if (ACTIVE_PALETTE_KEY === 'custom') {
        swatch.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const idx = PALETTE_SETS.custom.colors.indexOf(c);
          if (idx >= 0) {
            PALETTE_SETS.custom.colors.splice(idx, 1);
            this._buildSwatches();
            this._debounceSave();
          }
        });
      }
      swatchContainer.appendChild(swatch);
    });

    // Eraser swatch (always present, appended at end)
    const eraser = document.createElement('div');
    eraser.className = 'color-swatch eraser';
    eraser.title = '擦除';
    eraser.style.background = '#F5F0E8';
    eraser.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._selectColor(ERASER_COLOR, eraser);
    });
    swatchContainer.appendChild(eraser);
  }

  _buildPaletteDropdown() {
    const currentEl = document.getElementById('palette-current');
    const dropdownEl = document.getElementById('palette-dropdown');

    // Current display
    const activeSet = PALETTE_SETS[ACTIVE_PALETTE_KEY];
    currentEl.innerHTML = activeSet.label + ' <span class="arrow">▼</span>';

    // Set up toggle + outside-close listeners only once (called multiple
    // times from init & restore-save flows, otherwise listeners stack up
    // and toggling twice = no visible change).
    if (!this._paletteDropdownBound) {
      this._paletteDropdownBound = true;

      currentEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdownEl.classList.toggle('open');
      });

      // Close on outside click
      document.addEventListener('pointerdown', (e) => {
        const selector = document.getElementById('palette-selector');
        if (!selector.contains(e.target)) {
          dropdownEl.classList.remove('open');
        }
      });
    }

    // Options
    dropdownEl.innerHTML = '';
    Object.entries(PALETTE_SETS).forEach(([key, set]) => {
      const opt = document.createElement('div');
      opt.className = 'palette-option';
      if (key === ACTIVE_PALETTE_KEY) opt.classList.add('active');
      opt.textContent = set.label;
      opt.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._switchPalette(key);
        dropdownEl.classList.remove('open');
      });
      dropdownEl.appendChild(opt);
    });
  }

  _switchPalette(key) {
    ACTIVE_PALETTE_KEY = key;
    // Update dropdown current text and active state
    const activeSet = PALETTE_SETS[key];
    document.getElementById('palette-current').innerHTML = activeSet.label + ' <span class="arrow">▼</span>';
    document.querySelectorAll('.palette-option').forEach(o => {
      o.classList.toggle('active', o.textContent === activeSet.label);
    });
    if (key === 'custom' && PALETTE_SETS.custom.colors.length > 0) {
      this.activeColor = PALETTE_SETS.custom.colors[0].hex;
    }
    this._buildSwatches();
    this._debounceSave();
  }

  _addCustomColor(hex) {
    // Check if already exists
    if (PALETTE_SETS.custom.colors.some(c => c.hex.toUpperCase() === hex.toUpperCase())) return;
    const name = hex;
    PALETTE_SETS.custom.colors.push({ name, hex });
    if (ACTIVE_PALETTE_KEY === 'custom') {
      this._buildSwatches();
    }
    // Auto-switch to custom palette and select this color
    if (ACTIVE_PALETTE_KEY !== 'custom') {
      this._switchPalette('custom');
    }
    this.activeColor = hex;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    // Find and highlight the matching swatch
    const swatches = document.querySelectorAll('#palette-swatches .color-swatch');
    swatches.forEach(s => {
      if (s.style.background.toUpperCase() === hex.toUpperCase()) {
        s.classList.add('selected');
      }
    });
    this.toolDrawer.showColorPreview(hex);
    this._debounceSave();
  }

  _showIronModal() {
    if (!this.grid.hasAnyBead()) {
      alert('画布上还没有豆子，请先放置豆子再进行熨烫。');
      return;
    }
    if (this.grid.locked) {
      alert('画布已定形锁定，无法再次熨烫。');
      return;
    }
    document.getElementById('iron-allow-reheat').checked = true;
    document.getElementById('iron-modal').classList.add('active');
    this.sound.playTick();
  }

  _showClearModal() {
    if (!this.grid.hasAnyBead()) return;
    document.getElementById('clear-modal').classList.add('active');
    this.sound.playTick();
  }

  _showResizeModal() {
    document.getElementById('resize-modal').classList.add('active');
    this.sound.playTick();
  }

  onToolChange(tool) {
    this.sound.playTick();
  }

  onBeadChange() {
    this.beadDirty = true;
    this._debounceSave();
    this._updateUndoRedoButtons();
    if (!this.ironingSys.active) {
      document.getElementById('btn-iron').disabled = this.grid.locked;
    }
  }

  onIronStateChange() {
    const active = this.ironingSys.active;
    document.getElementById('iron-toolbar').classList.toggle('active', active);
    document.getElementById('toolbar').style.display = active ? 'none' : 'flex';
    document.getElementById('palette').style.display = active ? 'none' : 'flex';
    document.getElementById('tool-drawer').style.display = active ? 'none' : 'flex';
    document.getElementById('btn-iron').disabled = active || this.grid.locked;
    this.toolDrawer.setEnabled(!active);
    if (!active) {
      document.getElementById('iron-temp-fill').style.width = '0%';
      const btn = document.getElementById('btn-realistic');
      if (this.ironingSys.realisticEdges) {
        btn.classList.add('primary');
        btn.textContent = '✨ 逼真中';
      } else {
        btn.classList.remove('primary');
        btn.textContent = '✨ 逼真';
      }
    }
    this.beadDirty = true;
  }

  updateIronTemp(heat) {
    document.getElementById('iron-temp-fill').style.width = (heat * 100) + '%';
  }

  _updateUndoRedoButtons() {
    document.getElementById('btn-undo').disabled = !this.grid.canUndo();
    document.getElementById('btn-redo').disabled = !this.grid.canRedo();
  }

  undo() {
    if (this.ironingSys.active) {
      this.ironingSys.finishStroke();
      this.ironingSys.undoStep();
    } else {
      if (this.grid.undo()) {
        this.onBeadChange();
        this.sound.playTick();
      }
    }
  }

  redo() {
    if (this.ironingSys.active) return;
    if (this.grid.redo()) {
      this.onBeadChange();
      this.sound.playTick();
    }
  }

  _debounceSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      const artNameInput = document.getElementById('artwork-name-input');
      this.grid.save({
        customColors: PALETTE_SETS.custom.colors,
        artworkName: artNameInput ? artNameInput.value : '',
        activePaletteKey: ACTIVE_PALETTE_KEY,
        activeColor: this.activeColor,
        tool: this.toolDrawer ? this.toolDrawer.getTool() : 'tweezers',
        zoomLevel: this.zoomLevel,
      });
    }, CONFIG.SAVE_DEBOUNCE);
  }

  _getSavePreview() {
    try {
      const raw = localStorage.getItem('cyber-beads-save');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.v !== 1 && data.v !== 2) return null;
      return data;
    } catch (e) { return null; }
  }

  _restoreAppState(data) {
    if (!data || (data.v !== 1 && data.v !== 2)) return false;

    // Restore grid
    this.grid.load(); // already reads from localStorage

    // Restore app state (v=2 only)
    if (data.v === 2 && data.app) {
      const app = data.app;
      // Custom palette
      PALETTE_SETS.custom.colors = (app.customColors || []).map(c => ({ name: c.name || c.hex, hex: c.hex }));
      // Artwork name
      const nameInput = document.getElementById('artwork-name-input');
      if (nameInput && app.artworkName) nameInput.value = app.artworkName;
      // Active palette
      if (app.activePaletteKey && PALETTE_SETS[app.activePaletteKey]) {
        ACTIVE_PALETTE_KEY = app.activePaletteKey;
      }
      // Active color
      if (app.activeColor) this.activeColor = app.activeColor;
      // Tool
      if (app.tool && this.toolDrawer) this.toolDrawer.selectTool(app.tool);
      // Zoom
      if (app.zoomLevel != null) {
        this.zoomLevel = app.zoomLevel;
        const container = document.getElementById('canvas-container');
        if (container) container.style.transform = `scale(${this.zoomLevel})`;
      }
    }

    // Rebuild UI
    this._buildSwatches();
    this._buildPaletteDropdown();
    if (ACTIVE_PALETTE_KEY) {
      const activeSet = PALETTE_SETS[ACTIVE_PALETTE_KEY];
      document.getElementById('palette-current').innerHTML = activeSet.label + ' <span class="arrow">▼</span>';
    }
    this.toolDrawer.showColorPreview(this.activeColor);

    // Update grid slider
    const slider = document.getElementById('grid-slider');
    const sizeLabel = document.getElementById('grid-size-val');
    if (slider) slider.value = this.grid.rows;
    if (sizeLabel) sizeLabel.textContent = this.grid.rows;

    return true;
  }

  _startFresh() {
    this.grid.snapshot();
    this.renderer.resize();
    this.renderer.drawPegboard();
    this.renderer.drawAllBeads();
    this._updateUndoRedoButtons();
    this._positionSideControls();
    this.toolDrawer.selectTool('tweezers');
    this.toolDrawer.showColorPreview(this.activeColor);
  }

  _showContinueModal(savePreview) {
    const modal = document.getElementById('continue-modal');
    const nameEl = document.getElementById('continue-artwork-name');
    const timeEl = document.getElementById('continue-save-time');

    const appData = savePreview.app || {};
    const artName = appData.artworkName || '（未命名作品）';
    const beadCount = savePreview.beads ? savePreview.beads.length : 0;
    nameEl.textContent = `「${artName}」 ${savePreview.rows}×${savePreview.cols} · ${beadCount}颗豆子`;

    const ts = savePreview.ts || Date.now();
    timeEl.textContent = '保存时间：' + new Date(ts).toLocaleString('zh-CN');

    const doContinue = () => {
      modal.classList.remove('active');
      // The save data is already in localStorage, so grid.load() will read it
      this._restoreAppState(savePreview);
      this.renderer.resize();
      this.renderer.drawPegboard();
      this.renderer.drawAllBeads();
      this._updateUndoRedoButtons();
      this.beadDirty = false;
      if (this._drawReferenceUnderlay) { this._drawReferenceUnderlay(); this._positionSideControls(); }
      this.sound.playTick();
    };

    const doFresh = () => {
      modal.classList.remove('active');
      this._startFresh();
      this.sound.playTick();
    };

    document.getElementById('continue-yes').onclick = doContinue;
    document.getElementById('continue-no').onclick = doFresh;
    document.getElementById('continue-delete').onclick = () => {
      try { localStorage.removeItem('cyber-beads-save'); } catch (e) {}
      doFresh();
    };

    modal.classList.add('active');
  }

  _buildSaveData() {
    const beads = [];
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++) {
        const b = this.grid.grid[r][c];
        if (b) beads.push({ r, c, color: b.color, heat: b.heat, ironed: b.ironed });
      }
    const artNameInput = document.getElementById('artwork-name-input');
    return {
      v: 2,
      rows: this.grid.rows,
      cols: this.grid.cols,
      beads,
      locked: this.grid.locked,
      history: this.grid.history.serialize(),
      app: {
        customColors: PALETTE_SETS.custom.colors.map(c => ({ name: c.name, hex: c.hex })),
        artworkName: artNameInput ? artNameInput.value : '',
        activePaletteKey: ACTIVE_PALETTE_KEY,
        activeColor: this.activeColor,
        tool: this.toolDrawer ? this.toolDrawer.getTool() : 'tweezers',
        zoomLevel: this.zoomLevel,
      },
      ts: Date.now(),
    };
  }

  _exportSaveFile() {
    const data = this._buildSaveData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const artName = document.getElementById('artwork-name-input')?.value.trim();
    a.download = artName ? `${artName}_存档.json` : `cyber-beads-save-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.sound.playTick();
  }

  _importSaveFile() {
    if (this.grid.hasAnyBead()) {
      if (!confirm('当前画布上有豆子，导入存档将覆盖它们。确定继续吗？')) return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.v !== 1 && data.v !== 2) {
            alert('存档格式不兼容（版本不匹配）。');
            return;
          }
          // Save to localStorage first so grid.load() can read it
          localStorage.setItem('cyber-beads-save', JSON.stringify(data));
          const success = this._restoreAppState(data);
          if (success) {
            this.renderer.resize();
            this.renderer.drawPegboard();
            this.renderer.drawAllBeads();
            this._updateUndoRedoButtons();
            this.beadDirty = false;
            this._debounceSave();
            if (this._drawReferenceUnderlay) { this._drawReferenceUnderlay(); this._positionSideControls(); }
            this.sound.playTick();
          } else {
            alert('无法恢复存档：数据损坏。');
          }
        } catch (err) {
          alert('无法读取存档文件。请确认文件是有效的 JSON 格式。');
        }
      };
      reader.onerror = () => { alert('读取文件失败。'); };
      reader.readAsText(file);
    };
    input.click();
  }

  _confirmDeleteSave() {
    if (confirm('确定要删除本地存档吗？此操作不可撤销。')) {
      try { localStorage.removeItem('cyber-beads-save'); } catch (e) {}
      this.sound.playTick();
    }
  }


  // ========== REFERENCE IMAGE SYSTEM ==========

  _initReferenceSystem() {
    // Reference state
    this._refImage = null;       // Image element of cropped reference
    this._refDataUrl = null;     // Data URL of cropped reference
    this._refOpacity = 0.5;      // Current opacity
    this._refEnabled = false;    // Underlay enabled
    this._desktopRefVisible = false;
    this._refCollapsed = false;  // Desktop ref collapsed into button
    this._desktopRefScale = 1;   // Desktop ref zoom scale

    // Import button
    document.getElementById('btn-import-ref').addEventListener('click', () => this._importReference());
    // File input
    document.getElementById('ref-file-input').addEventListener('change', (e) => {
      if (e.target.files[0]) this._showCropModal(e.target.files[0]);
      e.target.value = '';
    });

    // Side controls
    const toggle = document.getElementById('ref-toggle');
    const slider = document.getElementById('ref-opacity-slider');
    const valLabel = document.getElementById('ref-opacity-val');
    const sideControls = document.getElementById('ref-side-controls');

    sideControls.style.display = 'none'; // hidden until image imported

    toggle.addEventListener('change', () => {
      this._refEnabled = toggle.checked;
      this._drawReferenceUnderlay();
    });
    slider.addEventListener('input', () => {
      this._refOpacity = parseInt(slider.value) / 100;
      valLabel.textContent = slider.value + '%';
      this._drawReferenceUnderlay();
    });

    // Desktop ref close button → collapse animation
    document.getElementById('desktop-ref-close').addEventListener('click', () => {
      this._collapseDesktopRef();
    });

    // Expand button → expand animation
    document.getElementById('ref-expand-btn').addEventListener('click', () => {
      this._expandDesktopRef();
    });

    // Clear button
    document.getElementById('ref-clear-btn').addEventListener('click', () => {
      this._clearReference();
    });

    // Desktop ref drag
    this._initDesktopRefDrag();
  }

  _importReference() {
    document.getElementById('ref-file-input').click();
  }

  _showCropModal(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        this._buildCropUI(img);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  _buildCropUI(img) {
    const modal = document.getElementById('crop-modal');
    const canvas = document.getElementById('crop-canvas');
    const wrap = document.getElementById('crop-canvas-wrap');
    const overlay = document.getElementById('crop-overlay');
    const gridOverlay = document.getElementById('crop-grid-overlay');

    const S = 360; // fixed square crop size
    const N = this.grid.rows; // grid size

    // Canvas takes wrap size minus some padding
    const maxCanvasW = Math.min(window.innerWidth * 0.85, 700) - 24;
    const maxCanvasH = window.innerHeight * 0.55;

    canvas.width = maxCanvasW;
    canvas.height = maxCanvasH;
    const ctx = canvas.getContext('2d');

    // State
    let zoom = Math.min(maxCanvasW / img.width, maxCanvasH / img.height, 1);
    let panX = (maxCanvasW - img.width * zoom) / 2;
    let panY = (maxCanvasH - img.height * zoom) / 2;
    let dragging = false;
    let dragStartX = 0, dragStartY = 0, startPanX = 0, startPanY = 0;

    // Crop overlay positioning
    overlay.style.width = S + 'px';
    overlay.style.height = S + 'px';
    overlay.style.left = ((maxCanvasW - S) / 2) + 'px';
    overlay.style.top = ((maxCanvasH - S) / 2) + 'px';

    // Grid overlay
    gridOverlay.innerHTML = '';
    const cellPx = S / N;
    for (let i = 1; i < N; i++) {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;background:rgba(255,255,255,0.5);`;
      // Vertical line
      const vLine = line.cloneNode();
      vLine.style.cssText += `left:${i * cellPx}px;top:0;width:1px;height:100%;`;
      gridOverlay.appendChild(vLine);
      // Horizontal line
      const hLine = line.cloneNode();
      hLine.style.cssText += `top:${i * cellPx}px;left:0;height:1px;width:100%;`;
      gridOverlay.appendChild(hLine);
    }

    const render = () => {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    };

    // Mouse events
    canvas.onmousedown = (e) => {
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startPanX = panX;
      startPanY = panY;
    };
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panX = startPanX + (e.clientX - dragStartX);
      panY = startPanY + (e.clientY - dragStartY);
      render();
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    // Wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldZoom = zoom;
      const delta = -e.deltaY * 0.001;
      zoom = Math.max(0.1, Math.min(10, zoom + delta * zoom));
      // Zoom toward mouse position
      panX = mx - (mx - panX) * zoom / oldZoom;
      panY = my - (my - panY) * zoom / oldZoom;
      render();
    });

    // Touch events
    let lastPinchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        dragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        startPanX = panX;
        startPanY = panY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.hypot(dx, dy);
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragging) {
        panX = startPanX + (e.touches[0].clientX - dragStartX);
        panY = startPanY + (e.touches[0].clientY - dragStartY);
        render();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastPinchDist > 0) {
          const oldZoom = zoom;
          zoom = Math.max(0.1, Math.min(10, zoom * dist / lastPinchDist));
          const rect = canvas.getBoundingClientRect();
          const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          panX = mx - (mx - panX) * zoom / oldZoom;
          panY = my - (my - panY) * zoom / oldZoom;
        }
        lastPinchDist = dist;
        render();
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { dragging = false; lastPinchDist = 0; });

    render();

    // Buttons
    document.getElementById('crop-confirm-btn').onclick = () => {
      // Calculate crop region in original image coordinates
      const canvasRect = canvas.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      const sx = overlayRect.left - canvasRect.left;
      const sy = overlayRect.top - canvasRect.top;
      const imgX = (sx - panX) / zoom;
      const imgY = (sy - panY) / zoom;
      const imgW = S / zoom;
      // Use native image resolution within crop area, capped for memory
      const nativePx = Math.round(imgW);
      const CROP_PX = Math.min(2400, Math.max(360, nativePx));
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = CROP_PX;
      cropCanvas.height = CROP_PX;
      const cctx = cropCanvas.getContext('2d');
      // Fill dark background for areas outside image
      cctx.fillStyle = '#222';
      cctx.fillRect(0, 0, CROP_PX, CROP_PX);
      // Extract directly from original high-res image, not the display canvas
      cctx.drawImage(img, imgX, imgY, imgW, imgW, 0, 0, CROP_PX, CROP_PX);
      const dataUrl = cropCanvas.toDataURL('image/png', 0.92);
      modal.classList.remove('active');
      this._applyReference(dataUrl);
      this.sound.playTick();
    };
    document.getElementById('crop-cancel-btn').onclick = () => {
      modal.classList.remove('active');
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('active');
    };

    modal.classList.add('active');
  }

  _applyReference(dataUrl) {
    this._refDataUrl = dataUrl;
    const img = new Image();
    img.onload = () => {
      this._refImage = img;
      // Enable side controls
      const sideControls = document.getElementById('ref-side-controls');
      sideControls.style.display = 'flex';
      document.getElementById('ref-toggle').checked = true;
      this._refEnabled = true;
      document.getElementById('ref-opacity-slider').value = 50;
      document.getElementById('ref-opacity-val').textContent = '50%';
      this._refOpacity = 0.5;
      // Hide expand button (fresh import)
      document.getElementById('ref-expand-btn').style.display = 'none';
      this._refCollapsed = false;
      // Position side controls
      this._positionSideControls();
      // Draw underlay
      this._drawReferenceUnderlay();
      // Show desktop ref
      this._showDesktopRef(dataUrl);
    };
    img.src = dataUrl;
  }

  _drawReferenceUnderlay() {
    const refCanvas = document.getElementById('ref-canvas');
    const container = document.getElementById('canvas-container');
    if (!refCanvas || !container) return;

    // Match canvas container size
    const w = container.clientWidth;
    const h = container.clientHeight;
    refCanvas.width = w;
    refCanvas.height = h;
    refCanvas.style.width = w + 'px';
    refCanvas.style.height = h + 'px';

    const ctx = refCanvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    if (!this._refEnabled || !this._refImage) return;

    ctx.globalAlpha = this._refOpacity;
    ctx.drawImage(this._refImage, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  _showDesktopRef(dataUrl) {
    const win = document.getElementById('desktop-ref-window');
    const img = document.getElementById('desktop-ref-img');
    img.src = dataUrl;
    // Reset scale
    img.style.width = '150px';
    this._desktopRefScale = 1;

    // Default position: left of side controls
    const sideControls = document.getElementById('ref-side-controls');
    const scRect = sideControls.getBoundingClientRect();
    const gap = 10;
    win.style.display = 'block';
    // Need to measure window width after display:block
    const winW = win.getBoundingClientRect().width;
    const defaultLeft = Math.max(10, scRect.left - winW - gap);
    const defaultTop = scRect.top;

    win.style.left = defaultLeft + 'px';
    win.style.top = defaultTop + 'px';
    this._desktopRefVisible = true;
    this._constrainDesktopRef();
  }

  _hideDesktopRef() {
    document.getElementById('desktop-ref-window').style.display = 'none';
    this._desktopRefVisible = false;
  }

  _initDesktopRefDrag() {
    const win = document.getElementById('desktop-ref-window');
    let dragging = false, resizeDragging = false;
    let startX, startY, startLeft, startTop, startW, startH;
    const RESIZE_EDGE = 12; // px from edge for resize

    const getToolbarBottom = () => {
      const toolbar = document.getElementById('toolbar');
      return toolbar ? toolbar.getBoundingClientRect().bottom + 8 : 60;
    };
    const getPaletteBottom = () => {
      const palette = document.getElementById('palette');
      return palette ? palette.getBoundingClientRect().bottom + 8 : 120;
    };

    win.addEventListener('mousedown', (e) => {
      if (e.target.id === 'desktop-ref-close') return;
      const rect = win.getBoundingClientRect();
      const edgeRight = rect.right - e.clientX;
      const edgeBottom = rect.bottom - e.clientY;

      if (edgeRight < RESIZE_EDGE && edgeBottom < RESIZE_EDGE) {
        // Resize from bottom-right corner
        resizeDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = rect.width;
        startH = rect.height;
        e.preventDefault();
      } else {
        // Move
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (resizeDragging) {
        const newW = Math.max(100, startW + (e.clientX - startX));
        const newH = Math.max(100, startH + (e.clientY - startY));
        document.getElementById('desktop-ref-img').style.width = (newW - 28) + 'px'; // frame padding
        this._constrainDesktopRef();
      } else if (dragging) {
        win.style.left = (startLeft + (e.clientX - startX)) + 'px';
        win.style.top = (startTop + (e.clientY - startY)) + 'px';
        this._constrainDesktopRef();
      }
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
      resizeDragging = false;
    });

    // Scroll wheel zoom on desktop ref window
    win.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      const scale = this._desktopRefScale || 1;
      this._desktopRefScale = Math.max(0.5, Math.min(3, scale + delta * scale));
      document.getElementById('desktop-ref-img').style.width = (150 * this._desktopRefScale) + 'px';
      this._constrainDesktopRef();
    }, { passive: false });

    // Touch pinch zoom on desktop ref window
    let pinchDist = 0, pinchScale = 1;
    win.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist = Math.hypot(dx, dy);
        pinchScale = this._desktopRefScale || 1;
      }
    }, { passive: false });
    win.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinchDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        this._desktopRefScale = Math.max(0.5, Math.min(3, pinchScale * (dist / pinchDist)));
        document.getElementById('desktop-ref-img').style.width = (150 * this._desktopRefScale) + 'px';
      }
    }, { passive: false });
    win.addEventListener('touchend', () => { pinchDist = 0; });

    // Also update reference canvas size on window resize
    window.addEventListener('resize', () => {
      if (this._refEnabled) this._drawReferenceUnderlay();
      if (this._desktopRefVisible) this._constrainDesktopRef();
      this._positionSideControls();
    });
  }

  _constrainDesktopRef() {
    const win = document.getElementById('desktop-ref-window');
    if (!win || !this._desktopRefVisible) return;
    const rect = win.getBoundingClientRect();
    const minY = 50; // below title
    const maxY = window.innerHeight - 60;
    const minX = 10;
    const maxX = window.innerWidth - rect.width - 10;

    // Constrain to toolbar/palette bottom edge
    const toolbarBottom = (() => {
      const tb = document.getElementById('toolbar');
      return tb ? tb.getBoundingClientRect().bottom + 4 : 60;
    })();
    const paletteBottom = (() => {
      const pal = document.getElementById('palette');
      return pal ? pal.getBoundingClientRect().bottom + 4 : 120;
    })();
    const topBoundary = Math.max(minY, toolbarBottom, paletteBottom);

    let newLeft = parseFloat(win.style.left) || rect.left;
    let newTop = parseFloat(win.style.top) || rect.top;

    if (newTop < topBoundary) newTop = topBoundary;
    if (newTop + rect.height > maxY) newTop = maxY - rect.height;
    if (newLeft < minX) newLeft = minX;
    if (newLeft + rect.width > maxX) newLeft = maxX - rect.width;

    win.style.left = newLeft + 'px';
    win.style.top = newTop + 'px';
  }

  _positionSideControls() {
    const area = document.getElementById('canvas-area');
    const container = document.getElementById('canvas-container');
    if (!area || !container) return;
    const gap = 8;
    // Account for CSS transform scale (zoom) — offsetLeft is pre-transform,
    // but visually the canvas scales from center-top (transform-origin: 50% 0%)
    const zoom = this.zoomLevel || 1;
    const visualShift = container.offsetWidth * (1 - zoom) / 2;
    const visualLeft = container.offsetLeft + visualShift;
    const visualRight = visualLeft + container.offsetWidth * zoom;

    // Left panel (reference controls)
    const leftControls = document.getElementById('ref-side-controls');
    if (leftControls && leftControls.style.display !== 'none') {
      leftControls.style.left = (visualLeft - leftControls.offsetWidth - gap) + 'px';
      leftControls.style.top = '0px';
    }

    // Right panel (ruler controls)
    const rightControls = document.getElementById('ruler-side-controls');
    if (rightControls) {
      rightControls.style.left = (visualRight + gap) + 'px';
      rightControls.style.top = '0px';
    }
  }

  _clearReference() {
    // Clear state
    this._refImage = null;
    this._refDataUrl = null;
    this._refEnabled = false;
    this._refCollapsed = false;
    // Hide side controls
    document.getElementById('ref-side-controls').style.display = 'none';
    document.getElementById('ref-expand-btn').style.display = 'none';
    // Clear ref canvas
    const refCanvas = document.getElementById('ref-canvas');
    if (refCanvas) {
      const ctx = refCanvas.getContext('2d');
      ctx.clearRect(0, 0, refCanvas.width, refCanvas.height);
    }
    // Hide desktop ref window
    const win = document.getElementById('desktop-ref-window');
    win.style.display = 'none';
    this._desktopRefVisible = false;
    // Remove any inline transform from animation
    win.style.transform = '';
  }

  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  _collapseDesktopRef() {
    const win = document.getElementById('desktop-ref-window');
    const expandBtn = document.getElementById('ref-expand-btn');
    if (!this._desktopRefVisible) return;

    // Get start position (window current)
    const startRect = win.getBoundingClientRect();
    const startLeft = startRect.left;
    const startTop = startRect.top;
    const startW = startRect.width;
    const startH = startRect.height;

    // Get target button position
    expandBtn.style.display = 'flex'; // temporarily show to measure
    const btnRect = expandBtn.getBoundingClientRect();
    expandBtn.style.display = 'none';
    const targetLeft = btnRect.left + btnRect.width / 2 - startW / 2;
    const targetTop = btnRect.top + btnRect.height / 2 - startH / 2;

    const duration = 300;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = this._easeInOutCubic(t);

      const curLeft = startLeft + (targetLeft - startLeft) * eased;
      const curTop = startTop + (targetTop - startTop) * eased;
      const scale = 1 - eased; // shrink to 0

      win.style.left = curLeft + 'px';
      win.style.top = curTop + 'px';
      win.style.transform = `scale(${scale})`;
      win.style.transformOrigin = 'top left';

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Done: hide window, show button
        win.style.display = 'none';
        win.style.transform = '';
        this._desktopRefVisible = false;
        this._refCollapsed = true;
        expandBtn.style.display = 'flex';
      }
    };
    requestAnimationFrame(animate);
  }

  _expandDesktopRef() {
    const win = document.getElementById('desktop-ref-window');
    const expandBtn = document.getElementById('ref-expand-btn');
    if (!this._refCollapsed) return;

    // Get button position (start)
    const btnRect = expandBtn.getBoundingClientRect();

    // Calculate target position: left of side controls
    win.style.display = 'block';
    const winW = win.getBoundingClientRect().width;
    const sideControls = document.getElementById('ref-side-controls');
    const scRect = sideControls.getBoundingClientRect();
    const gap = 10;
    const targetLeft = Math.max(10, scRect.left - winW - gap);
    const targetTop = scRect.top;

    // Hide button
    expandBtn.style.display = 'none';
    this._refCollapsed = false;

    // Show window at button position, scaled down to a point
    const startLeft = btnRect.left + btnRect.width / 2;
    const startTop = btnRect.top + btnRect.height / 2;
    win.style.left = startLeft + 'px';
    win.style.top = startTop + 'px';
    win.style.transform = 'scale(0.01)';
    win.style.transformOrigin = 'top left';
    this._desktopRefVisible = true;

    const duration = 300;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = this._easeInOutCubic(t);

      const curLeft = startLeft + (targetLeft - startLeft) * eased;
      const curTop = startTop + (targetTop - startTop) * eased;
      const scale = 0.01 + (1 - 0.01) * eased; // grow from near-0 to 1

      win.style.left = curLeft + 'px';
      win.style.top = curTop + 'px';
      win.style.transform = `scale(${scale})`;
      win.style.transformOrigin = 'top left';

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Done: ensure clean state with constrain
        win.style.transform = '';
        this._constrainDesktopRef();
      }
    };
    requestAnimationFrame(animate);
  }

  // ========== EXPORT PREVIEW ==========

  _showExportPreview(mode) {
    this._exportPreviewMode = mode;
    const modal = document.getElementById('export-preview-modal');
    const confirmBtn = document.getElementById('export-confirm-btn');
    const closeBtn = document.getElementById('export-close-btn');
    const bgCheckbox = document.getElementById('export-show-bg');

    // Bind events
    this._exportPreviewHandlers = {
      confirm: () => this._confirmExportDownload(),
      close: () => this._closeExportPreview(),
      overlay: (e) => { if (e.target === modal) this._closeExportPreview(); },
      bgChange: () => this._renderExportPreview(),
    };
    confirmBtn.addEventListener('click', this._exportPreviewHandlers.confirm);
    closeBtn.addEventListener('click', this._exportPreviewHandlers.close);
    modal.addEventListener('click', this._exportPreviewHandlers.overlay);
    bgCheckbox.addEventListener('change', this._exportPreviewHandlers.bgChange);

    bgCheckbox.checked = true;
    this._renderExportPreview();
    modal.classList.add('active');
  }

  _renderExportPreview() {
    const includeBg = document.getElementById('export-show-bg').checked;
    const canvas = ExportManager.exportToCanvas(
      this.grid, this._exportPreviewMode,
      this.ironingSys.realisticEdges, !includeBg
    );

    const wrap = document.getElementById('export-preview-canvas-wrap');
    const previewCanvas = document.getElementById('export-preview-canvas');
    const maxW = Math.min(wrap.clientWidth - 16, 600);
    const maxH = Math.min(window.innerHeight * 0.55, 500);
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
    previewCanvas.width = Math.round(canvas.width * scale);
    previewCanvas.height = Math.round(canvas.height * scale);
    previewCanvas.style.width = previewCanvas.width + 'px';
    previewCanvas.style.height = previewCanvas.height + 'px';
    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
  }

  _confirmExportDownload() {
    const includeBg = document.getElementById('export-show-bg').checked;
    const canvas = ExportManager.exportToCanvas(
      this.grid, this._exportPreviewMode,
      this.ironingSys.realisticEdges, !includeBg
    );
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const artName = document.getElementById('artwork-name-input')?.value.trim();
      a.download = artName ? `${artName}.png` : `cyber-beads-${this._exportPreviewMode}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    this._closeExportPreview();
    this.sound.playTick();
  }

  _closeExportPreview() {
    const modal = document.getElementById('export-preview-modal');
    modal.classList.remove('active');
    const h = this._exportPreviewHandlers;
    if (h) {
      document.getElementById('export-confirm-btn').removeEventListener('click', h.confirm);
      document.getElementById('export-close-btn').removeEventListener('click', h.close);
      modal.removeEventListener('click', h.overlay);
      document.getElementById('export-show-bg').removeEventListener('change', h.bgChange);
    }
    this._exportPreviewHandlers = null;
    this._exportPreviewMode = null;
  }

  _gameLoop(timestamp) {
    const dt = Math.min(timestamp - this.lastFrameTime, CONFIG.MAX_FRAME_DT);
    this.lastFrameTime = timestamp;

    // Update
    this.toolDrawer.update(dt);
    if (this.ironingSys.active) {
      this.ironingSys.update(dt);
      if (this.ironingSys.dirtyCounter % CONFIG.BEAD_DIRTY_THROTTLE === 0) {
        this.beadDirty = true;
      }
    }

    // Draw FX layer (every frame)
    this.renderer.clearFx();
    if (this.ironingSys.active) {
      this.renderer.drawIroningCloth();
      this.renderer.drawHeatTrails(this.ironingSys.trails);
      const pos = this.input.getPointerPos();
      this.renderer.drawIronCursor(pos.x, pos.y);
    } else {
      const pos = this.input.getPointerPos();
      const tool = this.toolDrawer.getTool();
      this.renderer.drawToolCursor(pos.x, pos.y, tool, this.activeColor, this.penInkLevel);
    }

    // Draw bead layer (on dirty)
    if (this.beadDirty) {
      this.renderer.drawAllBeads();
      this.beadDirty = false;
    }

    requestAnimationFrame((t) => this._gameLoop(t));
  }

  // ========== BLUEPRINT GENERATOR ==========

  _showBlueprintModal() {
    if (!this.grid.hasAnyBead()) {
      alert('画布上还没有豆子，请先放置豆子再生成图纸。');
      return;
    }
    this.sound.playTick();

    const rows = this.grid.rows;
    const cols = this.grid.cols;

    // Build grid data: HEX → MARD code
    const gridData = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const bead = this.grid.getBead(r, c);
        if (bead) {
          const hex = bead.color.toUpperCase();
          let code = MARD_HEX_TO_CODE[hex];
          if (!code) code = findClosestMardCode(bead.color) || hex;
          row.push({ code, hex: code.startsWith('#') ? code : MARD_COLORS[code] || hex });
        } else {
          row.push(null);
        }
      }
      gridData.push(row);
    }

    // Store for re-render
    this._bpGridData = gridData;
    this._bpRows = rows;
    this._bpCols = cols;

    // Read options
    const getOpts = () => ({
      mirror: document.getElementById('bp-mirror').checked,
      showName: document.getElementById('bp-show-name').checked,
      showAuthor: document.getElementById('bp-show-author').checked,
      authorName: document.getElementById('bp-author-input').value.trim(),
    });

    // Render function
    const renderPreview = () => {
      this._renderBlueprintPreview(gridData, rows, cols, getOpts());
    };

    // Wire checkboxes → re-render
    document.getElementById('bp-mirror').checked = false;
    document.getElementById('bp-show-name').checked = false;
    document.getElementById('bp-show-author').checked = false;
    document.getElementById('bp-author-row').style.display = 'none';
    document.getElementById('bp-author-input').value = '';

    document.getElementById('bp-mirror').onchange = renderPreview;
    document.getElementById('bp-show-name').onchange = renderPreview;
    document.getElementById('bp-show-author').onchange = function () {
      const authorRow = document.getElementById('bp-author-row');
      authorRow.style.display = this.checked ? 'flex' : 'none';
      if (!this.checked) {
        document.getElementById('bp-author-input').value = '';
      }
      renderPreview();
    };
    document.getElementById('bp-author-confirm-btn').onclick = renderPreview;
    document.getElementById('bp-author-input').onkeydown = (e) => {
      if (e.key === 'Enter') renderPreview();
    };

    // Initial render
    renderPreview();

    // Wire export button
    document.getElementById('blueprint-export-btn').onclick = () => this._exportBlueprint(gridData, rows, cols, getOpts());

    // Wire close
    document.getElementById('blueprint-close-btn').onclick = () => {
      document.getElementById('blueprint-modal').classList.remove('active');
    };
    document.getElementById('blueprint-modal').onclick = (e) => {
      if (e.target === document.getElementById('blueprint-modal')) {
        document.getElementById('blueprint-modal').classList.remove('active');
      }
    };

    document.getElementById('blueprint-modal').classList.add('active');
  }

  _renderBlueprintPreview(gridData, rows, cols, opts) {
    const mirror = opts.mirror;

    // Render rulers (unchanged by mirror — rulers stay as-is)
    const renderColRuler = (containerId, start, end) => {
      const el = document.getElementById(containerId);
      el.innerHTML = '<span></span>' + Array.from({ length: cols }, (_, i) =>
        `<span>${start <= end ? start + i : start - i}</span>`
      ).join('');
    };
    renderColRuler('blueprint-col-top', 1, cols);
    renderColRuler('blueprint-col-bottom', cols, 1);

    const renderRowRuler = (containerId, start, end) => {
      const el = document.getElementById(containerId);
      el.innerHTML = Array.from({ length: rows }, (_, i) =>
        `<div>${start <= end ? start + i : start - i}</div>`
      ).join('');
    };
    renderRowRuler('blueprint-row-left', 1, rows);
    renderRowRuler('blueprint-row-right', rows, 1);

    // Render grid (with optional mirror)
    const table = document.getElementById('blueprint-grid');
    table.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let ci = 0; ci < cols; ci++) {
        const c = mirror ? cols - 1 - ci : ci;
        const cell = gridData[r][c];
        const td = document.createElement('td');
        if (cell) {
          td.textContent = cell.code;
          td.style.background = cell.hex;
          td.style.color = contrastTextColor(cell.hex);
        } else {
          td.style.background = '#ffffff';
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    // Render color card (same regardless of mirror)
    const countMap = {};
    gridData.forEach(row => {
      row.forEach(cell => {
        if (cell) {
          countMap[cell.code] = countMap[cell.code] || { hex: cell.hex, count: 0 };
          countMap[cell.code].count++;
        }
      });
    });
    const cardBox = document.getElementById('blueprint-color-card');
    cardBox.innerHTML = '';
    Object.entries(countMap).forEach(([code, info]) => {
      const wrap = document.createElement('div');
      wrap.className = 'color-item';
      const block = document.createElement('div');
      block.className = 'color-block';
      block.style.background = info.hex;
      block.style.color = contrastTextColor(info.hex);
      block.textContent = code;
      const text = document.createElement('div');
      text.className = 'count-text';
      text.textContent = `×${info.count}`;
      wrap.appendChild(block);
      wrap.appendChild(text);
      cardBox.appendChild(wrap);
    });

    // Show/hide text area
    const textArea = document.getElementById('blueprint-text-area');
    const artName = document.getElementById('artwork-name-input')?.value.trim() || '';
    const showName = opts.showName && artName;
    const showAuthor = opts.showAuthor && opts.authorName;

    if (showName || showAuthor) {
      textArea.style.display = 'block';
      document.getElementById('bp-artwork-name-text').textContent = showName ? artName : '';
      document.getElementById('bp-author-name-text').textContent = showAuthor ? `by ${opts.authorName}` : '';
    } else {
      textArea.style.display = 'none';
    }
  }

  _exportBlueprint(gridData, rows, cols, opts) {
    const mirror = opts && opts.mirror;
    const S = 4; // 4x high-res scale
    const CELL = 36 * S;
    const RULER_W = 24 * S;
    const RULER_H = 20 * S;
    const PAD = 12 * S;
    const BLOCK = 42 * S;
    const BLOCK_GAP = 10 * S;
    const CARD_ROW_H = BLOCK + 28 * S;

    const totalW = PAD + RULER_W + cols * CELL + RULER_W + PAD;
    // Estimate color card rows to compute total height
    const countMap = {};
    gridData.forEach(row => {
      row.forEach(cell => {
        if (cell) {
          countMap[cell.code] = countMap[cell.code] || { hex: cell.hex, count: 0 };
          countMap[cell.code].count++;
        }
      });
    });
    const entries = Object.entries(countMap);
    const maxPerRow = Math.max(1, Math.floor((totalW - PAD * 2 + BLOCK_GAP) / (BLOCK + BLOCK_GAP)));
    const cardRows = Math.ceil(entries.length / maxPerRow);
    const CARD_AREA = cardRows > 0 ? PAD + cardRows * CARD_ROW_H : 0;

    // Text area for artwork name + author
    const artName = document.getElementById('artwork-name-input')?.value.trim() || '';
    const showName = opts && opts.showName && artName;
    const showAuthor = opts && opts.showAuthor && opts.authorName;
    const TEXT_LINE_H = 28 * S;
    const TEXT_PAD = 12 * S;
    let textLines = 0;
    if (showName || showAuthor) textLines = (showName ? 1 : 0) + (showAuthor ? 1 : 0);
    const TEXT_AREA = textLines > 0 ? TEXT_PAD + textLines * TEXT_LINE_H + TEXT_PAD : 0;

    const totalH = PAD + RULER_H + rows * CELL + RULER_H + PAD + CARD_AREA + TEXT_AREA + PAD;

    const canvas = document.createElement('canvas');
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalW, totalH);

    const ox = PAD + RULER_W;
    const oy = PAD + RULER_H;

    // Grid lines (light gray)
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 1 * S;
    for (let r = 0; r <= rows; r++) {
      const y = oy + r * CELL;
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + cols * CELL, y); ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      const x = ox + c * CELL;
      ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + rows * CELL); ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2 * S;
    ctx.strokeRect(ox, oy, cols * CELL, rows * CELL);

    // Draw cells (with optional mirror)
    ctx.font = 'bold ' + (11 * S) + 'px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const srcC = mirror ? cols - 1 - c : c;
        const cell = gridData[r][srcC];
        const cx = ox + c * CELL;
        const cy = oy + r * CELL;
        if (cell) {
          ctx.fillStyle = cell.hex;
          ctx.fillRect(cx + 1, cy + 1, CELL - 2, CELL - 2);
          ctx.fillStyle = contrastTextColor(cell.hex);
          ctx.fillText(cell.code, cx + CELL / 2, cy + CELL / 2);
        }
      }
    }

    // Column rulers (top & bottom) — rulers stay as-is, not mirrored
    const rulerFontSize = 11 * S;
    ctx.font = rulerFontSize + 'px Arial, sans-serif';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < cols; c++) {
      const cx = ox + c * CELL + CELL / 2;
      ctx.fillText(String(c + 1), cx, oy - RULER_H / 2);
      ctx.fillText(String(cols - c), cx, oy + rows * CELL + RULER_H / 2);
    }

    // Row rulers (left & right)
    for (let r = 0; r < rows; r++) {
      const cy = oy + r * CELL + CELL / 2;
      ctx.fillText(String(r + 1), ox - RULER_W / 2, cy);
      ctx.fillText(String(rows - r), ox + cols * CELL + RULER_W / 2, cy);
    }

    // Color card
    const cardY = oy + rows * CELL + RULER_H + PAD;
    const blockFontSize = 10 * S;
    const countFontSize = 10 * S;
    ctx.font = blockFontSize + 'px Arial, sans-serif';
    entries.forEach(([code, info], i) => {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const bx = ox + col * (BLOCK + BLOCK_GAP);
      const by = cardY + row * CARD_ROW_H;
      // Color block
      ctx.fillStyle = info.hex;
      ctx.beginPath();
      ctx.roundRect(bx, by, BLOCK, BLOCK, 6 * S);
      ctx.fill();
      // Code text
      ctx.fillStyle = contrastTextColor(info.hex);
      ctx.font = 'bold ' + blockFontSize + 'px Arial, sans-serif';
      ctx.fillText(code, bx + BLOCK / 2, by + BLOCK / 2);
      // Count
      ctx.font = countFontSize + 'px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText('×' + info.count, bx + BLOCK / 2, by + BLOCK + 14 * S);
    });

    // Artwork name + author name text
    if (textLines > 0) {
      const textY = cardY + CARD_AREA + TEXT_PAD;
      let lineNum = 0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (showName) {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold ' + (16 * S) + 'px "PingFang SC","Microsoft YaHei",Arial,sans-serif';
        ctx.fillText(artName, totalW / 2, textY + lineNum * TEXT_LINE_H);
        lineNum++;
      }
      if (showAuthor) {
        ctx.fillStyle = '#999999';
        ctx.font = (14 * S) + 'px "PingFang SC","Microsoft YaHei",Arial,sans-serif';
        ctx.fillText('by ' + opts.authorName, totalW / 2, textY + lineNum * TEXT_LINE_H);
      }
    }

    // Download
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = artName ? `${artName}_图纸.png` : `cyber-beads-blueprint-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}
