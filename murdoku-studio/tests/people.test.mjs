import test from 'node:test';
import assert from 'node:assert/strict';
import {makePuzzle, blankState, validatePuzzle, validateState} from '../public/engine.js';
import {nameInitial, recognizeRoster, relabelPeople} from '../public/people.js';

test('PDF extraction order does not determine the initials or the victim slot', () => {
  const p = makePuzzle(4, 4, 4);
  p.people = recognizeRoster(p.people, [
    {name: 'Vivianna', clue: 'The Victim.'},
    {name: 'Carolina', clue: 'She was near a bed.'},
    {name: 'Angelo', clue: 'He was near a box.'},
    {name: 'Blake', clue: 'He was in the Bedroom.'},
  ]);
  assert.deepEqual(p.people.map(x => [x.id, x.name, x.victim]), [
    ['A', 'Angelo', false], ['B', 'Blake', false],
    ['C', 'Carolina', false], ['V', 'Vivianna', true],
  ]);
  validatePuzzle(p);
});

test('missing names leave their own placeholders without shifting later letters', () => {
  const p = makePuzzle(4, 4, 4);
  p.people = recognizeRoster(p.people, [{name: 'Carolina', clue: 'C clue'}, {name: 'Vivianna', clue: 'V clue'}]);
  assert.equal(p.people.find(x => x.id === 'A').name, '人物 A');
  assert.equal(p.people.find(x => x.id === 'C').name, 'Carolina');
  assert.equal(p.people.find(x => x.id === 'V').name, 'Vivianna');
});

test('names beyond the initial placeholder range still keep their actual initials', () => {
  const people = recognizeRoster(makePuzzle(3, 3, 3).people, [
    {name: 'Howie', clue: 'H'}, {name: 'Greg', clue: 'G'}, {name: 'Vivianna', clue: 'V'},
  ]);
  assert.deepEqual(people.map(x => x.id), ['H', 'G', 'V']);
});

test('duplicate initials are unique and do not take another person’s preferred ID', () => {
  const people = recognizeRoster(makePuzzle(4, 4, 4).people, [
    {name: 'Anna', clue: 'A'}, {name: 'Alice', clue: 'A2'},
    {name: 'Blake', clue: 'B'}, {name: 'Vivianna', clue: 'V'},
  ]);
  assert.deepEqual(people.map(x => x.id), ['A', 'B', 'AA', 'V']);
  assert.equal(new Set(people.map(x => x.id)).size, 4);
});

test('repairing an existing roster remaps every reference simultaneously', () => {
  const p = makePuzzle(3, 3, 3);
  p.people[0].name = 'Blake'; p.people[1].name = 'Vivianna'; p.people[2].name = 'Angelo';
  p.people[0].rules = [{type: 'with', value: 'V'}];
  const state = {...blankState(), placements: {A: 0, B: 4, V: 8}, notes: {2: ['A', 'V']}, checked: ['B'], accusation: 'A'};
  const result = relabelPeople(p, state, true);
  assert.deepEqual(result.state.placements, {B: 0, V: 4, A: 8});
  assert.deepEqual(result.state.notes, {2: ['B', 'A']});
  assert.deepEqual(result.state.checked, ['V']);
  assert.equal(result.state.accusation, 'B');
  assert.equal(result.puzzle.people[0].rules[0].value, 'A');
  assert.equal(result.puzzle.people.find(x => x.victim).name, 'Vivianna');
  assert.equal(p.people[0].id, 'A');
  assert.deepEqual(state.placements, {A: 0, B: 4, V: 8});
  validatePuzzle(result.puzzle); validateState(result.puzzle, result.state);
});

test('non-Latin names retain their labels; whitespace and accents are normalized', () => {
  assert.equal(nameInitial('  élise'), 'E');
  const p = makePuzzle(2, 2, 2); p.people[0].name = '安娜';
  assert.deepEqual(relabelPeople(p, blankState()).puzzle.people.map(x => x.id), ['A', 'V']);
});
