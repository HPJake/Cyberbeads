// ========== TOOL DRAWER ==========
class ToolDrawer {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('tool-drawer');
    this.tweezerEl = document.getElementById('tool-tweezers');
    this.penEl = document.getElementById('tool-beadpen');
    this.handEl = document.getElementById('tool-hand');
    this.tweezerCanvas = this.tweezerEl.querySelector('canvas');
    this.penCanvas = this.penEl.querySelector('canvas');
    this.handCanvas = this.handEl.querySelector('canvas');
    this.tweezerDot = this.tweezerEl.querySelector('.color-dot');
    this.penDot = this.penEl.querySelector('.color-dot');

    this.currentTool = 'tweezers';
    this.hoveredTool = null;
    this.tweezerTarget = CONFIG.TOOL_PEEK;
    this.penTarget = CONFIG.TOOL_PEEK;
    this.handTarget = CONFIG.TOOL_PEEK;
    this.tweezerCurrent = CONFIG.TOOL_PEEK;
    this.penCurrent = CONFIG.TOOL_PEEK;
    this.handCurrent = CONFIG.TOOL_PEEK;

    this._drawToolIcons();
    this._setupEvents();
  }

  _drawToolIcons() {
    // Canvas: (0,0) = top of tool card. When retracted (translateY 78%),
    // only top ~35px is visible above viewport bottom edge.
    // So tool TIPS must be at y=0 to y=35 range.

    // Draw tweezers icon - tips at TOP of canvas
    const tc = this.tweezerCanvas.getContext('2d');
    tc.clearRect(0, 0, 60, 160);
    // Tweezer arms (prongs) converging at top
    tc.strokeStyle = '#9B7B5A';
    tc.lineWidth = 2.2;
    tc.lineCap = 'round';
    tc.beginPath(); tc.moveTo(30, 5); tc.lineTo(20, 48); tc.stroke();
    tc.beginPath(); tc.moveTo(30, 5); tc.lineTo(40, 48); tc.stroke();
    // Tips at the visible ends of prongs
    tc.fillStyle = '#B89878';
    tc.beginPath(); tc.arc(20, 48, 3, 0, Math.PI * 2); tc.fill();
    tc.beginPath(); tc.arc(40, 48, 3, 0, Math.PI * 2); tc.fill();
    // Pivot / joint
    tc.fillStyle = '#8B6B4A';
    tc.beginPath(); tc.arc(30, 5, 2.5, 0, Math.PI * 2); tc.fill();
    // Handle (extends down, mostly hidden when retracted)
    tc.fillStyle = '#C8A882';
    tc.strokeStyle = '#8B6B4A';
    tc.lineWidth = 1.5;
    tc.beginPath();
    tc.roundRect(23, 50, 14, 55, 4);
    tc.fill();
    tc.stroke();
    // Grip rings
    tc.strokeStyle = '#A08060';
    tc.lineWidth = 0.9;
    for (let yy = 60; yy <= 95; yy += 8) {
      tc.beginPath(); tc.moveTo(23, yy); tc.lineTo(37, yy); tc.stroke();
    }

    // Draw bead pen icon - tip at TOP of canvas
    const pc = this.penCanvas.getContext('2d');
    pc.clearRect(0, 0, 60, 160);
    // Pen nib/tip (visible portion)
    pc.fillStyle = '#D4B896';
    pc.strokeStyle = '#A08060';
    pc.lineWidth = 1;
    pc.beginPath();
    pc.arc(30, 12, 5, 0, Math.PI * 2);
    pc.fill();
    pc.stroke();
    // Small bead coming out of tip
    pc.fillStyle = '#F4A7B9';
    pc.beginPath();
    pc.arc(28, 6, 2.5, 0, Math.PI * 2);
    pc.fill();
    // Tip cone
    pc.fillStyle = '#B09070';
    pc.strokeStyle = '#9B7B5A';
    pc.lineWidth = 1.3;
    pc.beginPath();
    pc.moveTo(26, 18);
    pc.lineTo(22, 42);
    pc.lineTo(26, 55);
    pc.lineTo(34, 55);
    pc.lineTo(38, 42);
    pc.lineTo(34, 18);
    pc.closePath();
    pc.fill();
    pc.stroke();
    // Pen barrel (hidden when retracted)
    const penGrad = pc.createLinearGradient(0, 58, 0, 155);
    penGrad.addColorStop(0, '#E0C8A8');
    penGrad.addColorStop(0.4, '#F0DCC0');
    penGrad.addColorStop(1, '#C8A880');
    pc.fillStyle = penGrad;
    pc.strokeStyle = '#9B7B5A';
    pc.lineWidth = 1.3;
    pc.beginPath();
    pc.roundRect(24, 55, 12, 55, 3);
    pc.fill();
    pc.stroke();
    // Ink window on barrel
    pc.fillStyle = '#FFF8F0';
    pc.beginPath();
    pc.roundRect(27, 70, 6, 28, 2);
    pc.fill();
    pc.strokeStyle = '#B89878';
    pc.lineWidth = 0.7;
    pc.stroke();
    // Barrel rings
    pc.strokeStyle = '#B89878';
    pc.lineWidth = 0.6;
    [62, 90, 105].forEach(yy => {
      pc.beginPath(); pc.moveTo(24, yy); pc.lineTo(36, yy); pc.stroke();
    });

    // Draw hand (pan) icon - open palm, fingers pointing up at top
    const hc = this.handCanvas.getContext('2d');
    hc.clearRect(0, 0, 60, 160);
    hc.fillStyle = '#D4B896';
    hc.strokeStyle = '#9B7B5A';
    hc.lineWidth = 1.8;
    hc.lineCap = 'round';
    hc.lineJoin = 'round';

    // 4 fingers (pointing up from palm, visible tips when retracted)
    const fingers = [
      { x: 18, w: 5.2 },  // index
      { x: 25, w: 5.2 },  // middle
      { x: 32, w: 5.2 },  // ring
      { x: 38.5, w: 4.8 }, // pinky
    ];
    for (const f of fingers) {
      hc.fillStyle = '#DDBE9E';
      hc.beginPath();
      hc.roundRect(f.x, 2, f.w, 22, 3);
      hc.fill();
      hc.stroke();
      // Fingertip highlight
      hc.fillStyle = '#F0DCC0';
      hc.beginPath();
      hc.roundRect(f.x + 0.5, 2, f.w - 1, 8, 2.5);
      hc.fill();
      // Knuckle crease
      hc.strokeStyle = '#B89878';
      hc.lineWidth = 0.6;
      hc.beginPath();
      hc.moveTo(f.x + 0.8, 17);
      hc.lineTo(f.x + f.w - 0.8, 17);
      hc.stroke();
      hc.strokeStyle = '#9B7B5A';
      hc.lineWidth = 1.8;
    }

    // Palm
    hc.fillStyle = '#D4B896';
    hc.beginPath();
    hc.roundRect(15, 18, 30, 30, 8);
    hc.fill();
    hc.stroke();

    // Thumb (left side)
    hc.save();
    hc.translate(16, 30);
    hc.rotate(-0.45);
    hc.fillStyle = '#DDBE9E';
    hc.beginPath();
    hc.roundRect(-2, -12, 6.5, 18, 3.5);
    hc.fill();
    hc.stroke();
    hc.restore();

    // Palm life-line
    hc.strokeStyle = '#C8A882';
    hc.lineWidth = 0.7;
    hc.beginPath();
    hc.arc(28, 36, 7, 0.8, 2.2);
    hc.stroke();

    // Wrist (extends down, mostly hidden when retracted)
    hc.strokeStyle = '#9B7B5A';
    hc.lineWidth = 1.8;
    hc.fillStyle = '#D4B896';
    hc.beginPath();
    hc.roundRect(19, 46, 22, 42, 6);
    hc.fill();
    hc.stroke();

    // Wrist crease
    hc.strokeStyle = '#C8A882';
    hc.lineWidth = 0.6;
    hc.beginPath();
    hc.moveTo(19, 58);
    hc.lineTo(41, 58);
    hc.stroke();

    this._applyPositions();
  }

  _applyPositions() {
    const tweezerPct = this.tweezerCurrent * 100;
    const penPct = this.penCurrent * 100;
    const handPct = this.handCurrent * 100;
    this.tweezerEl.style.transform = `translateY(${tweezerPct}%)`;
    this.penEl.style.transform = `translateY(${penPct}%)`;
    this.handEl.style.transform = `translateY(${handPct}%)`;
  }

  _setupEvents() {
    this.tweezerEl.addEventListener('pointerenter', () => {
      this.hoveredTool = 'tweezers';
      if (this.currentTool !== 'tweezers') this.tweezerTarget = 0.05;
      this.app.sound.playTick();
    });
    this.tweezerEl.addEventListener('pointerleave', () => {
      if (this.hoveredTool === 'tweezers') this.hoveredTool = null;
      if (this.currentTool !== 'tweezers') this.tweezerTarget = CONFIG.TOOL_PEEK;
    });
    this.tweezerEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectTool('tweezers');
    });

    this.penEl.addEventListener('pointerenter', () => {
      this.hoveredTool = 'beadpen';
      if (this.currentTool !== 'beadpen') this.penTarget = 0.05;
      this.app.sound.playTick();
    });
    this.penEl.addEventListener('pointerleave', () => {
      if (this.hoveredTool === 'beadpen') this.hoveredTool = null;
      if (this.currentTool !== 'beadpen') this.penTarget = CONFIG.TOOL_PEEK;
    });
    this.penEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectTool('beadpen');
    });

    this.handEl.addEventListener('pointerenter', () => {
      this.hoveredTool = 'hand';
      if (this.currentTool !== 'hand') this.handTarget = 0.05;
      this.app.sound.playTick();
    });
    this.handEl.addEventListener('pointerleave', () => {
      if (this.hoveredTool === 'hand') this.hoveredTool = null;
      if (this.currentTool !== 'hand') this.handTarget = CONFIG.TOOL_PEEK;
    });
    this.handEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectTool('hand');
    });

    // Deselect on click outside
    document.addEventListener('pointerdown', (e) => {
      if (!this.container.contains(e.target) && !e.target.closest('#canvas-container')) {
        // Don't deselect, keep tool out (requirement: option B)
      }
    });
  }

  selectTool(tool) {
    this.currentTool = tool;
    this.tweezerEl.classList.toggle('selected', tool === 'tweezers');
    this.penEl.classList.toggle('selected', tool === 'beadpen');
    this.handEl.classList.toggle('selected', tool === 'hand');
    if (tool === 'tweezers') {
      this.tweezerTarget = 0.02;
      this.penTarget = CONFIG.TOOL_PEEK;
      this.handTarget = CONFIG.TOOL_PEEK;
    } else if (tool === 'beadpen') {
      this.penTarget = 0.02;
      this.tweezerTarget = CONFIG.TOOL_PEEK;
      this.handTarget = CONFIG.TOOL_PEEK;
    } else {
      this.handTarget = 0.02;
      this.tweezerTarget = CONFIG.TOOL_PEEK;
      this.penTarget = CONFIG.TOOL_PEEK;
    }
    // Toggle CSS cursor class on zoom wrapper
    const wrapper = document.getElementById('canvas-zoom-wrapper');
    if (tool === 'hand') {
      wrapper.classList.add('hand-cursor');
    } else {
      wrapper.classList.remove('hand-cursor', 'grabbing');
    }
    this.app.onToolChange(tool);
  }

  getTool() { return this.currentTool; }

  showColorPreview(color) {
    const dot = this.currentTool === 'tweezers' ? this.tweezerDot : this.penDot;
    if (color && color !== ERASER_COLOR) {
      dot.style.display = 'block';
      dot.style.background = color;
      dot.style.boxShadow = `0 0 4px ${color}`;
    } else if (color === ERASER_COLOR) {
      dot.style.display = 'block';
      dot.style.background = '#F5F0E8';
      dot.style.boxShadow = '0 0 4px rgba(0,0,0,0.2)';
    } else {
      dot.style.display = 'none';
    }
  }

  setEnabled(enabled) {
    this.tweezerEl.style.pointerEvents = enabled ? 'auto' : 'none';
    this.penEl.style.pointerEvents = enabled ? 'auto' : 'none';
    this.handEl.style.pointerEvents = enabled ? 'auto' : 'none';
    this.container.style.opacity = enabled ? '1' : '0.5';
  }

  update(dt) {
    const ease = CONFIG.TOOL_EASE;
    const factor = 1 - Math.pow(1 - ease, dt * 0.06);
    this.tweezerCurrent += (this.tweezerTarget - this.tweezerCurrent) * factor;
    this.penCurrent += (this.penTarget - this.penCurrent) * factor;
    this.handCurrent += (this.handTarget - this.handCurrent) * factor;
    this._applyPositions();
  }
}
