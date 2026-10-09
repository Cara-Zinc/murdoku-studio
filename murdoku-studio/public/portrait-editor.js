import {loadImage, cropImage} from './pdf.js';
import {clampPortraitRect} from './portraits.js';

// Resolve a crop into the caller's draft only when the user applies it.
export async function editPortrait({source, rect, name}) {
  const image = await loadImage(source), $ = id => document.getElementById(id);
  const dialog = $('portrait-dialog'), selection = $('portrait-selection');
  const initial = clampPortraitRect(rect || {x: .05, y: .15, w: .12, h: .12 * image.width / image.height});
  let current = {...initial}, drag = null, result = null;
  $('portrait-title').textContent = `调整头像 · ${name}`;
  $('portrait-page-image').src = source;
  $('portrait-status').textContent = '';
  $('apply-portrait').disabled = false;
  function update() {
    current = clampPortraitRect(current);
    Object.assign(selection.style, {left: `${current.x * 100}%`, top: `${current.y * 100}%`, width: `${current.w * 100}%`, height: `${current.h * 100}%`});
    document.querySelectorAll('[data-portrait-rect]').forEach(input => {input.value = (current[input.dataset.portraitRect] * 100).toFixed(2);});
    const canvas = $('portrait-crop-preview'), ctx = canvas.getContext('2d');
    const ratio = current.h * image.height / (current.w * image.width);
    canvas.width = Math.max(1, Math.round(Math.min(160, 256 / ratio)));
    canvas.height = Math.max(1, Math.round(Math.min(256, 160 * ratio)));
    ctx.drawImage(image, current.x * image.width, current.y * image.height, current.w * image.width, current.h * image.height, 0, 0, canvas.width, canvas.height);
  }
  document.querySelectorAll('[data-portrait-rect]').forEach(input => {input.oninput = () => {current[input.dataset.portraitRect] = Number(input.value) / 100; update();};});
  selection.onpointerdown = event => {
    event.preventDefault(); const bounds = $('portrait-page').getBoundingClientRect();
    drag = {x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height, rect: {...current}, handle: event.target.dataset.handle};
    selection.setPointerCapture(event.pointerId);
  };
  selection.onpointermove = event => {
    if (!drag) return;
    const dx = (event.clientX - drag.x) / drag.width, dy = (event.clientY - drag.y) / drag.height, r = drag.rect, handle = drag.handle;
    current = {...r};
    if (!handle) {current.x += dx; current.y += dy;}
    else {
      if (handle.includes('w')) {current.x = Math.max(0, Math.min(r.x + r.w - .005, r.x + dx)); current.w = r.x + r.w - current.x;}
      if (handle.includes('n')) {current.y = Math.max(0, Math.min(r.y + r.h - .005, r.y + dy)); current.h = r.y + r.h - current.y;}
      if (handle.includes('e')) current.w = Math.min(1 - r.x, r.w + dx);
      if (handle.includes('s')) current.h = Math.min(1 - r.y, r.h + dy);
    }
    update();
  };
  selection.onpointerup = selection.onpointercancel = () => {drag = null;};
  selection.onkeydown = event => {
    const delta = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (!delta) return;
    event.preventDefault(); const step = event.shiftKey ? .01 : .001;
    current.x += delta[0] * step; current.y += delta[1] * step; update();
  };
  $('reset-portrait').onclick = () => {current = {...initial}; update();};
  $('apply-portrait').onclick = async () => {
    $('apply-portrait').disabled = true;
    try {
      const portraitRect = {...current}, portrait = await cropImage(source, portraitRect, 256);
      if (!dialog.open) return;
      result = {portraitRect, portrait}; dialog.close();
    } catch (error) {$('portrait-status').textContent = error.message;}
    finally {$('apply-portrait').disabled = false;}
  };
  update();
  return new Promise(resolve => {
    dialog.onclose = () => {drag = null; resolve(result);};
    dialog.showModal(); selection.focus({preventScroll: true});
  });
}
