import test from 'node:test';
import assert from 'node:assert/strict';
import {findPortraitRect, clampPortraitRect} from '../public/portraits.js';
import {suggestPeople} from '../public/pdf.js';
import {recognizeRoster} from '../public/people.js';
import {makePuzzle, validatePuzzle} from '../public/engine.js';

test('matches the closed portrait frame above the name, not neighboring ink', () => {
  const width=400, height=300, pixels=new Uint8ClampedArray(width*height*4).fill(255);
  function ink(x,y) {const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
  for(let x=40;x<=100;x++){ink(x,30);ink(x,90);}
  for(let y=30;y<=90;y++){ink(40,y);ink(100,y);}
  for(let y=50;y<65;y++)for(let x=120;x<175;x++)ink(x,y);
  const rect=findPortraitRect(pixels,width,height,{x:.12,y:.32,w:.11,h:.05});
  assert.ok(rect); assert.ok(Math.abs(rect.x-.105)<.01); assert.ok(Math.abs(rect.y-.107)<.01);
  assert.ok(Math.abs(rect.w-.1425)<.01);
  assert.equal(findPortraitRect(new Uint8ClampedArray(width*height*4).fill(255),width,height,{x:.12,y:.32,w:.11,h:.05}),null);
});

test('crop adjustments remain finite and inside the page', () => {
  const result=clampPortraitRect({x:2,y:-.5,w:.4,h:.3});
  assert.deepEqual(result,{x:.6,y:0,w:.4,h:.3});
  const invalid=clampPortraitRect({x:NaN,y:Infinity,w:-1,h:Infinity});
  assert.ok(Object.values(invalid).every(Number.isFinite));
  assert.ok(invalid.w>0 && invalid.x+invalid.w<=1 && invalid.y+invalid.h<=1);
});

test('the large portrait label wins over an earlier mention in the introduction', () => {
  const word=(text,x,y,width,height)=>({text,x,y,width,height});
  const suggestions=suggestPeople([
    word('Vivianna',.1,.02,.08,.02), word('was',.1,.05,.05,.02),
    word('Vivianna',.1,.6,.1,.04),word('The',.08,.65,.03,.02),word('Victim',.12,.65,.06,.02),
  ],{x:.5,y:.2,w:.5,h:.8});
  assert.equal(suggestions.length,1);
  assert.equal(suggestions[0].nameRect.y,.6);
});

test('portraits stay attached to names after initial-based roster mapping and JSON round trip', () => {
  const puzzle=makePuzzle(2,2,2), portrait='data:image/png;base64,AA==';
  puzzle.people=recognizeRoster(puzzle.people,[{name:'Vivianna',clue:'Victim',portrait,portraitRect:{x:.1,y:.2,w:.1,h:.1}}]);
  const restored=JSON.parse(JSON.stringify(puzzle));validatePuzzle(restored);
  assert.equal(restored.people.find(p=>p.id==='V').portrait,portrait);
  restored.people[0].portrait='https://example.com/avatar.png';
  assert.throws(()=>validatePuzzle(restored),/头像/);
  delete restored.people[0].portrait;restored.people[0].portraitRect={x:.9,y:.2,w:.3,h:.1};
  assert.throws(()=>validatePuzzle(restored),/图像框/);
});
