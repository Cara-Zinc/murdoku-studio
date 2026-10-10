import {suggestPeople} from './pdf.js';

// Coordinates belong to their source page, never to the selected map page.
export function collectPeople(pages, mapPage, grid) {
  const names = new Map();
  for (const page of pages) {
    const excluded = page.page === mapPage ? grid : {x: 2, y: 2, w: 0, h: 0};
    for (const person of suggestPeople(page.words || [], excluded)) {
      const key = person.name.trim().toLowerCase();
      const previous = names.get(key);
      if (!previous || person.nameRect.h > previous.nameRect.h) names.set(key, {...person, sourcePage: page.page});
    }
  }
  return [...names.values()].slice(0, 64);
}

export function portraitPages(puzzle) {
  const pages = [];
  if (puzzle.originalPage) pages.push({page: puzzle.mapPage || 1, image: puzzle.originalPage, text: puzzle.extractedText || ''});
  for (const page of puzzle.sourcePages || []) if (!pages.some(p => p.page === page.page)) pages.push(page);
  return pages.sort((a, b) => a.page - b.page);
}

export function portraitSource(puzzle, person) {
  if (person.portraitSource) return {image: person.portraitSource, key: 'upload'};
  const page = person.portraitPage ?? person.sourcePage ?? puzzle.mapPage ?? 1;
  const found = portraitPages(puzzle).find(item => item.page === page);
  return found ? {...found, key: String(page)} : null;
}
