import {t} from './i18n.js';

export const PATTERN_CATEGORIES = ['unclassified','floor','occupiable','blocked'];
const objectRules = ['on','beside','notBeside','roomContains','otherOn','otherBeside'];

export function validatePatternGroups(groups, cellCount) {
  if (groups === undefined) return;
  if (!Array.isArray(groups) || groups.length > cellCount) throw Error(t('图案分组无效。'));
  const ids = new Set(), cells = new Set();
  for (const group of groups) {
    if (!group || typeof group.id !== 'string' || !group.id || group.id.length > 100 || ids.has(group.id)
      || typeof group.name !== 'string' || group.name.length > 120 || !PATTERN_CATEGORIES.includes(group.category)
      || !Array.isArray(group.cells) || !group.cells.length) throw Error(t('图案分组无效。'));
    ids.add(group.id);
    if (['occupiable','blocked'].includes(group.category) && !group.name.trim()) throw Error(t('请为可占用或不可占用的物品填写名称。'));
    for (const cell of group.cells) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= cellCount || cells.has(cell)) throw Error(t('图案分组的格子重复或超出范围。'));
      cells.add(cell);
    }
  }
}

export function seedPatternGroups(puzzle, clusters) {
  return clusters.filter(cells=>cells.length).map((cells, index)=>{
    const previous = puzzle.patternGroups?.find(group=>group.cells.length===cells.length && group.cells.every(cell=>cells.includes(cell)));
    if (previous) return {...previous,cells:[...cells]};
    const first = puzzle.cells[cells[0]], uniform = cells.every(i=>puzzle.cells[i].object===first.object && puzzle.cells[i].blocked===first.blocked);
    return {id:`pattern-${index}`,name:uniform?first.object:'',category:uniform&&first.object?(first.blocked?'blocked':'occupiable'):'unclassified',cells:[...cells]};
  });
}

export function groupExistingCells(puzzle) {
  const groups = new Map();
  puzzle.cells.forEach((cell,i)=>{
    const key = JSON.stringify([cell.object,cell.blocked,cell.object?'':cell.room]);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(i);
  });
  return seedPatternGroups(puzzle,[...groups.values()]);
}

// Classification is applied to a draft only after every named object validates.
export function applyPatternGroups(puzzle) {
  const groups = (puzzle.patternGroups||[]).filter(group=>group.cells.length);
  validatePatternGroups(groups,puzzle.cells.length);
  const rename = new Map();
  let changed = false;
  for (const group of groups) {
    group.name = group.name.trim();
    if (group.category==='unclassified') continue;
    for (const i of group.cells) {
      const cell = puzzle.cells[i], name = group.category==='floor'?'':group.name, blocked = group.category==='blocked';
      if (cell.object && cell.object!==name && name) {
        if (!rename.has(cell.object)) rename.set(cell.object,new Set());
        rename.get(cell.object).add(name);
      }
      changed ||= cell.object!==name || cell.blocked!==blocked;
      cell.object=name;cell.blocked=blocked;
    }
  }
  if (changed) for (const person of puzzle.people) {
    person.verified=false;
    for (const rule of person.rules) {
      const names = rename.get(rule.value);
      if (objectRules.includes(rule.type) && names?.size===1 && !puzzle.cells.some(cell=>cell.object===rule.value)) rule.value=[...names][0];
    }
  }
  puzzle.patternGroups=groups;
  return changed;
}

export function detachPatternCell(puzzle,cell) {
  if (!puzzle.patternGroups) return;
  puzzle.patternGroups=puzzle.patternGroups.map(group=>({...group,cells:group.cells.filter(i=>i!==cell)})).filter(group=>group.cells.length);
}

export function movePatternCell(puzzle,cell,groupId) {
  const target = puzzle.patternGroups.find(group=>group.id===groupId);
  if (!target) return;
  const remove = target.cells.includes(cell);
  for (const group of puzzle.patternGroups) group.cells=group.cells.filter(i=>i!==cell);
  if (remove) {
    let n=0;while(puzzle.patternGroups.some(group=>group.id===`manual-${n}`)) n++;
    puzzle.patternGroups.push({id:`manual-${n}`,name:'',category:'unclassified',cells:[cell]});
    puzzle.cells[cell].object='';puzzle.cells[cell].blocked=false;
  } else {target.cells.push(cell);target.cells.sort((a,b)=>a-b);}
  puzzle.patternGroups=puzzle.patternGroups.filter(group=>group.cells.length);
}

export function mergePatternGroups(puzzle,sourceId,targetId) {
  const source=puzzle.patternGroups.find(group=>group.id===sourceId),target=puzzle.patternGroups.find(group=>group.id===targetId);
  if (!source || !target || source===target) return;
  target.cells=[...new Set([...target.cells,...source.cells])].sort((a,b)=>a-b);
  puzzle.patternGroups=puzzle.patternGroups.filter(group=>group!==source);
}

export function clearBlockedProgress(puzzle,state) {
  const removed=[];
  for (const [id,cell] of Object.entries(state.placements)) if (puzzle.cells[cell].blocked) {delete state.placements[id];removed.push(id);}
  for (const cell of Object.keys(state.notes)) if (puzzle.cells[cell].blocked) delete state.notes[cell];
  state.excluded=state.excluded.filter(cell=>!puzzle.cells[cell].blocked);
  state.checked=state.checked.filter(id=>!removed.includes(id));
  return removed;
}

export function exclusionVisible(cell,occupied,manual,automatic,candidates) {
  return !cell.blocked && !occupied && (manual || automatic || candidates);
}

export function imageFeature(pixels,width,height) {
  const feature = new Float32Array(4*4*4+3), sums = [0,0,0];
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const offset=(y*width+x)*4, bin=(Math.min(3,Math.floor(y/height*4))*4+Math.min(3,Math.floor(x/width*4)))*4;
    for (let c=0;c<3;c++) {feature[bin+c]+=pixels[offset+c]/255;sums[c]+=pixels[offset+c]/255;}
    feature[bin+3]+=Math.max(pixels[offset],pixels[offset+1],pixels[offset+2])<115?1:0;
  }
  const count=width*height/16;
  for (let i=0;i<64;i++) feature[i]/=count;
  for (let c=0;c<3;c++) {
    const background=sums[c]/(width*height);feature[64+c]=background*.5;
    for (let bin=0;bin<16;bin++) feature[bin*4+c]-=background;
  }
  return feature;
}

export function clusterImageFeatures(features,indices,threshold=.012) {
  const groups=[];
  for (const index of indices) {
    const feature=features[index];let best=Infinity,winner=null;
    for (const group of groups) {
      let distance=0;for(let j=0;j<feature.length;j++) distance+=(feature[j]-group.center[j])**2;
      distance/=feature.length;
      if (distance<best) {best=distance;winner=group;}
    }
    if (!winner || best>threshold) groups.push({cells:[index],center:Float32Array.from(feature)});
    else {winner.cells.push(index);for(let j=0;j<feature.length;j++) winner.center[j]+=(feature[j]-winner.center[j])/winner.cells.length;}
  }
  return groups.map(group=>group.cells);
}
