import test from 'node:test';
import assert from 'node:assert/strict';
import {makePuzzle,blankState,validatePuzzle,validateState,applyMove,autoBlocked,assess,solve,neighbors,ruleHolds,coverage} from '../public/engine.js';
import {demoPuzzle} from '../public/demo.js';
import {detectGridPixels,refineGridPixels,pageText} from '../public/pdf.js';

test('original demonstration has exactly one solution and the correct murderer',()=>{
  const p=demoPuzzle(), result=solve(p);
  assert.equal(result.truncated,false);assert.equal(result.solutions.length,1);
  assert.deepEqual(result.solutions[0],{A:1,B:10,C:12,D:23,E:26,V:33});
  const state={...blankState(),placements:result.solutions[0]};
  assert.deepEqual(assess(p,state),{complete:true,errors:[],verified:true,killer:'D'});
});
test('beside excludes diagonals and neighbors across room boundaries',()=>{
  const p=demoPuzzle();assert.deepEqual(neighbors(p,2),[8,1]);
  assert.equal(ruleHolds(p,p.people[0],7,{type:'beside',value:'桌子'},{},false),false);
});
test('placing and moving a person never destroys candidates or explicit exclusions',()=>{
  const p=demoPuzzle();let s=applyMove(p,blankState(),'note',2,'A');
  s=applyMove(p,s,'exclude',3);s=applyMove(p,s,'place',1,'A');
  assert.equal(autoBlocked(p,s,2),true);assert.deepEqual(s.notes[2],['A']);assert.deepEqual(s.excluded,[3]);
  s=applyMove(p,s,'place',13,'A');assert.equal(autoBlocked(p,s,2),false);assert.deepEqual(s.notes[2],['A']);
});
test('placement-derived crosses cover exactly the other row and column cells',()=>{
  const p=makePuzzle(3,4,3), empty=blankState();
  const notes=applyMove(p,empty,'note',5,'A');
  assert.equal(p.cells.some((_,i)=>autoBlocked(p,notes,i)),false);
  const placed=applyMove(p,notes,'place',5,'A');
  assert.deepEqual(p.cells.flatMap((_,i)=>autoBlocked(p,placed,i)?[i]:[]),[1,4,6,7,9]);
  const removed=applyMove(p,placed,'erase',5);
  assert.equal(p.cells.some((_,i)=>autoBlocked(p,removed,i)),false);
  const multiple=applyMove(p,placed,'place',10,'B');
  const moved=applyMove(p,multiple,'place',0,'A');
  assert.equal(autoBlocked(p,moved,6),true); // B still excludes this column.
  assert.equal(autoBlocked(p,moved,7),false); // A's former row is restored.
  assert.equal(autoBlocked(p,placed,7),true); // Undo snapshot is unchanged.
});
test('one person cannot occupy two cells and another person cannot be overwritten',()=>{
  const p=demoPuzzle();let s=applyMove(p,blankState(),'place',1,'A');
  s=applyMove(p,s,'place',2,'A');assert.deepEqual(s.placements,{A:2});
  assert.throws(()=>applyMove(p,s,'place',2,'B'),/已有/);
  assert.throws(()=>applyMove(p,s,'place',0,'B'),/不能站人/);
});
test('row and column violations are flagged without rejecting exploratory moves',()=>{
  const p=demoPuzzle(),s={...blankState(),placements:{A:1,B:7}};
  assert.ok(assess(p,s).errors.some(e=>e.message.includes('同一行或同一列')));
});
test('victim must have exactly one companion',()=>{
  const p=makePuzzle(3,3,3);p.cells.forEach(c=>c.room='room-1');
  assert.ok(assess(p,{...blankState(),placements:{A:0,B:4,V:8}}).errors.some(e=>e.message.includes('独处')));
});
test('a case with no victim saves as a draft and cannot report a solved murder',()=>{
  const p=demoPuzzle();p.people.forEach(person=>person.victim=false);
  const restored=validatePuzzle(JSON.parse(JSON.stringify(p)));
  const state={...blankState(),placements:{A:1,B:10,C:12,D:23,E:26,V:33}};
  assert.equal(restored.people.some(person=>person.victim),false);
  assert.equal(coverage(restored),false);
  assert.deepEqual(assess(restored,state),{complete:true,errors:[],verified:false,killer:null});
  assert.equal(solve(restored).incomplete,true);
});
test('unverified imported clues never report a verified completion or solver answer',()=>{
  const p=demoPuzzle();p.people[0].verified=false;
  assert.equal(coverage(p),false);assert.equal(solve(p).incomplete,true);
});
test('relational constraints are deferred for missing partners and enforced at completion',()=>{
  const p=demoPuzzle(),person=p.people[0];
  assert.equal(ruleHolds(p,person,1,{type:'with',value:'B'},{},false),true);
  assert.equal(ruleHolds(p,person,1,{type:'with',value:'B'},{B:10},true),false);
  assert.equal(ruleHolds(p,person,1,{type:'otherOn',value:'椅子'},{B:10},true),false);
  assert.equal(ruleHolds(p,person,11,{type:'otherOn',value:'椅子'},{B:10},true),true);
});
test('solver distinguishes multiple solutions and search exhaustion',()=>{
  const p=makePuzzle(2,2,2);p.cells.forEach(c=>c.room='room-1');p.people.forEach(x=>{x.verified=true;x.rules=[{type:'room',value:'room-1'}];});
  assert.equal(solve(p).solutions.length,2);assert.equal(solve(p,{},2,1).truncated,true);
});
test('another person on an object respects an explicit gender constraint',()=>{
  const p=demoPuzzle();p.people.find(x=>x.id==='B').gender='male';
  const rule={type:'otherOn',value:'椅子',gender:'male'};
  assert.equal(ruleHolds(p,p.people[0],11,rule,{B:10},true),true);
  assert.equal(ruleHolds(p,p.people[0],11,{...rule,gender:'female'},{B:10},true),false);
});
test('schema rejects unknown rules, bad coordinates, invalid victims and external images',()=>{
  const p=demoPuzzle();p.people[0].rules.push({type:'arbitrary'});assert.throws(()=>validatePuzzle(p),/未知/);
  const q=demoPuzzle();q.people[0].rules=[{type:'row',value:99}];assert.throws(()=>validatePuzzle(q),/超出/);
  const r=demoPuzzle();r.people[0].victim=true;assert.throws(()=>validatePuzzle(r),/受害者/);
  const x=demoPuzzle();x.background='https://example.com/a.png';assert.throws(()=>validatePuzzle(x),/背景/);
  assert.throws(()=>validateState(demoPuzzle(),{...blankState(),placements:{A:-1}}),/位置/);
});
test('grid detector finds the principal regular grid in a raster',()=>{
  const width=500,height=600,pixels=new Uint8ClampedArray(width*height*4).fill(255);
  function black(x,y){const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
  for(let n=0;n<=6;n++)for(let offset=0;offset<2;offset++){
    for(let y=150;y<=450;y++)black(100+n*50+offset,y);
    for(let x=100;x<=400;x++)black(x,150+n*50+offset);
  }
  const grid=detectGridPixels(pixels,width,height);assert.ok(grid);assert.equal(grid.rows,6);assert.equal(grid.cols,6);assert.ok(Math.abs(grid.x-.2)<.01);assert.ok(Math.abs(grid.y-.25)<.01);
});
test('page text uses the full PDF response and supports older word-only responses',()=>{
  assert.equal(pageText({text:'Anna\nComplete clue',words:[{text:'Anna'}]}),'Anna\nComplete clue');
  assert.equal(pageText({words:[{text:'Anna'},{text:'clue'}]}),'Anna clue');
});

test('grid detector retains dense grids with fractional pixel spacing',()=>{
  const width=900,height=900,start=70,span=743;
  for(const count of [8,10,12,16,24]){
    const pixels=new Uint8ClampedArray(width*height*4).fill(255);
    for(let k=0;k<=count;k++){
      const position=Math.round(start+k*span/count);
      for(let j=start;j<=start+span;j++)for(let offset=0;offset<2;offset++){
        for(const index of [(j*width+position+offset)*4,((position+offset)*width+j)*4])pixels.fill(0,index,index+3);
      }
    }
    const grid=detectGridPixels(pixels,width,height);
    assert.ok(grid,`${count}×${count} grid detected`);
    assert.equal(grid.rows,count);assert.equal(grid.cols,count);
    assert.ok(Math.abs(grid.x-start/width)<1/width);
    assert.ok(Math.abs(grid.w-span/width)<1/width);
  }
});

test('grid bounds stop at the frame despite aligned marks outside it',()=>{
  const width=1100,height=850,pixels=new Uint8ClampedArray(width*height*4).fill(255);
  const left=558,top=240,step=32.75,count=16,span=step*count;
  const fill=(x,y,w,h,value=0)=>{
    for(let yy=Math.max(0,Math.round(y));yy<Math.min(height,Math.round(y+h));yy++)
      for(let xx=Math.max(0,Math.round(x));xx<Math.min(width,Math.round(x+w));xx++){
        const i=(yy*width+xx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=value;
      }
  };
  for(let k=0;k<=count;k++){
    const thickness=k===0||k===count?7:2;
    fill(left+k*step-thickness/2,top,thickness,span);
    fill(left,top+k*step-thickness/2,span,thickness);
  }
  // Partial illustrations obscure the top stroke; nearby text extends its rhythm.
  for(const k of [3,7,12])fill(left+k*step-8,top-4,16,10,255);
  for(let k=0;k<16;k++){
    fill(left+k*step,top+span+step-1,16,2);
    fill(left+k*step,top+span+2*step-1,16,2);
  }
  const grid=detectGridPixels(pixels,width,height);
  assert.ok(grid);assert.equal(grid.rows,count);assert.equal(grid.cols,count);
  assert.ok(Math.abs(grid.y*height-top)<3);
  assert.ok(Math.abs(grid.h*height-span)<3);
  const refined=refineGridPixels(pixels,width,height,grid);
  for(const [actual,expected] of [[refined.x*width,left],[refined.y*height,top],[refined.w*width,span],[refined.h*height,span]])assert.ok(Math.abs(actual-expected)<1);
});
