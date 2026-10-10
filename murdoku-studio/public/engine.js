// All coordinates are zero-based. Auto exclusions are derived, never destructive.
export const clone = (value) => structuredClone(value);
export function blankState() {
  return { placements: {}, notes: {}, excluded: [], colors: {}, checked: [], ink: [], elapsed: 0, accusation: null };
}
export function personLabel(index) {
  let n = index, label = '';
  do { label = String.fromCharCode(65 + n % 26) + label; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return label;
}
export function makePuzzle(rows = 9, cols = rows, count = rows) {
  let index = 0;
  const people = Array.from({length: count}, (_, i) => {
    let id;
    do { id = personLabel(index++); } while (id === 'V');
    if (i === count - 1) id = 'V';
    return {id, name: i === count - 1 ? '受害者' : `人物 ${id}`, clue: '', rules: [], verified: false, victim: i === count - 1};
  });
  return {version: 1, id: crypto.randomUUID(), title: '新案件', rows, cols, people,
    rooms: [{id:'room-1', name:'区域 1', color:'#dce7ec'}], cells: Array.from({length: rows * cols}, () => ({room:'', object:'', blocked:false})), background: '', source: '', grid: null};
}
export const RULE_TYPES = ['room','notRoom','row','col','on','beside','notBeside','with','notWith','alone','roomContains','otherOn','otherBeside','cells'];
export function validatePuzzle(p) {
  if (!p || p.version !== 1 || !Number.isInteger(p.rows) || !Number.isInteger(p.cols) || p.rows < 1 || p.cols < 1 || p.rows > 64 || p.cols > 64) throw Error('网格尺寸必须是 1–64 的整数。');
  if (typeof p.id !== 'string' || !p.id || p.id.length > 150 || typeof p.title !== 'string' || p.title.length > 200 || typeof p.source !== 'string') throw Error('案件编号、标题或来源无效。');
  if (!Array.isArray(p.cells) || p.cells.length !== p.rows * p.cols) throw Error('格子数量与网格尺寸不一致。');
  if (!Array.isArray(p.people) || !p.people.length || p.people.length > 64 || new Set(p.people.map(x=>x.id)).size !== p.people.length) throw Error('人物编号必须唯一，人数为 1–64。');
  if (p.people.filter(x=>x.victim).length > 1) throw Error('最多只能指定一名受害者。');
  if (!Array.isArray(p.rooms) || p.rooms.length > 128 || new Set(p.rooms.map(x=>x.id)).size !== p.rooms.length) throw Error('区域配置无效。');
  const ids = new Set(p.people.map(x=>x.id)), rooms = new Set(p.rooms.map(x=>x.id));
  for (const room of p.rooms) if (!room || typeof room.id !== 'string' || !room.id || typeof room.name !== 'string' || !/^#[0-9a-f]{6}$/i.test(room.color)) throw Error('区域名称或颜色无效。');
  for (const cell of p.cells) {
    if (!cell || typeof cell.blocked !== 'boolean' || typeof cell.object !== 'string' || (cell.room && !rooms.has(cell.room))) throw Error('格子的区域或物品无效。');
  }
  for (const image of [p.background,p.originalPage]) if (image && (typeof image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(image))) throw Error('背景必须是嵌入的 PNG、JPEG 或 WebP 图片。');
  const embeddedImage = image => typeof image === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(image);
  const pageNumber = value => Number.isInteger(value) && value >= 1 && value <= 10000;
  if (p.mapPage !== undefined && !pageNumber(p.mapPage)) throw Error('地图页码无效。');
  if (p.sourcePages !== undefined) {
    if (!Array.isArray(p.sourcePages) || p.sourcePages.length > 64 || new Set(p.sourcePages.map(page => page?.page)).size !== p.sourcePages.length) throw Error('人物来源页必须唯一，最多 64 页。');
    for (const page of p.sourcePages) if (!page || !pageNumber(page.page) || !embeddedImage(page.image) || typeof page.text !== 'string') throw Error('人物来源页必须包含有效页码、嵌入图片和文本。');
  }
  if (p.extractedText !== undefined && typeof p.extractedText !== 'string') throw Error('提取的页面文字无效。');
  for (const person of p.people) {
    if (typeof person.id !== 'string' || !/^[A-Z]{1,3}$/.test(person.id) || typeof person.name !== 'string' || typeof person.clue !== 'string' || !Array.isArray(person.rules) || typeof person.verified !== 'boolean' || typeof person.victim !== 'boolean') throw Error('人物数据无效。');
    if (person.portrait !== undefined && (typeof person.portrait !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(person.portrait))) throw Error('人物头像必须是嵌入的 PNG、JPEG 或 WebP 图片。');
    if (person.portraitSource !== undefined && !embeddedImage(person.portraitSource)) throw Error('上传头像的原图必须是嵌入图片。');
    for (const field of ['sourcePage', 'portraitPage']) if (person[field] !== undefined) {
      if (!pageNumber(person[field]) || (person[field] !== (p.mapPage || 1) && !(p.sourcePages || []).some(page => page.page === person[field]))) throw Error('人物引用了不存在的来源页。');
    }
    for (const rect of [person.portraitRect, person.nameRect]) {
      if (rect !== undefined && (!rect || !['x','y','w','h'].every(key => Number.isFinite(rect[key])) || rect.x < 0 || rect.y < 0 || rect.w <= 0 || rect.h <= 0 || rect.x + rect.w > 1.000001 || rect.y + rect.h > 1.000001)) throw Error('人物图像框必须在原页范围内。');
    }
    if (person.gender !== undefined && !['','male','female'].includes(person.gender)) throw Error('人物性别配置无效。');
    for (const r of person.rules) {
      if (!r || !RULE_TYPES.includes(r.type)) throw Error('未知的线索规则。');
      if (r.gender !== undefined && !['','male','female'].includes(r.gender)) throw Error('规则中的人物性别无效。');
      if (['room','notRoom'].includes(r.type) && !rooms.has(r.value)) throw Error('规则引用了不存在的区域。');
      if (['with','notWith'].includes(r.type) && (!ids.has(r.value) || r.value === person.id)) throw Error('同伴规则必须引用另一名人物。');
      if (['row','col'].includes(r.type) && (!Number.isInteger(r.value) || r.value < 0 || r.value >= (r.type === 'row' ? p.rows : p.cols))) throw Error('规则坐标超出棋盘。');
      if (r.type === 'cells' && (!Array.isArray(r.value) || !r.value.length || r.value.some(i=>!Number.isInteger(i)||i<0||i>=p.cells.length))) throw Error('允许位置列表无效。');
      if (['on','beside','notBeside','roomContains','otherOn','otherBeside'].includes(r.type) && (typeof r.value !== 'string' || !r.value.trim())) throw Error('物品名称不能为空。');
    }
  }
  return p;
}
export function validateState(p, s) {
  const state = {...blankState(), ...s}, ids = new Set(p.people.map(x=>x.id));
  if (!state.placements || !state.notes || !state.colors || Array.isArray(state.placements) || Array.isArray(state.notes) || typeof state.colors !== 'object' || !Array.isArray(state.excluded) || !Array.isArray(state.checked) || !Array.isArray(state.ink)) throw Error('存档格式无效。');
  const validCell = i => Number.isInteger(i) && i >= 0 && i < p.cells.length;
  for (const [id, i] of Object.entries(state.placements)) if (!ids.has(id) || !validCell(i)) throw Error('存档位置无效。');
  for (const [i, notes] of Object.entries(state.notes)) if (!validCell(Number(i)) || !Array.isArray(notes) || notes.some(id=>!ids.has(id))) throw Error('候选标记无效。');
  if (state.excluded.some(i=>!validCell(i)) || !Number.isFinite(state.elapsed) || state.elapsed < 0) throw Error('存档数据无效。');
  if (Object.keys(state.colors).some(i=>!validCell(Number(i))) || state.checked.some(id=>!ids.has(id)) || (state.memo !== undefined && typeof state.memo !== 'string')) throw Error('笔记数据无效。');
  state.ink = state.ink.filter(stroke=>Array.isArray(stroke) && stroke.length <= 20000 && stroke.every(pt=>Array.isArray(pt)&&pt.length===2&&pt.every(v=>Number.isFinite(v)&&v>=0&&v<=1)));
  return state;
}
export function neighbors(p, i) {
  const r = Math.floor(i / p.cols), c = i % p.cols;
  return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([y,x])=>y>=0&&y<p.rows&&x>=0&&x<p.cols).map(([y,x])=>y*p.cols+x).filter(j=>p.cells[i].room && p.cells[j].room===p.cells[i].room);
}
export const beside = (p, i, object) => neighbors(p,i).some(j=>p.cells[j].object===object);
export function ruleHolds(p, person, i, r, placements, complete = false) {
  const cell = p.cells[i], sameRoom = j => cell.room && p.cells[j].room === cell.room;
  switch (r.type) {
    case 'room': return cell.room === r.value;
    case 'notRoom': return cell.room !== r.value;
    case 'row': return Math.floor(i / p.cols) === r.value;
    case 'col': return i % p.cols === r.value;
    case 'on': return cell.object === r.value;
    case 'beside': return beside(p,i,r.value);
    case 'notBeside': return !beside(p,i,r.value);
    case 'roomContains': return p.cells.some(c=>cell.room && c.room===cell.room && c.object===r.value);
    case 'cells': return r.value.includes(i);
    case 'with': return placements[r.value] === undefined ? !complete : !!sameRoom(placements[r.value]);
    case 'notWith': return placements[r.value] === undefined ? !complete : !sameRoom(placements[r.value]);
    case 'alone': return !Object.entries(placements).some(([id,j])=>id!==person.id&&sameRoom(j));
    case 'otherOn': case 'otherBeside': {
      const found = Object.entries(placements).some(([id,j])=>id!==person.id&&sameRoom(j)&&(!r.gender||p.people.find(x=>x.id===id)?.gender===r.gender)&&(r.type==='otherOn'?p.cells[j].object===r.value:beside(p,j,r.value)));
      return found || !complete;
    }
    default: return false;
  }
}
export function conflicts(p, placements, complete = false) {
  const errors = [], entries = Object.entries(placements);
  for (let a=0; a<entries.length; a++) {
    const [id,i] = entries[a], person = p.people.find(x=>x.id===id);
    if (!person || !p.cells[i]) { errors.push({ids:[id], message:'位置数据无效'}); continue; }
    if (p.cells[i].blocked) errors.push({ids:[id], message:`${person.name} 位于不可占用的格子`});
    for (let b=0;b<a;b++) {
      const [other,j]=entries[b];
      if (Math.floor(i/p.cols)===Math.floor(j/p.cols)||i%p.cols===j%p.cols) errors.push({ids:[id,other],message:`${id} 与 ${other} 位于同一行或同一列`});
    }
    for (const rule of person.rules) if (!ruleHolds(p,person,i,rule,placements,complete)) errors.push({ids:[id],message:`${person.name} 不满足已配置的线索（${rule.type}）`});
  }
  const victim = p.people.find(x=>x.victim), vi = victim && placements[victim.id];
  if (victim && vi !== undefined && p.cells[vi]?.room) {
    const others=entries.filter(([id,i])=>id!==victim.id&&p.cells[i].room===p.cells[vi].room);
    if (others.length>1 || (complete && others.length!==1)) errors.push({ids:[victim.id,...others.map(x=>x[0])],message:'受害者必须与凶手独处于同一区域'});
  }
  return errors;
}
export function coverage(p) {
  return p.people.filter(x=>x.victim).length===1 && p.cells.every(c=>c.blocked||c.room) && p.people.every(x=>x.verified && (x.victim || x.rules.length));
}
export function assess(p,s) {
  const complete = p.people.every(x=>s.placements[x.id]!==undefined), errors=conflicts(p,s.placements,complete);
  const victim = p.people.find(x=>x.victim), vi=victim && s.placements[victim.id];
  const others=vi===undefined?[]:p.people.filter(x=>!x.victim&&s.placements[x.id]!==undefined&&p.cells[s.placements[x.id]].room&&p.cells[s.placements[x.id]].room===p.cells[vi].room);
  return {complete, errors, verified: coverage(p), killer: complete&&!errors.length&&others.length===1?others[0].id:null};
}
export function autoBlocked(p,s,i,selected = null) {
  return Object.entries(s.placements).some(([id,j])=>id!==selected&&i!==j&&(Math.floor(i/p.cols)===Math.floor(j/p.cols)||i%p.cols===j%p.cols));
}
// Derived display state only: placement must not destroy pencil notes.
export function candidateExclusions(state, cell) {
  const notes=state.notes[cell]||[];
  const crossed=notes.filter(id=>state.placements[id]!==undefined);
  return {crossed,exhausted:notes.length>0&&crossed.length===notes.length};
}
export function applyMove(p,s,mode,i,id) {
  const next = clone(s);
  if (!Number.isInteger(i)||i<0||i>=p.cells.length) return next;
  next.accusation=null;
  if (mode==='erase') {
    for (const [key,j] of Object.entries(next.placements)) if (j===i) delete next.placements[key];
    delete next.notes[i]; next.excluded=next.excluded.filter(j=>j!==i); delete next.colors[i];
  } else if (mode==='exclude') {
    if (Object.values(next.placements).includes(i)) throw Error('请先移走格子中的人物。');
    next.excluded=next.excluded.includes(i)?next.excluded.filter(j=>j!==i):[...next.excluded,i];
  } else if (mode==='color') {
    if (next.colors[i]) delete next.colors[i]; else next.colors[i]='#e5b74b';
  } else if (mode==='place'||mode==='note') {
    if (!p.people.some(x=>x.id===id)) throw Error('请先选择人物。');
    if (p.cells[i].blocked) throw Error('这个格子不能站人。');
    if (mode==='note') {
      const list=next.notes[i]||[];
      next.notes[i]=list.includes(id)?list.filter(x=>x!==id):[...list,id];
      if (!next.notes[i].length) delete next.notes[i];
    } else {
      const occupant=Object.entries(next.placements).find(([key,j])=>j===i&&key!==id);
      if (occupant) throw Error('这个格子已有其他人物。');
      if (next.placements[id]===i) delete next.placements[id]; else next.placements[id]=i;
      // Keep pencil notes intact underneath derived row/column masks.
      next.excluded=next.excluded.filter(j=>j!==i);
    }
  }
  return next;
}
export function solve(p, fixed = {}, limit = 2, maxNodes = 150000) {
  validatePuzzle(p);
  if (!coverage(p)) return {solutions:[],nodes:0,truncated:false,incomplete:true};
  if (conflicts(p,fixed).length) return {solutions:[],nodes:0,truncated:false};
  const placements={...fixed}, solutions=[]; let nodes=0, truncated=false;
  const candidates={};
  for (const person of p.people) candidates[person.id]=p.cells.map((_,i)=>i).filter(i=>!p.cells[i].blocked && person.rules.every(r=>ruleHolds(p,person,i,r,{},false)));
  function visit() {
    if (++nodes>maxNodes) {truncated=true;return;}
    if (Object.keys(placements).length===p.people.length) {
      if (!conflicts(p,placements,true).length) solutions.push({...placements});
      return;
    }
    let best=null, options=[];
    for (const person of p.people) {
      if (placements[person.id]!==undefined) continue;
      const possible=candidates[person.id].filter(i=>!conflicts(p,{...placements,[person.id]:i}).length);
      if (!possible.length) return;
      if (!best||possible.length<options.length) {best=person;options=possible;}
    }
    for (const i of options) {
      placements[best.id]=i; visit(); delete placements[best.id];
      if (solutions.length>=limit || truncated) return;
    }
  }
  visit(); return {solutions,nodes,truncated};
}
