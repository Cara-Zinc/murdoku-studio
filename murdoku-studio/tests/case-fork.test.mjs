import test from 'node:test';
import assert from 'node:assert/strict';
import {makePuzzle,blankState,validatePuzzle,validateState} from '../public/engine.js';
import {forkWorkspace} from '../public/case-fork.js';

test('fork copies current map and progress without sharing edits or other PDF sheets',()=>{
  const puzzle=makePuzzle(3,3,3),state=blankState();
  puzzle.cells[4].object='桌子';state.notes={1:['A','B']};state.placements={A:0};state.memo='假设一';
  const original={id:puzzle.id,puzzle,state,undo:[blankState()],redo:[],view:{mode:'overview'},book:{name:'case.pdf',bytes:new Uint8Array([1,2]),pages:2,page:1,sheets:{2:{puzzle:{title:'别页'}}}}};
  const fork=forkWorkspace(original,'new-case','案件 · 分支 1');
  validatePuzzle(fork.puzzle);validateState(fork.puzzle,fork.state);
  assert.equal(fork.id,'new-case');assert.equal(fork.puzzle.id,'new-case');
  assert.equal(fork.puzzle.title,'案件 · 分支 1');
  assert.deepEqual(fork.state,original.state);
  assert.deepEqual(fork.undo,[]);assert.deepEqual(fork.redo,[]);
  assert.deepEqual(fork.book.sheets,{});
  assert.deepEqual(fork.book.bytes,original.book.bytes);
  fork.puzzle.cells[4].object='';fork.state.notes[1].pop();fork.book.bytes[0]=9;
  assert.equal(original.puzzle.cells[4].object,'桌子');
  assert.deepEqual(original.state.notes[1],['A','B']);
  assert.equal(original.book.bytes[0],1);
});
