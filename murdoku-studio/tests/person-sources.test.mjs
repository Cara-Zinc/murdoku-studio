import test from 'node:test';
import assert from 'node:assert/strict';
import {collectPeople, portraitPages, portraitSource} from '../public/person-sources.js';
import {makePuzzle, validatePuzzle} from '../public/engine.js';
import {recognizeRoster, relabelPeople} from '../public/people.js';

const image = 'data:image/png;base64,AA==';
const words = (name, x = .4, y = .4, height = .025) => [
  {text:name,x,y,width:.08,height},
  {text:'She was beside a tree.',x,y:y+.04,width:.1,height:.015},
];

test('roster pages use their own coordinates and preserve page ownership through relabeling', () => {
  const grid = {x:.2,y:.2,w:.6,h:.6};
  const pages = [{page:1,words:words('Anna')},{page:2,words:words('Berta')},{page:3,words:words('Carson')}];
  const suggestions = collectPeople(pages,1,grid);
  assert.deepEqual(suggestions.map(p=>[p.name,p.sourcePage]), [['Berta',2],['Carson',3]]);
  const puzzle = makePuzzle(6,6,6);
  puzzle.people = recognizeRoster(puzzle.people,suggestions);
  puzzle.mapPage=1;puzzle.originalPage=image;
  puzzle.sourcePages=[{page:2,image,text:'Berta'},{page:3,image,text:'Carson'}];
  const restored=JSON.parse(JSON.stringify(relabelPeople(puzzle,null).puzzle));
  validatePuzzle(restored);
  assert.equal(portraitSource(restored,restored.people.find(p=>p.name==='Berta')).page,2);
  assert.equal(portraitSource(restored,restored.people.find(p=>p.name==='Carson')).page,3);
});

test('duplicate names on several pages choose the larger printed label', () => {
  const people=collectPeople([{page:1,words:words('Anna',.1,.1,.02)},{page:2,words:words('Anna',.4,.4,.03)}],3,{x:0,y:0,w:1,h:1});
  assert.equal(people.length,1);assert.equal(people[0].sourcePage,2);
});

test('portrait page overrides and standalone uploads survive JSON without the PDF bytes', () => {
  const puzzle=makePuzzle();puzzle.mapPage=4;puzzle.originalPage=image;puzzle.sourcePages=[{page:2,image,text:'source'}];
  const person=puzzle.people[0];person.sourcePage=2;person.portraitPage=4;
  assert.equal(portraitSource(puzzle,person).page,4);
  person.portraitSource=image;person.portrait=image;person.portraitRect={x:0,y:0,w:1,h:1};
  const restored=validatePuzzle(JSON.parse(JSON.stringify(puzzle)));
  assert.equal(portraitSource(restored,restored.people[0]).key,'upload');
  assert.deepEqual(portraitPages(restored).map(p=>p.page),[2,4]);
});

test('legacy cases still use their original map image and invalid sources are rejected', () => {
  const puzzle=makePuzzle();puzzle.originalPage=image;
  assert.equal(portraitSource(puzzle,puzzle.people[0]).image,image);
  puzzle.people[0].sourcePage=2;assert.throws(()=>validatePuzzle(puzzle),/来源页/);
  delete puzzle.people[0].sourcePage;puzzle.people[0].portraitSource='https://example.com/face.png';assert.throws(()=>validatePuzzle(puzzle),/嵌入图片/);
  delete puzzle.people[0].portraitSource;puzzle.sourcePages=[{page:2,image,text:''},{page:2,image,text:''}];assert.throws(()=>validatePuzzle(puzzle),/必须唯一/);
});
