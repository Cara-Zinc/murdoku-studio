import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeView, viewBounds, containsCell, centerView, localToGlobal, globalToLocal, parseCoordinate} from '../public/viewport.js';
import {makePuzzle, blankState, applyMove, autoBlocked} from '../public/engine.js';

test('old saves choose a full small board and an 8×8 camera for large boards', () => {
  assert.equal(normalizeView({rows:9,cols:9}).mode,'overview');
  assert.deepEqual(viewBounds({rows:24,cols:24}),{row:0,col:0,rows:8,cols:8});
  assert.deepEqual(normalizeView({rows:24,cols:24},{mode:'bad',size:100,row:Infinity,col:-7}),{mode:'detail',size:8,row:0,col:0});
});

test('camera clamps at far edges and supports rectangular boards', () => {
  const puzzle={rows:20,cols:32};
  const v=centerView(puzzle,{},639);
  assert.deepEqual(v,{mode:'detail',size:8,row:12,col:24});
  assert.equal(containsCell(puzzle,viewBounds(puzzle,v),639),true);
  assert.equal(containsCell(puzzle,viewBounds(puzzle,v),0),false);
  assert.deepEqual(viewBounds({rows:4,cols:24},{mode:'detail',size:8,row:8,col:20}),{row:0,col:16,rows:4,cols:8});
});

test('ink remains in global coordinates across camera moves and overview', () => {
  const p={rows:24,cols:24}, b={row:8,col:8,rows:8,cols:8};
  const global=localToGlobal(p,b,.5,.25);
  assert.deepEqual(global,[.5,10/24]);
  assert.deepEqual(globalToLocal(p,b,...global),[.5,.25]);
  assert.deepEqual(globalToLocal(p,viewBounds(p,{mode:'overview'}),...global),global);
  assert.deepEqual(localToGlobal(p,b,-1,2),[8/24,16/24]);
});

test('offscreen occupants exclude local cells; moving and undoing restore candidates', () => {
  const p=makePuzzle(24,24,24), local=10*24+10, b={row:8,col:8,rows:8,cols:8};
  let s=applyMove(p,blankState(),'note',local,'B');
  const before=structuredClone(s);
  s=applyMove(p,s,'place',10*24+23,'A');
  assert.equal(containsCell(p,b,s.placements.A),false);
  assert.equal(autoBlocked(p,s,local),true);
  assert.deepEqual(s.notes[local],['B']);
  s=applyMove(p,s,'place',23*24+23,'A');
  assert.equal(autoBlocked(p,s,local),false);
  assert.equal(autoBlocked(p,before,local),false);
  assert.deepEqual(before.notes[local],['B']);
});

test('global coordinate navigation handles the 64×64 limit without ambiguous local labels', () => {
  const p={rows:64,cols:64};
  assert.equal(parseCoordinate(p,' I9 '),8*64+8);
  assert.equal(parseCoordinate(p,'BL64'),4095);
  for(const text of ['BM64','A65','A0','12','A-1'])assert.equal(parseCoordinate(p,text),null);
  const view=normalizeView(p,{mode:'detail',size:10,row:40,col:32});
  assert.deepEqual(normalizeView(p,JSON.parse(JSON.stringify(view))),view);
});
