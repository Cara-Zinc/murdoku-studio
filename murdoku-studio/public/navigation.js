import {normalizeView, viewBounds, centerView, parseCoordinate} from './viewport.js';

// Mini-map input changes the camera only; all game actions remain in app.js.
export function setupNavigation({puzzle, progress, view, update, selected, coord, toast}) {
  const $ = id => document.getElementById(id), canvas = $('minimap');
  const mapPanel = $('map-navigation'), mapHome = document.createComment('map navigation home');
  mapPanel.before(mapHome);
  document.addEventListener('fullscreenchange', () => {
    const fullscreen = document.fullscreenElement;
    if (fullscreen?.contains($('board'))) fullscreen.append(mapPanel);
    else mapHome.after(mapPanel);
  });
  let drag = null, image = null, imageSource = '', history = [], caseKey = '';
  const remember = () => {history.push({...view()}); if (history.length > 30) history.shift();};
  const navigate = (next, keepHistory = true) => {if (keepHistory) remember(); update(next);};
  function locate(index) {navigate(centerView(puzzle(), view(), index));}
  $('view-mode').onchange = () => navigate({...view(), mode: $('view-mode').value});
  $('view-size').onchange = () => {
    const b = viewBounds(puzzle(), view());
    const index = Math.min(puzzle().rows - 1, b.row + Math.floor(b.rows / 2)) * puzzle().cols + Math.min(puzzle().cols - 1, b.col + Math.floor(b.cols / 2));
    navigate(centerView(puzzle(), {...view(), size: Number($('view-size').value)}, index));
  };
  $('locate-person').onclick = () => {
    const index = progress().placements[selected()];
    if (index === undefined) return toast('这名人物尚未放置。');
    locate(index);
  };
  $('view-back').onclick = () => {if (history.length) update(history.pop());};
  $('jump-form').onsubmit = event => {
    event.preventDefault(); const index = parseCoordinate(puzzle(), $('jump-coordinate').value);
    if (index === null) return toast('请输入棋盘内的坐标，例如 I9。');
    locate(index);
  };
  for (const button of document.querySelectorAll('[data-pan]')) button.onclick = () => {
    const [dr, dc] = button.dataset.pan.split(',').map(Number);
    navigate({...view(), mode: 'detail', row: view().row + dr * Math.max(1, view().size - 2), col: view().col + dc * Math.max(1, view().size - 2)});
  };
  function point(event) {
    const box = canvas.getBoundingClientRect();
    return {row: Math.max(0, Math.min(puzzle().rows - .001, (event.clientY - box.top) / box.height * puzzle().rows)),
      col: Math.max(0, Math.min(puzzle().cols - .001, (event.clientX - box.left) / box.width * puzzle().cols))};
  }
  canvas.onpointerdown = event => {
    if (event.button !== 0) return;
    event.preventDefault(); const at = point(event), b = viewBounds(puzzle(), view());
    const inside = view().mode === 'detail' && at.row >= b.row && at.row < b.row + b.rows && at.col >= b.col && at.col < b.col + b.cols;
    remember(); drag = {pointer: event.pointerId, row: inside ? at.row - b.row : Math.floor(Math.min(view().size, puzzle().rows) / 2), col: inside ? at.col - b.col : Math.floor(Math.min(view().size, puzzle().cols) / 2)};
    canvas.setPointerCapture(event.pointerId);
    update({...view(), mode: 'detail', row: Math.round(at.row - drag.row), col: Math.round(at.col - drag.col)});
  };
  canvas.onpointermove = event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const at = point(event);
    update({...view(), mode: 'detail', row: Math.round(at.row - drag.row), col: Math.round(at.col - drag.col)});
  };
  canvas.onpointerup = canvas.onpointercancel = () => {drag = null;};
  canvas.onkeydown = event => {
    const delta = {ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0]}[event.key];
    if (!delta) return;
    event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? view().size - 2 : 1;
    navigate({...view(), mode: 'detail', row: view().row + delta[0] * step, col: view().col + delta[1] * step});
  };
  function render(key) {
    const p = puzzle(), v = normalizeView(p, view()), b = viewBounds(p, v);
    if (key !== caseKey) {caseKey = key; history = []; drag = null;}
    $('view-mode').value = v.mode; $('view-size').value = v.size;
    $('view-range').textContent = `${v.mode === 'detail' ? '局部' : '全图'} · ${coord(b.row * p.cols + b.col)}–${coord((b.row + b.rows - 1) * p.cols + b.col + b.cols - 1)}`;
    $('view-back').disabled = !history.length;
    $('locate-person').disabled = progress().placements[selected()] === undefined;
    $('map-navigation').hidden = Math.max(p.rows, p.cols) <= 12 && v.mode === 'overview';
    canvas.style.aspectRatio = `${p.cols} / ${p.rows}`;
    canvas.width = 320; canvas.height = Math.max(1, Math.round(320 * p.rows / p.cols));
    const ctx = canvas.getContext('2d'), cw = canvas.width / p.cols, ch = canvas.height / p.rows;
    const source = $('show-art').checked ? p.background : '';
    if (source !== imageSource) {
      imageSource = source; image = null;
      if (source) {const candidate = new Image(); candidate.onload = () => {if (imageSource === source) {image = candidate; render(caseKey);}}; candidate.src = source;}
    }
    ctx.fillStyle = '#f8f7fb'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (image) ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    else p.cells.forEach((cell, index) => {
      ctx.fillStyle = cell.blocked ? '#68666e' : p.rooms.find(room => room.id === cell.room)?.color || '#edeaf1';
      ctx.fillRect(index % p.cols * cw, Math.floor(index / p.cols) * ch, cw, ch);
    });
    ctx.strokeStyle = '#19192235'; ctx.lineWidth = .5;
    for (let col = 0; col <= p.cols; col++) {ctx.beginPath(); ctx.moveTo(col * cw, 0); ctx.lineTo(col * cw, canvas.height); ctx.stroke();}
    for (let row = 0; row <= p.rows; row++) {ctx.beginPath(); ctx.moveTo(0, row * ch); ctx.lineTo(canvas.width, row * ch); ctx.stroke();}
    for (const [id, index] of Object.entries(progress().placements)) {
      ctx.fillStyle = id === selected() ? '#ffc830' : '#191922';
      ctx.beginPath(); ctx.arc((index % p.cols + .5) * cw, (Math.floor(index / p.cols) + .5) * ch, Math.max(2, Math.min(cw, ch) * .32), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.fillStyle = '#4d8ac720'; ctx.fillRect(b.col * cw, b.row * ch, b.cols * cw, b.rows * ch);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.strokeRect(b.col * cw + 2, b.row * ch + 2, b.cols * cw - 4, b.rows * ch - 4);
    ctx.strokeStyle = '#2575be'; ctx.lineWidth = 2.5; ctx.strokeRect(b.col * cw + 2, b.row * ch + 2, b.cols * cw - 4, b.rows * ch - 4);
    canvas.setAttribute('aria-label',`全图导航，${$('view-range').textContent}。点击或拖动观察框，方向键移动。`);
  }
  return {render, locate};
}
