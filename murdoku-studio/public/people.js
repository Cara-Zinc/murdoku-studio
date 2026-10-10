import {clone, personLabel} from './engine.js';

export function nameInitial(name) {
  return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/^[a-z]/i)?.[0].toUpperCase() || '';
}

// Match names to their letter slots before filling unmatched slots. PDF text order
// is unrelated to roster order; in particular, V may be extracted first.
export function recognizeRoster(defaults, suggestions) {
  const people = clone(defaults), assigned = new Set();
  const initials = new Set(suggestions.map(person => nameInitial(person.name)));
  for (const suggestion of suggestions) {
    const initial = nameInitial(suggestion.name);
    if (!initial) continue;
    let index = people.findIndex((person, i) => !assigned.has(i) && person.id === initial);
    if (index < 0) index = people.findIndex((person, i) => !assigned.has(i) && !initials.has(person.id) && !person.victim);
    if (index < 0) continue;
    Object.assign(people[index], {name: suggestion.name, clue: suggestion.clue});
    for (const key of ['nameRect', 'portraitRect', 'portrait', 'sourcePage']) {
      if (suggestion[key] !== undefined) people[index][key] = clone(suggestion[key]);
    }
    assigned.add(index);
  }
  return relabelPeople({people}, null).puzzle.people;
}

// Apply one simultaneous rename to every reference; swapping A/B must not merge
// their placements, notes, or relational rules. Non-Latin labels stay unchanged.
export function relabelPeople(puzzle, state, inferVictim = false) {
  const next = clone(puzzle), progress = state ? clone(state) : null;
  const victimNames = next.people.filter(person => nameInitial(person.name) === 'V');
  if (inferVictim && victimNames.length === 1) {
    next.people.forEach(person => { person.victim = person === victimNames[0]; });
  }
  const preferred = next.people.map(person => nameInitial(person.name) || person.id);
  const reserved = new Set(preferred), used = new Set(), mapping = {};
  // Actual names have priority over unnamed slots when their initials collide.
  const order = next.people.map((_, i) => i).sort((a, b) => Number(!!nameInitial(next.people[b].name)) - Number(!!nameInitial(next.people[a].name)));
  for (const index of order) {
    const person = next.people[index], initial = preferred[index];
    let id = initial, suffix = 0;
    while (used.has(id) || (id !== initial && reserved.has(id))) {
      id = initial[0] + personLabel(suffix++);
    }
    used.add(id); mapping[person.id] = id;
  }
  for (const person of next.people) {
    person.id = mapping[person.id];
    for (const rule of person.rules) {
      if (['with', 'notWith'].includes(rule.type)) rule.value = mapping[rule.value] || rule.value;
    }
  }
  if (progress) {
    progress.placements = Object.fromEntries(Object.entries(progress.placements).map(([id, cell]) => [mapping[id] || id, cell]));
    progress.notes = Object.fromEntries(Object.entries(progress.notes).map(([cell, ids]) => [cell, ids.map(id => mapping[id] || id)]));
    progress.checked = progress.checked.map(id => mapping[id] || id);
    if (progress.accusation) progress.accusation = mapping[progress.accusation] || progress.accusation;
  }
  return {puzzle: next, state: progress};
}
