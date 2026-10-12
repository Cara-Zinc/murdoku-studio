import test from 'node:test';
import assert from 'node:assert/strict';
import {makePuzzle,blankState,applyMove,validatePuzzle,solve} from '../public/engine.js';
import {applyPatternGroups,validatePatternGroups,movePatternCell,mergePatternGroups,detachPatternCell,clearBlockedProgress,exclusionVisible,clusterImageFeatures,imageFeature,groupExistingCells} from '../public/patterns.js';

const group=(id,name,category,cells)=>({id,name,category,cells});
test('classification maps whole footprints to occupancy, keeps rooms, and survives JSON',()=>{
  const puzzle=makePuzzle(3,3,3);puzzle.cells.forEach(cell=>cell.room='room-1');
  puzzle.cells[0].object='old';puzzle.cells[0].blocked=true;
  puzzle.patternGroups=[group('floor','Grass','floor',[0]),group('bed','Bed','occupiable',[1,4]),group('tree','Tree','blocked',[2,5])];
  applyPatternGroups(puzzle);
  assert.equal(puzzle.cells[0].object,'');assert.equal(puzzle.cells[0].blocked,false);
  for(const i of [1,4])assert.deepEqual(puzzle.cells[i],{room:'room-1',object:'Bed',blocked:false});
  for(const i of [2,5])assert.deepEqual(puzzle.cells[i],{room:'room-1',object:'Tree',blocked:true});
  assert.deepEqual(validatePuzzle(JSON.parse(JSON.stringify(puzzle))),puzzle);
  assert.throws(()=>applyMove(puzzle,blankState(),'place',2,'A'),/不能站人/);
  assert.throws(()=>applyMove(puzzle,blankState(),'note',5,'A'),/不能站人/);
  assert.deepEqual(applyMove(puzzle,blankState(),'exclude',2,'A').excluded,[]);
});
test('malformed groups and unnamed objects are rejected before any draft cells change',()=>{
  const puzzle=makePuzzle(2,2,2),original=structuredClone(puzzle.cells);
  puzzle.patternGroups=[group('a','Tree','blocked',[0]),group('b',' ','occupiable',[1])];
  assert.throws(()=>applyPatternGroups(puzzle),/填写名称/);assert.deepEqual(puzzle.cells,original);
  for(const groups of [[group('a','x','bad',[0])],[group('a','x','floor',[4])],[group('a','x','floor',[0]),group('b','y','floor',[0])],[group('a','x','floor',[0]),group('a','y','floor',[1])]])assert.throws(()=>validatePatternGroups(groups,4));
  assert.doesNotThrow(()=>validatePatternGroups(undefined,4));
  puzzle.patternGroups=undefined;puzzle.grid={x:0,y:0,w:Infinity,h:1};assert.throws(()=>validatePuzzle(puzzle),/图像框/);
});
test('renaming all instances updates object rules; partial renames keep the original rule target',()=>{
  const puzzle=makePuzzle(2,2,2);puzzle.cells[0].object=puzzle.cells[1].object='Old';
  puzzle.people[0].rules=[{type:'on',value:'Old'}];puzzle.people[0].verified=true;
  puzzle.patternGroups=[group('a','New','occupiable',[0,1])];applyPatternGroups(puzzle);
  assert.equal(puzzle.people[0].rules[0].value,'New');assert.equal(puzzle.people[0].verified,false);
  puzzle.patternGroups=[group('a','Other','occupiable',[0])];applyPatternGroups(puzzle);
  assert.equal(puzzle.people[0].rules[0].value,'New');
});
test('reassigning, splitting, merging and manual painting never duplicate cell membership',()=>{
  const puzzle=makePuzzle(2,2,2);puzzle.patternGroups=[group('a','A','blocked',[0,1]),group('b','B','floor',[2,3])];
  movePatternCell(puzzle,2,'a');assert.deepEqual(puzzle.patternGroups[0].cells,[0,1,2]);
  puzzle.cells[1].blocked=true;movePatternCell(puzzle,1,'a');
  assert.equal(puzzle.cells[1].blocked,false);assert.equal(puzzle.patternGroups.at(-1).category,'unclassified');
  mergePatternGroups(puzzle,puzzle.patternGroups.at(-1).id,'b');detachPatternCell(puzzle,0);
  validatePatternGroups(puzzle.patternGroups,4);assert.equal(puzzle.patternGroups.flatMap(g=>g.cells).includes(0),false);
});
test('newly blocked cells clear incompatible progress but preserve usable placements and notes',()=>{
  const puzzle=makePuzzle(3,3,3),state=blankState();puzzle.cells[0].blocked=true;
  state.placements={A:0,B:4};state.notes={0:['C'],2:['C']};state.excluded=[0,1];state.checked=['A','B'];
  assert.deepEqual(clearBlockedProgress(puzzle,state),['A']);
  assert.deepEqual(state.placements,{B:4});assert.deepEqual(state.notes,{2:['C']});assert.deepEqual(state.excluded,[1]);assert.deepEqual(state.checked,['B']);
});
test('blocked cells never show crosses regardless of manual, row/column, or candidate exclusions',()=>{
  for(const manual of [false,true])for(const automatic of [false,true])for(const candidates of [false,true])assert.equal(exclusionVisible({blocked:true},false,manual,automatic,candidates),false);
  assert.equal(exclusionVisible({blocked:false},false,true,false,false),true);
  assert.equal(exclusionVisible({blocked:false},true,true,true,true),false);
});
test('image fallback groups matching features without assigning a semantic category',()=>{
  const groups=clusterImageFeatures([new Float32Array([0,0]),new Float32Array([1,1]),new Float32Array([.01,.01])],[0,1,2]);
  assert.deepEqual(groups,[[0,2],[1]]);
  const puzzle=makePuzzle(2,2,2);assert.equal(groupExistingCells(puzzle)[0].category,'unclassified');
});
test('image fallback separates a floor from repeated outlined objects',()=>{
  const pixels=object=>Uint8ClampedArray.from(Array.from({length:256},(_,i)=>{
    const x=i%16,y=Math.floor(i/16);
    if(!object||x<=2||x>=13||y<=2||y>=13)return [198,221,240,255];
    return x===3||x===12||y===3||y===12?[32,32,32,255]:[233,86,116,255];
  }).flat());
  const floor=imageFeature(pixels(false),16,16),object=imageFeature(pixels(true),16,16);
  assert.deepEqual(clusterImageFeatures([floor,object,floor,object],[0,1,2,3]),[[0,2],[1,3]]);
});
test('classification changes constrain solver candidates as well as interactive placements',()=>{
  const puzzle=makePuzzle(2,2,2);puzzle.cells.forEach(cell=>cell.room='room-1');
  puzzle.people[0].rules=[{type:'cells',value:[0]}];puzzle.people[0].verified=true;puzzle.people[1].verified=true;
  puzzle.patternGroups=[group('a','Rock','blocked',[0])];applyPatternGroups(puzzle);
  puzzle.people.forEach(person=>person.verified=true);
  assert.deepEqual(solve(puzzle).solutions,[]);
});
