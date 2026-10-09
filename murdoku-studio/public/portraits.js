import {loadImage, cropImage} from './pdf.js';

export function clampPortraitRect(rect) {
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const w = Math.max(.005, Math.min(1, number(rect.w, .12)));
  const h = Math.max(.005, Math.min(1, number(rect.h, .16)));
  return {x: Math.max(0, Math.min(1 - w, number(rect.x, 0))),
    y: Math.max(0, Math.min(1 - h, number(rect.y, 0))), w, h};
}

// Find the black picture frame immediately above a name. Require all four
// edges, so nearby text and dark hair do not count as a portrait boundary.
export function findPortraitRect(pixels, width, height, name) {
  const cx = (name.x + name.w / 2) * width, baseline = name.y * height;
  const font = name.h * height, minWidth = Math.max(12, font * 1.3), maxWidth = Math.min(width * .25, font * 5);
  const dark = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const i = (Math.floor(y) * width + Math.floor(x)) * 4;
    return pixels[i] + pixels[i + 1] + pixels[i + 2] < 210 && pixels[i + 3] > 100;
  };
  const edge = (x1, y1, x2, y2) => {
    let hits = 0;
    for (let i = 0; i <= 24; i++) if (dark(x1 + (x2 - x1) * i / 24, y1 + (y2 - y1) * i / 24)) hits++;
    return hits / 25;
  };
  let best = null, bestScore = Infinity;
  const left = Math.max(0, Math.floor(cx - maxWidth)), right = Math.min(width - 1, Math.ceil(cx + maxWidth));
  for (let y = Math.max(0, Math.floor(baseline - font)); y <= Math.min(height - 1, baseline + font * .15); y++) {
    for (let x = left; x <= right; x++) {
      if (!dark(x, y)) continue;
      const start = x;
      while (x <= right && dark(x, y)) x++;
      const w = x - start;
      if (w < minWidth || w > maxWidth || Math.abs(start + w / 2 - cx) > w * .35) continue;
      for (let top = Math.max(0, Math.floor(y - w * 1.35)); top < y - w * .65; top++) {
        if (edge(start, top, x - 1, top) < .92 || edge(start, top, start, y) < .88 || edge(x - 1, top, x - 1, y) < .88) continue;
        const score = Math.abs(baseline - y) + Math.abs(start + w / 2 - cx) + Math.abs(y - top - w) * .25;
        if (score < bestScore) {
          bestScore = score;
          best = {x: (start + 2) / width, y: (top + 2) / height, w: (w - 4) / width, h: (y - top - 3) / height};
        }
      }
    }
  }
  return best ? clampPortraitRect(best) : null;
}

export async function matchPortraits(src, people) {
  const image = await loadImage(src), canvas = document.createElement('canvas');
  const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (const person of people) {
    if (!person.nameRect) continue;
    const rect = findPortraitRect(pixels, canvas.width, canvas.height, person.nameRect);
    if (rect) {person.portraitRect = rect; person.portrait = await cropImage(src, rect, 256);}
  }
  return people;
}
