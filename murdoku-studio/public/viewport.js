// View state is independent of puzzle progress and uses global cell coordinates.
export function normalizeView(puzzle, input = {}) {
  const finite = (value, fallback) => Number.isFinite(value) ? Math.trunc(value) : fallback;
  const size = [6, 8, 10, 12].includes(input?.size) ? input.size : 8;
  const mode = ['detail', 'overview'].includes(input?.mode) ? input.mode : Math.max(puzzle.rows, puzzle.cols) >= 16 ? 'detail' : 'overview';
  return {mode, size,
    row: Math.max(0, Math.min(puzzle.rows - Math.min(size, puzzle.rows), finite(input?.row, 0))),
    col: Math.max(0, Math.min(puzzle.cols - Math.min(size, puzzle.cols), finite(input?.col, 0)))};
}
export function viewBounds(puzzle, view) {
  const v = normalizeView(puzzle, view);
  return v.mode === 'overview' ? {row: 0, col: 0, rows: puzzle.rows, cols: puzzle.cols}
    : {row: v.row, col: v.col, rows: Math.min(v.size, puzzle.rows), cols: Math.min(v.size, puzzle.cols)};
}
export function containsCell(puzzle, bounds, index) {
  const row = Math.floor(index / puzzle.cols), col = index % puzzle.cols;
  return row >= bounds.row && row < bounds.row + bounds.rows && col >= bounds.col && col < bounds.col + bounds.cols;
}
export function centerView(puzzle, view, index) {
  const v = normalizeView(puzzle, {...view, mode: 'detail'});
  return normalizeView(puzzle, {...v, row: Math.floor(index / puzzle.cols) - Math.floor(Math.min(v.size, puzzle.rows) / 2), col: index % puzzle.cols - Math.floor(Math.min(v.size, puzzle.cols) / 2)});
}
export function localToGlobal(puzzle, bounds, x, y) {
  return [(bounds.col + Math.max(0, Math.min(1, x)) * bounds.cols) / puzzle.cols,
    (bounds.row + Math.max(0, Math.min(1, y)) * bounds.rows) / puzzle.rows];
}
export function globalToLocal(puzzle, bounds, x, y) {
  return [(x * puzzle.cols - bounds.col) / bounds.cols, (y * puzzle.rows - bounds.row) / bounds.rows];
}
export function parseCoordinate(puzzle, value) {
  const match = /^([A-Z]+)\s*(\d+)$/.exec(value.trim().toUpperCase());
  if (!match) return null;
  let col = 0;
  for (const letter of match[1]) col = col * 26 + letter.charCodeAt(0) - 64;
  const row = Number(match[2]) - 1;
  return row >= 0 && row < puzzle.rows && col >= 1 && col <= puzzle.cols ? row * puzzle.cols + col - 1 : null;
}
