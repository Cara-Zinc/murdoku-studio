import {normalizeView,viewBounds,containsCell,localToGlobal,globalToLocal} from './viewport.js';
import {setupNavigation} from './navigation.js';
import {makePuzzle,blankState,clone,validatePuzzle,validateState,applyMove,autoBlocked,candidateExclusions,assess,coverage,personLabel} from './engine.js';
import {demoPuzzle} from './demo.js';
import {renderDocument,fileImage,cropImage,detectGrid,pageText,renderAlignmentGrid} from './pdf.js';
import {saveCase,currentCase,getCase,listCases,deleteCase,readSetting,saveSetting} from './storage.js';
import {collectPeople,portraitPages,portraitSource} from './person-sources.js';
import {matchPortraits} from './portraits.js';
import {editPortrait} from './portrait-editor.js';
import {recognizeRoster,relabelPeople} from './people.js';

const $=id=>document.getElementById(id);
const COLORS=['#4f7961','#b48041','#68859b','#a46c65','#8b7b9c','#637e79','#aa6c89','#808b42','#a1845c','#426e83'];
const ROOM_COLORS=['#e1e7d1','#dae7e8','#efe0cf','#e5ddec','#d5e3d9','#eadbda','#e2e4ec'];
const SYMBOLS={'椅子':'♜','桌子':'▤','架子':'▥','文件柜':'▥','床':'▰','电视':'▣','地毯':'▧','箱子':'▣','植物':'♧'};
const RULE_NAMES={room:'在区域',notRoom:'不在区域',row:'行',col:'列',on:'在物品上',beside:'相邻',notBeside:'不相邻',with:'同区域',notWith:'不同区域',alone:'独处',roomContains:'区域包含',otherOn:'另有人在物品上',otherBeside:'另有人相邻物品',cells:'允许位置'};
let workspace={id:'original-rainy-archive-v1',puzzle:demoPuzzle(),state:blankState(),undo:[],redo:[],book:null};
let selected='A', mode='place', currentCell=0, zoom=1, paused=false, saveTimer, toastTimer, edit=null, editPerson=0, pending=null, rect={x:.1,y:.2,w:.8,h:.5}, solver=null, solverCancel=null;
let revision=0, saveChain=Promise.resolve(), painting=false, inkStroke=null, editState=null, crossWidth=3;
const p=()=>workspace.puzzle, s=()=>workspace.state;
const color=id=>p().people.find(x=>x.id===id)?.victim?'#414c47':COLORS[Math.max(0,p().people.findIndex(x=>x.id===id))%COLORS.length];
const coord=(i,puzzle=p())=>`${personLabel(i%puzzle.cols)}${Math.floor(i/puzzle.cols)+1}`;
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
let panning=false, panDrag=null;
function currentView(){return workspace.view=normalizeView(p(),workspace.view);}
function bounds(){return viewBounds(p(),currentView());}
function updateView(next){
  if(inkStroke)return;
  workspace.view=normalizeView(p(),next);
  const b=bounds();if(!containsCell(p(),b,currentCell))currentCell=b.row*p().cols+b.col;
  renderBoard();scheduleSave();
}
const navigation=setupNavigation({puzzle:p,progress:s,view:currentView,update:updateView,selected:()=>selected,coord,toast});
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function message(title,text,actions=[]){$('message-title').textContent=title;$('message-body').replaceChildren();for(const paragraph of text.split('\n'))$('message-body').append(el('p','',paragraph));$('message-actions').replaceChildren();for(const {label,action,primary} of actions){const button=el('button',primary?'primary':'',label);button.onclick=()=>{$('message-dialog').close();action?.();};$('message-actions').append(button);}if(!actions.length){const button=el('button','primary','知道了');button.onclick=()=>$('message-dialog').close();$('message-actions').append(button);}if(!$('message-dialog').open)$('message-dialog').showModal();}
function changed(){revision++;cancelSolver();scheduleSave();}
function scheduleSave(){clearTimeout(saveTimer);$('save-status').textContent='保存中…';saveTimer=setTimeout(persist,250);}
function stashPage(){if(workspace.book)workspace.book.sheets[workspace.book.page]={puzzle:clone(p()),state:clone(s()),undo:clone(workspace.undo),redo:clone(workspace.redo),view:clone(currentView())};}
function persist(){clearTimeout(saveTimer);stashPage();const snapshot=clone(workspace);saveChain=saveChain.catch(()=>{}).then(()=>saveCase(snapshot));saveChain.then(()=>$('save-status').textContent='已保存到本机',()=>{$('save-status').textContent='保存失败，请导出';toast('本机存储不可用或空间不足，请立即导出 JSON 存档。');});return saveChain;}
function mutate(next){if(JSON.stringify(next)===JSON.stringify(s()))return;workspace.undo.push(clone(s()));if(workspace.undo.length>150)workspace.undo.shift();workspace.redo=[];workspace.state=next;changed();render();}
function undo(){if(!workspace.undo.length)return;const elapsed=s().elapsed;workspace.redo.push(clone(s()));workspace.state=workspace.undo.pop();s().elapsed=elapsed;changed();render();}
function redo(){if(!workspace.redo.length)return;const elapsed=s().elapsed;workspace.undo.push(clone(s()));workspace.state=workspace.redo.pop();s().elapsed=elapsed;changed();render();}
function move(i,tool=mode){if(paused)return toast('请先继续调查。');if(tool==='ink')return;if(currentView().mode==='overview'&&Math.max(p().rows,p().cols)>=16){navigation.locate(i);return;}try{currentCell=i;mutate(applyMove(p(),s(),tool,i,selected));$('board').querySelector(`[data-cell="${i}"]`)?.focus({preventScroll:true});}catch(error){toast(error.message);}}
function choosePerson(id){selected=id;render();}
function chooseMode(next){panning=false;syncPan();mode=next;document.querySelectorAll('[data-mode]').forEach(button=>{button.classList.toggle('active',button.dataset.mode===mode);button.setAttribute('aria-pressed',String(button.dataset.mode===mode));});$('ink-canvas').classList.toggle('drawing',mode==='ink');}
function render(){
  if(!p().people.some(x=>x.id===selected))selected=p().people[0].id;
  $('case-title').textContent=p().title;$('case-type').textContent=workspace.book?'PDF 案件':p().source.includes('原创')?'练习案件':'自定义案件';
  $('case-subtitle').textContent=p().source||'根据线索还原现场，找出与受害者独处的人。';$('board-size').textContent=`${p().rows} × ${p().cols}`;
  const victimCount=p().people.filter(person=>person.victim).length;
  $('clue-count').textContent=victimCount?`${p().people.length-1} 位嫌疑人 · 1 位受害者`:`${p().people.length} 位人物 · 尚未指定受害者`;
  const placed=Object.keys(s().placements).length;$('placement-count').textContent=`${placed} / ${p().people.length} 人已定位`;$('progress-bar').style.width=`${placed/p().people.length*100}%`;
  $('selected-person').textContent=`当前：${p().people.find(x=>x.id===selected)?.name} · ${mode==='note'?'候选笔记':'可拖到棋盘'}`;
  $('verification-label').textContent=coverage(p())?'已配置全部线索':'线索待核对';$('undo-btn').disabled=!workspace.undo.length;$('redo-btn').disabled=!workspace.redo.length;
  $('paused-cover').hidden=!paused;$('pause-btn').textContent=paused?'▶':'Ⅱ';$('pause-btn').setAttribute('aria-label',paused?'继续计时':'暂停计时');
  $('case-notes').value=s().memo||'';
  document.querySelector('.workspace').classList.toggle('large-map',Math.max(p().rows,p().cols)>=16);
  $('people-filter').hidden=p().people.length<=12;
  renderBoard();renderPeople();renderLegend();renderTimer();
  $('page-controls').hidden=!workspace.book;
  if(workspace.book){$('page-label').textContent=`${workspace.book.page} / ${workspace.book.pages}`;$('prev-page').disabled=workspace.book.page<=1;$('next-page').disabled=workspace.book.page>=workspace.book.pages;}
}
function renderBoard(){
  const board=$('board'), {rows,cols,cells}=p(), art=$('show-art').checked&&p().background;
  const b=bounds();if(!containsCell(p(),b,currentCell))currentCell=b.row*p().cols+b.col;
  board.style.gridTemplateColumns=`repeat(${b.cols}, minmax(0,1fr))`;board.style.gridTemplateRows=`repeat(${b.rows}, minmax(0,1fr))`;board.style.aspectRatio=`${b.cols} / ${b.rows}`;
  board.style.backgroundSize=`${cols/b.cols*100}% ${rows/b.rows*100}%`;
  board.style.backgroundPosition=`${cols===b.cols?0:b.col/(cols-b.cols)*100}% ${rows===b.rows?0:b.row/(rows-b.rows)*100}%`;
  board.style.backgroundImage=art?`url("${p().background}")`:'';
  board.setAttribute('aria-rowcount',rows);board.setAttribute('aria-colcount',cols);
  $('col-labels').style.gridTemplateColumns=`repeat(${b.cols},1fr)`;$('col-labels').replaceChildren(...Array.from({length:b.cols},(_,i)=>axisLabel('col',b.col+i,b)));
  $('row-labels').style.gridTemplateRows=`repeat(${b.rows},1fr)`;$('row-labels').replaceChildren(...Array.from({length:b.rows},(_,i)=>axisLabel('row',b.row+i,b)));
  const invalid=new Set(assess(p(),s()).errors.flatMap(x=>x.ids)), occupants=Object.fromEntries(Object.entries(s().placements).map(([id,i])=>[i,id]));
  const fragment=document.createDocumentFragment();
  cells.forEach((cell,i)=>{
    if(!containsCell(p(),b,i))return;
    const room=p().rooms.find(x=>x.id===cell.room), person=occupants[i], button=el('button','cell');
    const automatic=$('auto-mask').checked&&!person&&autoBlocked(p(),s(),i);
    const candidates=candidateExclusions(s(),i),candidateExcluded=!person&&candidates.exhausted;
    const excluded=!person&&(s().excluded.includes(i)||automatic||candidateExcluded);button.dataset.cell=i;button.type='button';button.tabIndex=i===currentCell?0:-1;button.setAttribute('role','gridcell');button.setAttribute('aria-rowindex',Math.floor(i/cols)+1);button.setAttribute('aria-colindex',i%cols+1);
    button.setAttribute('aria-label',`${coord(i)}，${room?.name||'未分区'}${cell.object?'，'+cell.object:''}${cell.blocked?'，不可占用':''}${person?'，'+p().people.find(x=>x.id===person).name:''}${excluded?(automatic?'，同行列自动排除':candidateExcluded?'，候选人物均已放置，自动排除':'，已排除'):''}${!person&&candidates.crossed.length?'，已划除候选 '+candidates.crossed.join('、'):''}`);
    button.style.setProperty('--cell-bg',art?'transparent':room?.color||'#f7f8f3');
    button.classList.toggle('current',i===currentCell);button.classList.toggle('blocked',cell.blocked&&!art);button.classList.toggle('excluded',s().excluded.includes(i));button.classList.toggle('highlight',!!s().colors[i]);button.classList.toggle('masked',automatic);button.classList.toggle('candidate-excluded',candidateExcluded);
    button.classList.toggle('room-right',i%cols<cols-1&&cell.room!==cells[i+1].room);button.classList.toggle('room-bottom',i+cols<cells.length&&cell.room!==cells[i+cols].room);
    if(person){button.classList.toggle('error',invalid.has(person));button.classList.toggle('victim',p().people.find(x=>x.id===person).victim);const token=personPortrait(p().people.find(x=>x.id===person),'placed');token.style.setProperty('--person-color',color(person));button.append(token);button.draggable=true;}
    else if(!art&&cell.object){const object=el('span','object');object.append(el('span','object-symbol',SYMBOLS[cell.object]||'◇'),el('span','',cell.object));button.append(object);}
    if(!person&&!excluded&&$('show-notes').checked&&s().notes[i]?.length){const notes=el('span','notes');for(const id of s().notes[i]){const span=el('span','',id);span.style.setProperty('--person-color',color(id));span.classList.toggle('candidate-eliminated',candidates.crossed.includes(id));if(candidates.crossed.includes(id))span.title=`${id} 已在其他格放置`;notes.append(span);}button.append(notes);}
    if(excluded)button.append(exclusionMark());
    fragment.append(button);
  });board.replaceChildren(fragment);
  navigation.render(`${workspace.id}:${workspace.book?.page||1}`);syncPan();requestAnimationFrame(drawInk);
}
function axisLabel(axis,index,b){
  const label=el('span','',axis==='row'?String(index+1):personLabel(index));
  const outside=Object.entries(s().placements).find(([,cell])=>(axis==='row'?Math.floor(cell/p().cols):cell%p().cols)===index&&!containsCell(p(),b,cell));
  if(outside){
    const [id,cell]=outside, person=p().people.find(person=>person.id===id), jump=el('button','axis-occupant',id);
    jump.title=`${person.name} 在窗口外 ${coord(cell)}，点击定位`;jump.setAttribute('aria-label',jump.title);
    jump.onclick=()=>{selected=id;navigation.locate(cell);renderPeople();};label.append(jump);
  }
  return label;
}
function syncPan(){
  $('pan-toggle').setAttribute('aria-pressed',String(panning));$('pan-toggle').classList.toggle('active',panning);
  $('board').classList.toggle('panning',panning);
  $('ink-canvas').classList.toggle('drawing',mode==='ink'&&!panning&&!(currentView().mode==='overview'&&Math.max(p().rows,p().cols)>=16));
}
function exclusionMark(){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('exclusion-mark');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d','M 24 24 L 76 76 M 76 24 L 24 76');
  path.setAttribute('vector-effect','non-scaling-stroke');svg.append(path);return svg;
}
function setCrossWidth(value){
  crossWidth=Math.max(1,Math.min(8,Number(value)||3));
  $('board').style.setProperty('--cross-width',crossWidth+'px');
  $('cross-width').value=crossWidth;$('cross-width-value').value=crossWidth+' px';
}
function personPortrait(person, className, puzzle=p()) {
  const portrait=el('span',className);portrait.setAttribute('aria-hidden','true');
  portrait.style.setProperty('--person-color',person.victim?'#414c47':COLORS[Math.max(0,puzzle.people.findIndex(item=>item.id===person.id))%COLORS.length]);
  const names=['安娜','柏文','程远','黛宁','恩哲','维安'];
  const index=puzzle.id==='original-rainy-archive-v1'?names.indexOf(person.name):-1;
  if(person.portrait){
    const image=el('img','portrait-image');image.src=person.portrait;image.alt='';image.draggable=false;
    portrait.classList.add('has-portrait');portrait.append(image);
  }else if(index>=0){
    portrait.classList.add('has-portrait','illustrated');
    portrait.style.backgroundPosition=`${index%3*50}% ${Math.floor(index/3)*100}%`;
  }else portrait.append(el('span','portrait-monogram',person.id));
  if(person.portrait||index>=0||className==='clue-portrait')portrait.append(el('span','clue-avatar',person.id));
  return portrait;
}
function renderPeople(){
  const scrollTop=$('clues').scrollTop;
  $('roster').replaceChildren();$('clues').replaceChildren();
  for(const person of p().people){
    const where=s().placements[person.id];
    const token=el('button',`person-token${selected===person.id?' active':''}${where!==undefined?' located':''}`);
    token.style.setProperty('--person-color',color(person.id));
    token.setAttribute('aria-label',`选择 ${person.name}`);
    token.setAttribute('aria-pressed',String(selected===person.id));
    token.draggable=true;token.dataset.person=person.id;
    token.append(personPortrait(person,'avatar'),el('span','token-name',person.name));
    token.onclick=()=>choosePerson(person.id);$('roster').append(token);

    const card=el('article',`clue-card${selected===person.id?' selected':''}${s().checked.includes(person.id)?' done':''}${person.victim?' victim-card':''}`);
    card.tabIndex=0;card.setAttribute('aria-label',`${person.name} 的线索`);
    card.dataset.person=person.id;card.draggable=true;
    card.style.setProperty('--person-color',color(person.id));
    const portraitFrame=el('div','portrait-frame');
    const portrait=personPortrait(person,'clue-portrait');
    const name=el('strong','portrait-name',person.name);
    portraitFrame.append(portrait,name);
    const top=el('div','clue-card-top');
    top.append(el('small',person.victim?'victim-badge':'person-role',person.victim?'受害者':'嫌疑人'));
    top.append(el('small','person-position',where===undefined?'未定位':coord(where)));
    const check=el('input');check.type='checkbox';check.checked=s().checked.includes(person.id);
    check.setAttribute('aria-label',`已理清 ${person.name} 的线索`);
    check.onclick=e=>e.stopPropagation();
    check.onchange=()=>{const next=clone(s());next.checked=check.checked?[...next.checked,person.id]:next.checked.filter(x=>x!==person.id);mutate(next);};
    top.append(check);
    const clueBody=el('div','clue-body');
    clueBody.append(el('p','clue-text',person.clue||'尚未填写线索，点击「编辑案件」补充。'),top);
    card.append(portraitFrame,clueBody);
    card.onclick=()=>choosePerson(person.id);
    card.onkeydown=e=>{if(e.target===card&&['Enter',' '].includes(e.key)){e.preventDefault();choosePerson(person.id);}};
    const query=$('people-search').value.trim().toLowerCase();
    card.hidden=!!query&&!`${person.id} ${person.name}`.toLowerCase().includes(query)||$('only-unplaced').checked&&where!==undefined;
    $('clues').append(card);
  }
  $('clues').scrollTop=scrollTop;
}
function renderLegend(){const legend=$('room-legend');legend.replaceChildren();for(const room of p().rooms){if(!p().cells.some(c=>c.room===room.id))continue;const item=el('span','room-key'), dot=el('i');dot.style.background=room.color;item.append(dot,document.createTextNode(room.name));legend.append(item);}if(!legend.children.length)legend.append(el('span','','原图模式 · 区域与物品尚未标注'));}
function renderTimer(){const time=Math.floor(s().elapsed);$('timer').textContent=`${Math.floor(time/60).toString().padStart(2,'0')}:${(time%60).toString().padStart(2,'0')}`;}
function setZoom(value){zoom=Math.max(.5,Math.min(3,value));$('board-wrap').style.width=`${zoom*100}%`;$('board-wrap').style.maxWidth=zoom===1?'':'none';$('zoom-fit').textContent=`${Math.round(zoom*100)}%`;drawInk();}
function drawInk(){const canvas=$('ink-canvas'),board=$('board'),dpr=window.devicePixelRatio||1;canvas.style.width=`${board.clientWidth}px`;canvas.style.height=`${board.clientHeight}px`;canvas.width=board.clientWidth*dpr;canvas.height=board.clientHeight*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.strokeStyle='#be5939';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of [...s().ink,...(inkStroke?[inkStroke]:[])]){if(stroke.length<2)continue;ctx.beginPath();stroke.forEach(([x,y],i)=>{const [lx,ly]=globalToLocal(p(),bounds(),x,y);ctx[i?'lineTo':'moveTo'](lx*board.clientWidth,ly*board.clientHeight);});ctx.stroke();}}
function cancelSolver(){if(solver){solver.terminate();solver=null;solverCancel?.();solverCancel=null;$('hint-btn').disabled=false;}}
function runSolver(fixed){cancelSolver();const stamp=revision;return new Promise((resolve,reject)=>{const worker=new Worker('./solver-worker.js',{type:'module'});solver=worker;const timeout=setTimeout(()=>{worker.terminate();if(solver===worker)solver=null;reject(Error('推理超时，请补充更明确的规则或继续手动推理。'));},10000);solverCancel=()=>{clearTimeout(timeout);reject(Error('案件已改变，本次提示已取消。'));};worker.onmessage=({data})=>{clearTimeout(timeout);worker.terminate();solver=null;solverCancel=null;if(stamp!==revision)return reject(Error('布局已改变，请重新获取提示。'));data.error?reject(Error(data.error)):resolve(data.result);};worker.onerror=()=>{clearTimeout(timeout);worker.terminate();solver=null;solverCancel=null;reject(Error('推理引擎无法启动。'));};worker.postMessage({puzzle:clone(p()),fixed});});}
async function hint(){
  if(!coverage(p()))return message('先补全可验证的线索','此案件还有未分区的可占用格子，或人物线索尚未完整配置。请在「编辑案件」中补充区域、物品和规则，并核对每个人的线索。候选笔记与手动解谜可以照常使用。');
  $('hint-btn').disabled=true;toast('正在依据已配置的规则推理…');
  try{const result=await runSolver({});if(result.truncated)return message('暂时无法确定提示','搜索达到上限，尚不能证明唯一解。请补充规则或继续手动排除。');if(!result.solutions.length)return message('规则之间存在矛盾','当前配置没有找到合法解。请检查区域、障碍物以及人物规则是否与原题一致。');if(result.solutions.length>1)return message('当前规则存在多个解','无法给出可靠的唯一位置。请检查是否遗漏了原题的线索；工具不会从多个解中任选一个作为答案。');const solution=result.solutions[0], wrong=p().people.find(x=>s().placements[x.id]!==undefined&&s().placements[x.id]!==solution[x.id]);if(wrong)return message('重新看看这名人物',`${wrong.name} 的当前位置与已配置规则的唯一解不符。先移走 TA，再结合线索检查。`);const next=p().people.find(x=>s().placements[x.id]===undefined);if(!next)return message('人物都已就位','当前布局满足全部已配置规则，可以指认凶手。');message('一个位置提示',`${next.name} 应在 ${coord(solution[next.id])}。\n这是已配置规则的唯一解推导出的提示，并非官方答案。`,[{label:'只看提示'},{label:'放置这个人',primary:true,action:()=>{selected=next.id;move(solution[next.id],'place');}}]);}catch(error){toast(error.message);}finally{$('hint-btn').disabled=false;}
}
function check(){const result=assess(p(),s());if(result.errors.length)return message('有几处需要再想想',[...new Set(result.errors.map(x=>x.message))].join('\n'));message(result.complete?'当前布局没有冲突':'暂未发现冲突',result.verified?(result.complete?'所有人物都满足已配置规则。现在可以指认与受害者独处的凶手。':'已放置的人物满足当前可检查的规则。尚未放置的人物可能带来新的约束。'):'行列、障碍物和已配置规则没有冲突。但本题线索尚未完整核对，不能据此判断答案正确。');}
function accuse(){
  if(!p().people.some(person=>person.victim))return message('尚未指定受害者','请在「编辑案件」的人物编辑中指定受害者，再指认凶手。');
  const result=assess(p(),s());if(!result.complete)return message('现场还没有还原','请先放置全部人物，再指认凶手。');if(result.errors.length)return check();
  message('谁与受害者独处？',result.verified?'选择你的嫌疑人。判定依据是你已核对的全部规则。':'本题规则尚未完整配置。你可以记录一个推测，但工具不会把它判定为通关。',p().people.filter(x=>!x.victim).map(person=>({label:`${person.id} · ${person.name}`,action:()=>{if(!result.verified){const next=clone(s());next.accusation=person.id;mutate(next);return message('已记录你的推测',`你怀疑 ${person.name}。补全并核对规则后，才能验证案件。`);}if(person.id!==result.killer)return message('再看看受害者的区域','凶手必须与受害者同处一个区域，而且那个区域恰好只有他们两个人。');const next=clone(s());next.accusation=person.id;mutate(next);paused=true;render();message('案件告破',`${person.name} 与受害者独处。所有人物位置都满足已核对的规则。\n调查用时 ${$('timer').textContent}。你可以导出存档，或导入下一份谜题。`);}})));
}
async function activate(next){await persist().catch(()=>{});workspace=next;selected=p().people[0].id;currentCell=bounds().row*p().cols+bounds().col;paused=false;panning=false;$('people-search').value='';$('only-unplaced').checked=false;zoom=1;setZoom(1);revision++;cancelSolver();render();scheduleSave();}
function newWorkspace(puzzle,book=null){return {id:puzzle.id,puzzle,state:blankState(),undo:[],redo:[],book};}
function openImport(){pending=null;$('people-page-fieldset').disabled=false;$('import-page').disabled=false;$('import-dialog').classList.remove('aligning');setImportActionBusy(false);$('import-start').hidden=false;$('alignment-step').hidden=true;$('import-status').textContent='';$('file-input').value='';$('import-dialog').showModal();}
async function importFile(file){
  if(!file)return;if(file.size>32*1024*1024)return toast('文件超过 32 MiB，请拆分或压缩后导入。');
  $('import-status').textContent='正在读取文件…';
  try{
    if(file.name.toLowerCase().endsWith('.json')){const data=JSON.parse(await file.text()), puzzle=validatePuzzle(data.puzzle||data), state=validateState(puzzle,data.state||blankState());const next=newWorkspace(puzzle);next.state=state;next.view=normalizeView(puzzle,data.view);await activate(next);$('import-dialog').close();toast('案件与进度已恢复。');return;}
    const pdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
    const bytes=pdf?await file.arrayBuffer():null, page=pdf?await renderDocument(bytes):await fileImage(file);
    pending={name:file.name,bytes,page,pageNumber:1,isPDF:pdf};await prepareAlignment();
  }catch(error){$('import-status').textContent=error.message;}
}
async function prepareAlignment(){
  $('import-dialog').classList.add('aligning');$('import-start').hidden=true;$('alignment-step').hidden=false;$('preview-image').src=pending.page.image;
  requestAnimationFrame(fitAlignmentPreview);
  $('import-title').value=pending.name.replace(/\.[^.]+$/,'')+(pending.page.pages>1?` · 第 ${pending.pageNumber} 页`:'');
  $('import-page').replaceChildren(...Array.from({length:pending.page.pages},(_,i)=>{const option=el('option','',`第 ${i+1} 页`);option.value=i+1;return option;}));$('import-page').value=pending.pageNumber;
  rect={x:.08,y:.23,w:.84,h:.5};updateAlignment();await detectPending();renderPeoplePageOptions();await refreshImportPeople();
}
function fitAlignmentPreview(){
  const image=$('preview-image'), pane=$('alignment-preview-pane'), preview=$('page-preview');
  if(!image.naturalWidth||!image.naturalHeight||!pane.clientWidth||!pane.clientHeight)return;
  const scale=Math.min((pane.clientWidth-2)/image.naturalWidth,(pane.clientHeight-2)/image.naturalHeight);
  preview.style.width=`${Math.max(1,Math.floor(image.naturalWidth*scale)+2)}px`;
  preview.style.height='auto';
}
async function detectPending(){
  if(!pending)return;$('import-status').textContent='正在寻找规则网格…';$('detect-btn').disabled=true;
  try{await new Promise(r=>setTimeout(r,20));const suggestion=await detectGrid(pending.page.image);if(suggestion){rect={x:suggestion.x,y:suggestion.y,w:suggestion.w,h:suggestion.h};$('import-rows').value=suggestion.rows;$('import-cols').value=suggestion.cols;$('import-count').value=Math.min(suggestion.rows,suggestion.cols);$('import-status').textContent=`检测到 ${suggestion.rows} × ${suggestion.cols} 的候选网格。请确认框线准确覆盖主棋盘；可能识别到了原页中的小型笔记网格。`;}else{$('import-status').textContent='未找到可靠的网格。请手动拖动四角框住棋盘，再填写行列数。';}updateAlignment();}catch(error){$('import-status').textContent=error.message;}finally{$('detect-btn').disabled=false;}
}
function updateAlignment(){rect.x=Math.max(0,Math.min(.98,rect.x));rect.y=Math.max(0,Math.min(.98,rect.y));rect.w=Math.max(.02,Math.min(1-rect.x,rect.w));rect.h=Math.max(.02,Math.min(1-rect.y,rect.h));const box=$('grid-selection');Object.assign(box.style,{left:`${rect.x*100}%`,top:`${rect.y*100}%`,width:`${rect.w*100}%`,height:`${rect.h*100}%`});renderAlignmentGrid(box,Number($('import-rows').value),Number($('import-cols').value));document.querySelectorAll('[data-rect]').forEach(input=>input.value=(rect[input.dataset.rect]*100).toFixed(2));}
function renderPeoplePageOptions(){
  pending.pageCache??=new Map();pending.pageCache.set(pending.pageNumber,pending.page);
  if(!pending.peoplePagesExplicit)pending.peoplePages=[pending.pageNumber];
  const options=$('people-page-options');options.replaceChildren();
  for(let page=1;page<=pending.page.pages;page++){
    const label=el('label'),input=el('input');input.type='checkbox';input.value=page;input.checked=pending.peoplePages.includes(page);
    input.onchange=()=>{
      pending.peoplePagesExplicit=true;
      pending.peoplePages=[...options.querySelectorAll('input:checked')].map(input=>Number(input.value));
      refreshImportPeople();
    };
    label.append(input,document.createTextNode(`第 ${page} 页${page===pending.pageNumber?'（地图）':''}`));options.append(label);
  }
  $('people-page-fieldset').hidden=!pending.isPDF||pending.page.pages<2;
}
async function refreshImportPeople(){
  if(!pending||pending.converting)return;
  const draft=pending,token=(draft.recognitionToken||0)+1;draft.recognitionToken=token;draft.recognizing=true;
  const current=()=>pending===draft&&draft.recognitionToken===token&&$('import-dialog').open;
  const valid=id=>Math.max(1,Math.min(64,Math.trunc(Number($(id).value)||9)));
  const rows=valid('import-rows'),cols=valid('import-cols'),count=valid('import-count');
  const extract=$('extract-people').checked,selectedPages=[...(draft.peoplePages||[draft.pageNumber])],grid=clone(rect);
  setImportActionBusy(true,'正在识别人像页…');$('import-page').disabled=true;
  try{
    if(selectedPages.length>64)throw Error('人物来源页最多选择 64 页。');
    const pages=[];
    for(const number of selectedPages){
      let page=draft.pageCache?.get(number);
      if(!page){if(current())$('import-status').textContent=`正在读取人物来源：第 ${number} 页…`;page=await renderDocument(draft.bytes,number);if(!current())return;draft.pageCache.set(number,page);}
      pages.push(page);
    }
    if(!current())return;
    const defaults=makePuzzle(rows,cols,count).people;
    draft.people=extract?recognizeRoster(defaults,collectPeople(pages,draft.pageNumber,grid)):defaults;
    draft.loadedPeoplePages=pages;draft.recognitionError=false;renderImportPeople();
    $('import-status').textContent=extract&&pages.length?`已从 ${pages.map(page=>'第 '+page.page+' 页').join('、')} 提取候选名单，请核对姓名、线索和人数。`:'已使用手动人物名单。';
  }catch(error){if(current()){draft.recognitionError=true;$('import-status').textContent=error.message;}}
  finally{if(current()){draft.recognizing=false;setImportActionBusy(false);$('apply-import').disabled=!!draft.recognitionError;$('import-page').disabled=false;}}
}
function renderImportPeople(){
  const list=$('import-people-list');if(!list||!pending?.people)return;
  $('import-extracted-text').textContent=(pending.loadedPeoplePages||[pending.page]).map(page=>`【第 ${page.page} 页】\n${pageText(page)||'此页没有可提取的文字。'}`).join('\n\n');
  list.replaceChildren(...pending.people.map(person=>{
    const card=el('article','import-person'), heading=el('div','import-person-heading');
    heading.append(el('strong','',`${person.id}${person.victim?' \u00b7 \u53d7\u5bb3\u8005':''}`));
    const name=el('label','','\u59d3\u540d'), nameInput=el('input');nameInput.value=person.name;nameInput.maxLength=80;
    nameInput.oninput=()=>{person.name=nameInput.value;};name.append(nameInput);
    const clue=el('label','','\u6700\u7ec8\u63cf\u8ff0\uff08\u6e38\u620f\u4e2d\u663e\u793a\uff09'), clueInput=el('textarea');clueInput.rows=2;clueInput.value=person.clue||'';clueInput.maxLength=2000;
    clueInput.placeholder='\u8f93\u5165\u6700\u7ec8\u663e\u793a\u5728\u4eba\u7269\u7ebf\u7d22\u5361\u4e0a\u7684\u63cf\u8ff0';clueInput.oninput=()=>{person.clue=clueInput.value;};clue.append(clueInput);
    heading.append(name);card.append(heading,clue);if(person.sourcePage)card.append(el('small','',`来源：第 ${person.sourcePage} 页`));return card;
  }));
}
function setImportActionBusy(busy,label='正在转换…'){
  const button=$('apply-import');button.disabled=busy;button.textContent=busy?label:'转换为可玩棋盘';
  if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
}
async function applyImport(){
  if(!pending||pending.recognizing||pending.recognitionError)return;const rows=Number($('import-rows').value), cols=Number($('import-cols').value), count=Number($('import-count').value);
  if([rows,cols,count].some(n=>!Number.isInteger(n)||n<1||n>64))return toast('行数、列数和人数必须是 1–64 的整数。');
  if(pending.people?.length!==count)await refreshImportPeople();
  if(!pending||pending.recognitionError)return;
  const draft=pending;draft.converting=true;const importRect=clone(rect);
  setImportActionBusy(true);$('import-page').disabled=true;$('people-page-fieldset').disabled=true;
  try{
    if(draft.isPDF&&Math.max(rows,cols)>=16){
      setImportActionBusy(true,'正在生成高清大地图…');
      draft.page=await renderDocument(draft.bytes,draft.pageNumber,3600);
    }
    if(pending!==draft||!$('import-dialog').open)return;
    const puzzle=makePuzzle(rows,cols,count);puzzle.people=relabelPeople({...puzzle,people:clone(draft.people||puzzle.people)},null).puzzle.people;puzzle.title=$('import-title').value.trim()||'导入案件';puzzle.source=draft.name;puzzle.grid=importRect;puzzle.background=await cropImage(draft.page.image,importRect);puzzle.extractedText=pageText(draft.page);puzzle.extractedTextVersion=2;
    puzzle.mapPage=draft.pageNumber;
    puzzle.sourcePages=(draft.loadedPeoplePages||[]).filter(page=>page.page!==draft.pageNumber).map(page=>({page:page.page,image:page.image,text:pageText(page)}));
    if($('extract-people').checked){
      $('import-status').textContent='正在按来源页和姓名位置匹配头像…';
      for(const page of draft.loadedPeoplePages||[]){
        await matchPortraits(page.image,puzzle.people.filter(person=>person.sourcePage===page.page));
      }
    }
    if(pending!==draft||!$('import-dialog').open)return;
    validatePuzzle(puzzle);
    let next;
    if(draft.existingBook){const book=clone(workspace.book);book.page=draft.pageNumber;next={...workspace,puzzle,state:blankState(),undo:[],redo:[],view:undefined,book};}
    else {const book=draft.isPDF?{name:draft.name,bytes:draft.bytes,pages:draft.page.pages,page:draft.pageNumber,sheets:{}}:null;next=newWorkspace(puzzle,book);}
    next.puzzle.originalPage=draft.page.image;await activate(next);$('import-dialog').close();pending=null;toast('棋盘已转换。可开始做笔记；请在「编辑案件」中核对人物并标注规则。');
  }catch(error){$('import-status').textContent=error.message;toast(`转换失败：${error.message}`);}finally{draft.converting=false;if(pending===draft||!pending){setImportActionBusy(false);$('import-page').disabled=false;$('people-page-fieldset').disabled=false;}}
}
async function changePage(page){
  if(!workspace.book||page<1||page>workspace.book.pages)return;await persist().catch(()=>{});const found=workspace.book.sheets[page];
  if(found){const next=clone(workspace);next.view=found.view;next.book.page=page;Object.assign(next,clone(found));await activate(next);return;}
  toast('正在读取下一页…');try{const rendered=await renderDocument(workspace.book.bytes,page);pending={name:workspace.book.name,bytes:workspace.book.bytes,page:rendered,pageNumber:page,isPDF:true,existingBook:true};$('import-dialog').showModal();await prepareAlignment();}catch(error){toast(error.message);}
}
function exportCase(){stashPage();const data={format:'murdoku-studio',version:1,puzzle:clone(p()),state:clone(s()),view:clone(currentView())};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), anchor=el('a');anchor.href=url;anchor.download=`${p().title.replace(/[^\p{L}\p{N}_-]/gu,'_')}.murdoku.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出当前棋盘、关联人物页、头像和进度。其他棋盘请分别导出。');}
async function showLibrary(){await persist().catch(()=>{});await renderLibrary();$('library-dialog').showModal();}
async function renderLibrary(){const list=$('library-list');list.replaceChildren();try{const cases=(await listCases()).sort((a,b)=>b.updated-a.updated);for(const item of cases){const row=el('div','library-row'),info=el('div');info.append(el('strong','',item.title),el('small','',`${item.placed} / ${item.total} 人 · ${new Date(item.updated).toLocaleString('zh-CN')}`));const open=el('button','',item.id===workspace.id?'当前案件':'继续');open.disabled=item.id===workspace.id;open.onclick=async()=>{try{const data=await getCase(item.id);validatePuzzle(data.puzzle);data.state=validateState(data.puzzle,data.state);await activate(data);$('library-dialog').close();}catch(error){toast(error.message);}};const remove=el('button','','删除');remove.disabled=item.id===workspace.id;remove.onclick=()=>message('删除这个存档？',`「${item.title}」将从此浏览器删除。已导出的 JSON 不受影响。`,[{label:'取消'},{label:'删除',action:async()=>{await deleteCase(item.id);renderLibrary();}}]);row.append(info,open,remove);list.append(row);}}catch{list.append(el('p','','本机存储不可用。请使用 JSON 导出备份。'));}}

// Case editor: work on a draft until the entire model validates.
function openEditor(){edit=clone(p());edit.mapPage??=workspace.book?.page||1;editState=clone(s());editPerson=0;if(!edit.originalPage&&edit.background)edit.grid={x:0,y:0,w:1,h:1};else if(!edit.grid)edit.grid={x:0,y:0,w:1,h:1};$('edit-title').value=edit.title;$('map-editor').hidden=false;$('people-editor').hidden=true;$('map-tab').classList.add('active');$('people-tab').classList.remove('active');$('editor-status').textContent='';$('save-editor').disabled=false;$('realign-grid').disabled=!edit.originalPage;renderRoomOptions();renderEditorGrid();renderEditorSource();renderPersonEditor();$('editor-dialog').showModal();refreshEditorText();}
async function refreshEditorText(){
  if(edit.extractedTextVersion===2||!workspace.book?.bytes)return;
  const caseId=edit.id, page=workspace.book.page;
  try{
    const rendered=await renderDocument(workspace.book.bytes,page);
    if(!edit||edit.id!==caseId||!$('editor-dialog').open)return;
    edit.extractedText=pageText(rendered);edit.extractedTextVersion=2;
    renderPortraitEditor();
  }catch(error){if(edit?.id===caseId&&$('editor-dialog').open)$('editor-status').textContent=`原文重新提取失败：${error.message}`;}
}
function renderEditorSource(){
  const reference=$('editor-original-reference'), image=$('editor-source-image');
  const source=edit.originalPage||edit.background;
  reference.hidden=!source;
  $('person-source-reference').hidden=!source;
  $('person-source-image').src=source||'';
  if(!source)return;
  image.src=source;
  document.querySelectorAll('[data-editor-grid]').forEach(input=>input.disabled=!edit.originalPage);
  const hint=$('editor-source-hint');hint.textContent='\u62d6\u52a8\u8fb9\u6846\u79fb\u52a8\u7f51\u683c\u8303\u56f4\uff0c\u62d6\u52a8\u56db\u89d2\u7f29\u653e\u3002\u4fdd\u5b58\u6848\u4ef6\u540e\uff0c\u68cb\u76d8\u80cc\u666f\u4f1a\u6309\u65b0\u8303\u56f4\u66f4\u65b0\u3002';
  updateEditorGrid();
}
function updateEditorGrid(){
  if(!edit||( !edit.originalPage&&!edit.background)||!edit.grid)return;
  const r=edit.grid;r.x=Math.max(0,Math.min(.98,r.x));r.y=Math.max(0,Math.min(.98,r.y));r.w=Math.max(.02,Math.min(1-r.x,r.w));r.h=Math.max(.02,Math.min(1-r.y,r.h));
  Object.assign($('editor-grid-selection').style,{left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.w*100}%`,height:`${r.h*100}%`});
  renderAlignmentGrid($('editor-grid-selection'),edit.rows,edit.cols);
  document.querySelectorAll('[data-editor-grid]').forEach(input=>input.value=(r[input.dataset.editorGrid]*100).toFixed(2));
}
async function realignEditorGrid(){
  const draft=edit;if(!draft?.originalPage)return;
  $('realign-grid').disabled=true;$('save-editor').disabled=true;$('editor-status').textContent='正在重新检测网格…';
  try{
    const grid=await detectGrid(draft.originalPage);
    if(edit!==draft||!$('editor-dialog').open)return;
    if(!grid)throw Error('未找到可靠网格，请手动调整原图上的边框。');
    if(grid.rows!==draft.rows||grid.cols!==draft.cols)throw Error(`检测到 ${grid.rows} × ${grid.cols}，与当前 ${draft.rows} × ${draft.cols} 不同。请核对后重新导入，或手动调整边框。`);
    const rect={x:grid.x,y:grid.y,w:grid.w,h:grid.h};
    const background=await cropImage(draft.originalPage,rect);
    if(edit!==draft||!$('editor-dialog').open)return;
    draft.grid=rect;draft.background=background;updateEditorGrid();renderEditorGrid();
    $('editor-status').textContent='已重新对齐，请核对后保存。人物位置、笔记和区域标注保持不变。';
  }catch(error){if(edit===draft&&$('editor-dialog').open)$('editor-status').textContent=error.message;}
  finally{if(edit===draft){$('realign-grid').disabled=false;$('save-editor').disabled=false;}}
}
function renderRoomOptions(){const previous=$('paint-room').value;$('paint-room').replaceChildren(...edit.rooms.map(room=>{const option=el('option','',room.name);option.value=room.id;return option;}));if(edit.rooms.some(r=>r.id===previous))$('paint-room').value=previous;selectRoom();}
function selectRoom(){const room=edit.rooms.find(r=>r.id===$('paint-room').value);if(room){$('room-name').value=room.name;$('room-color').value=room.color;}}
function renderEditorGrid(){const grid=$('editor-board');grid.style.gridTemplateColumns=`repeat(${edit.cols},1fr)`;grid.style.backgroundImage=edit.background?`url("${edit.background}")`:'';grid.replaceChildren(...edit.cells.map((cell,i)=>{const room=edit.rooms.find(r=>r.id===cell.room),button=el('button',`editor-cell${cell.blocked?' blocked':''}`);button.dataset.editCell=i;button.setAttribute('aria-label',`编辑 ${coord(i,edit)}，${room?.name||'未分区'}`);button.style.setProperty('--cell-bg',room?(edit.background?room.color+'99':room.color):'transparent');if(cell.object)button.append(el('span','',cell.object));return button;}));}
function paint(i){const cell=edit.cells[i];switch($('paint-type').value){case 'room':cell.room=$('paint-room').value;break;case 'object':cell.object=$('paint-object').value.trim();break;case 'blocked':cell.blocked=true;break;case 'open':cell.blocked=false;break;case 'clear':Object.assign(cell,{room:'',object:'',blocked:false});break;}edit.people.forEach(person=>person.verified=false);renderEditorGrid();}
function renderPersonEditor(){const person=edit.people[editPerson];$('edit-person').replaceChildren(...edit.people.map((x,i)=>{const option=el('option','',`${x.id} \u00b7 ${x.name}`);option.value=i;return option;}));$('edit-person').value=editPerson;$('person-name').value=person.name;$('person-id').value=person.id;$('person-clue').value=person.clue;$('people-extracted-text').textContent=edit.extractedText||'此页没有可提取的文字，请对照右侧原图。';$('person-gender').value=person.gender||'';$('person-victim').checked=person.victim;$('person-verified').checked=person.verified;$('delete-person').disabled=person.victim||edit.people.length<=1;renderPortraitEditor();renderRules();}
function renderPortraitEditor(){
  const person=edit.people[editPerson],source=portraitSource(edit,person),select=$('portrait-source-page');
  $('person-portrait-preview').replaceChildren(personPortrait(person,'clue-portrait',edit));
  select.replaceChildren(...portraitPages(edit).map(page=>{const option=el('option','',`PDF / 原图 · 第 ${page.page} 页`);option.value=String(page.page);return option;}));
  if(person.portraitSource){const option=el('option','','单独上传的图片');option.value='upload';select.append(option);}
  if(source)select.value=source.key;
  select.disabled=!select.options.length;$('edit-portrait').disabled=!source;
  $('clear-portrait').disabled=!person.portrait;
  $('person-portrait-hint').textContent='可从来源页框选人脸，或上传 PNG、JPEG、WebP 图片（最大 8 MiB）。';
  updatePortraitSourcePreview();
  $('people-extracted-text').textContent=portraitPages(edit).map(page=>`【第 ${page.page} 页】\n${page.text||'此页没有可提取的文字。'}`).join('\n\n')||'此案件没有可提取的文字。';
}
function selectedPortraitSource(){
  const person=edit.people[editPerson],key=$('portrait-source-page').value;
  return key==='upload'?{image:person.portraitSource,key}:portraitPages(edit).map(page=>({...page,key:String(page.page)})).find(page=>page.key===key);
}
function updatePortraitSourcePreview(){
  const source=selectedPortraitSource();$('person-source-reference').hidden=!source?.image;
  $('person-source-image').src=source?.image||'';$('edit-portrait').disabled=!source?.image;
  $('person-source-label').textContent=source?.key==='upload'?'上传的头像原图':`头像来源 · 第 ${source?.page||1} 页`;
}
async function adjustPortrait(){
  const draft=edit,person=draft.people[editPerson],source=selectedPortraitSource();if(!source?.image)return;
  try{
    const result=await editPortrait({source:source.image,rect:portraitSource(draft,person)?.key===source.key?person.portraitRect:undefined,name:person.name});
    if(result&&edit===draft&&draft.people.includes(person)&&$('editor-dialog').open){
      Object.assign(person,result);
      if(source.key!=='upload'){delete person.portraitSource;person.portraitPage=source.page;}
      renderPortraitEditor();
    }
  }catch(error){if(edit===draft)$('editor-status').textContent=error.message;}
}
async function uploadPortrait(file){
  if(!file||!edit)return;
  const draft=edit,person=draft.people[editPerson];
  try{
    if(file.size>8*1024*1024)throw Error('头像图片超过 8 MiB，请缩小后上传。');
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)&&!(file.type===''&&/\.(png|jpe?g|webp)$/i.test(file.name)))throw Error('请选择 PNG、JPEG 或 WebP 图片。');
    $('upload-portrait').disabled=true;
    const page=await fileImage(file);
    if(edit!==draft||!draft.people.includes(person)||!$('editor-dialog').open)return;
    const result=await editPortrait({source:page.image,rect:{x:0,y:0,w:1,h:1},name:person.name});
    if(result&&edit===draft&&draft.people.includes(person)&&$('editor-dialog').open){
      Object.assign(person,result,{portraitSource:page.image});delete person.portraitPage;renderPortraitEditor();
    }
  }catch(error){if(edit===draft)$('editor-status').textContent=error.message;}
  finally{$('upload-portrait').disabled=false;$('portrait-file').value='';}
}
function renderRules(){const person=edit.people[editPerson];$('rule-list').replaceChildren(...person.rules.map((rule,index)=>{let value=rule.value??'';if(['room','notRoom'].includes(rule.type))value=edit.rooms.find(r=>r.id===value)?.name||value;if(['row','col'].includes(rule.type))value=Number(value)+1;if(rule.type==='cells')value=rule.value.map(i=>coord(i,edit)).join(', ');const row=el('div','rule-row',`${RULE_NAMES[rule.type]}${value!==''?'：'+value:''}${rule.gender?'（另一人：'+(rule.gender==='male'?'男':'女')+'）':''}`), remove=el('button','','×');remove.setAttribute('aria-label','删除规则');remove.onclick=()=>{person.rules.splice(index,1);person.verified=false;$('person-verified').checked=false;renderRules();};row.append(remove);return row;}));}
function addRule(){const type=$('rule-type').value;let value=$('rule-value').value.trim();try{
  if(['room','notRoom'].includes(type)){const room=edit.rooms.find(r=>r.name===value||r.id===value);if(!room)throw Error('请填写已有区域名称。');value=room.id;}
  if(['row','col'].includes(type)){value=Number(value)-1;if(!Number.isInteger(value)||value<0||value>=(type==='row'?edit.rows:edit.cols))throw Error('行列编号从 1 开始，且不能超出棋盘。');}
  if(['with','notWith'].includes(type)){const other=edit.people.find(x=>x.id===value.toUpperCase()||x.name===value);if(!other||other===edit.people[editPerson])throw Error('请填写另一名人物的编号或姓名。');value=other.id;}
  if(type==='cells'){value=value.split(/[,，\s]+/).filter(Boolean).map(text=>{const match=/^([A-Z]+)(\d+)$/.exec(text.toUpperCase());if(!match)throw Error('坐标格式为 A1,B3。');let col=0;for(const char of match[1])col=col*26+char.charCodeAt(0)-64;const row=Number(match[2])-1;if(row<0||row>=edit.rows||col<1||col>edit.cols)throw Error('坐标超出棋盘。');return row*edit.cols+col-1;});if(!value.length)throw Error('请至少填写一个坐标。');}
  if(type!=='alone'&&(value===''||value===undefined))throw Error('请填写规则值。');const draft=clone(edit);draft.people[editPerson].rules.push({type,value,...(['otherOn','otherBeside'].includes(type)?{gender:$('rule-gender').value}:{})});validatePuzzle(draft);edit=draft;edit.people[editPerson].verified=false;$('person-verified').checked=false;$('rule-value').value='';renderRules();
  }catch(error){$('editor-status').textContent=error.message;}}
async function saveEditor(){const draft=edit;$('save-editor').disabled=true;try{if(draft.originalPage&&draft.grid){const image=await cropImage(draft.originalPage,draft.grid);if(edit!==draft||!$('editor-dialog').open)return;draft.background=image;}edit.title=$('edit-title').value.trim()||'未命名案件';validatePuzzle(edit);const newIds=new Set(edit.people.map(x=>x.id)), next=clone(editState);next.elapsed=s().elapsed;next.placements=Object.fromEntries(Object.entries(next.placements).filter(([id])=>newIds.has(id)));next.notes=Object.fromEntries(Object.entries(next.notes).map(([i,notes])=>[i,notes.filter(id=>newIds.has(id))]));next.checked=next.checked.filter(id=>newIds.has(id));next.accusation=null;workspace.puzzle=edit;workspace.state=next;workspace.undo=[];workspace.redo=[];edit=null;changed();render();$('editor-dialog').close();toast('案件已保存，编辑前的撤销记录已清空。');}catch(error){$('editor-status').textContent=error.message;}finally{$('save-editor').disabled=false;}}

// UI events use delegation so rerendering cannot leave stale handlers behind.
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{chooseMode(button.dataset.mode);render();});
let holdTimer=null,held=false,pointerStart=null;
$('board').addEventListener('pointerdown',event=>{const cell=event.target.closest('[data-cell]');if(!cell||event.button!==0||panning)return;pointerStart=[event.clientX,event.clientY];held=false;if(mode==='note')holdTimer=setTimeout(()=>{held=true;move(Number(cell.dataset.cell),'place');},450);});
$('board').addEventListener('pointermove',event=>{if(pointerStart&&Math.hypot(event.clientX-pointerStart[0],event.clientY-pointerStart[1])>10)clearTimeout(holdTimer);});
window.addEventListener('pointerup',()=>{clearTimeout(holdTimer);painting=false;});window.addEventListener('pointercancel',()=>{clearTimeout(holdTimer);painting=false;inkStroke=null;drawInk();});
$('board').onclick=event=>{if(panning)return;const cell=event.target.closest('[data-cell]');clearTimeout(holdTimer);if(!cell)return;if(held){held=false;return;}move(Number(cell.dataset.cell));};
$('board').oncontextmenu=event=>{if(panning){event.preventDefault();return;}const cell=event.target.closest('[data-cell]');if(cell){event.preventDefault();move(Number(cell.dataset.cell),'exclude');}};
document.addEventListener('dragstart',event=>{if(panning&&event.target.closest('#board')){event.preventDefault();return;}const token=event.target.closest('[data-person]'),cell=event.target.closest('[data-cell]');const id=token?.dataset.person||(cell&&Object.entries(s().placements).find(([,i])=>i===Number(cell.dataset.cell))?.[0]);if(id){clearTimeout(holdTimer);event.dataTransfer.setData('text/murdoku-person',id);event.dataTransfer.effectAllowed='move';}});
$('board').ondragover=event=>event.preventDefault();$('board').ondrop=event=>{event.preventDefault();const cell=event.target.closest('[data-cell]'),id=event.dataTransfer.getData('text/murdoku-person');if(cell&&p().people.some(x=>x.id===id)){selected=id;move(Number(cell.dataset.cell),'place');}};
$('ink-canvas').onpointerdown=event=>{if(paused)return;event.preventDefault();$('ink-canvas').setPointerCapture(event.pointerId);const box=event.currentTarget.getBoundingClientRect();inkStroke=[localToGlobal(p(),bounds(),(event.clientX-box.left)/box.width,(event.clientY-box.top)/box.height)];};
$('ink-canvas').onpointermove=event=>{if(!inkStroke)return;const box=event.currentTarget.getBoundingClientRect();inkStroke.push(localToGlobal(p(),bounds(),(event.clientX-box.left)/box.width,(event.clientY-box.top)/box.height));drawInk();};
$('ink-canvas').onpointerup=()=>{if(!inkStroke)return;const next=clone(s());if(inkStroke.length>1)next.ink.push(inkStroke);inkStroke=null;mutate(next);};
$('pan-toggle').onclick=()=>{panning=!panning;if(panning&&currentView().mode==='overview')updateView({...currentView(),mode:'detail'});syncPan();};
$('people-search').oninput=renderPeople;$('only-unplaced').onchange=renderPeople;
$('board').addEventListener('pointerdown',event=>{
  if((!panning&&event.button!==1)||currentView().mode!=='detail')return;
  event.preventDefault();const box=$('board').getBoundingClientRect();
  panDrag={x:event.clientX,y:event.clientY,view:{...currentView()},cw:box.width/bounds().cols,ch:box.height/bounds().rows,pointer:event.pointerId};
  $('board').setPointerCapture(event.pointerId);
});
$('board').addEventListener('pointermove',event=>{
  if(!panDrag||panDrag.pointer!==event.pointerId)return;
  updateView({...panDrag.view,row:panDrag.view.row+Math.round((panDrag.y-event.clientY)/panDrag.ch),col:panDrag.view.col+Math.round((panDrag.x-event.clientX)/panDrag.cw)});
});
$('board').addEventListener('pointerup',()=>panDrag=null);$('board').addEventListener('pointercancel',()=>panDrag=null);
$('undo-btn').onclick=undo;$('redo-btn').onclick=redo;$('check-btn').onclick=check;$('hint-btn').onclick=hint;$('accuse-btn').onclick=accuse;
$('cross-width').oninput=()=>setCrossWidth($('cross-width').value);
$('cross-width').onchange=()=>saveSetting('crossWidth',crossWidth).catch(()=>toast('黑叉粗细设置未能保存。'));
for(const id of ['auto-mask','show-notes','show-art'])$(id).onchange=renderBoard;
$('pause-btn').onclick=()=>{paused=!paused;render();persist();};$('resume-btn').onclick=()=>{paused=false;render();};$('zoom-in').onclick=()=>setZoom(zoom+.2);$('zoom-out').onclick=()=>setZoom(zoom-.2);$('zoom-fit').onclick=()=>setZoom(1);
$('fullscreen-btn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game-panel').requestFullscreen();}catch{toast('当前浏览器不支持全屏。');}};
$('clear-ink').onclick=()=>{const next=clone(s());next.ink=[];mutate(next);};
$('reset-btn').onclick=()=>message('重新调查这个案件？','清空当前页的人物、候选、批注和计时。原题和规则会保留，可用撤销恢复。',[{label:'取消'},{label:'重新开始',primary:true,action:()=>{mutate(blankState());paused=false;render();}}]);
$('help-btn').onclick=()=>$('help-dialog').showModal();$('library-btn').onclick=showLibrary;$('import-btn').onclick=openImport;$('export-btn').onclick=exportCase;$('edit-btn').onclick=openEditor;
$('case-notes').oninput=()=>{s().memo=$('case-notes').value;scheduleSave();};
$('file-input').onchange=event=>importFile(event.target.files[0]);
$('preview-image').onload=fitAlignmentPreview;
const alignmentResizeObserver=window.ResizeObserver?new ResizeObserver(fitAlignmentPreview):null;
alignmentResizeObserver?.observe($('alignment-preview-pane'));
$('alignment-preview-pane').addEventListener('wheel',event=>{
  const options=document.querySelector('.alignment-options'), before=options.scrollTop;
  options.scrollTop+=event.deltaY;
  if(options.scrollTop!==before)event.preventDefault();
},{passive:false});
$('drop-zone').ondragover=event=>{event.preventDefault();$('drop-zone').classList.add('dragover');};$('drop-zone').ondragleave=()=>$('drop-zone').classList.remove('dragover');$('drop-zone').ondrop=event=>{event.preventDefault();$('drop-zone').classList.remove('dragover');importFile(event.dataTransfer.files[0]);};
$('url-import-btn').onclick=async()=>{const url=$('pdf-url').value.trim();$('url-import-btn').disabled=true;$('import-status').textContent='正在下载官方 PDF…';try{const response=await fetch('/api/fetch?url='+encodeURIComponent(url));if(!response.ok){const error=await response.json();throw Error(error.error);}const blob=await response.blob();await importFile(new File([blob],url.split('/').at(-1)||'puzzle.pdf',{type:'application/pdf'}));}catch(error){$('import-status').textContent=error.message;}finally{$('url-import-btn').disabled=false;}};
$('blank-btn').onclick=async()=>{const puzzle=makePuzzle();await activate(newWorkspace(puzzle));$('import-dialog').close();openEditor();};
$('detect-btn').onclick=detectPending;$('apply-import').onclick=applyImport;$('refresh-people').onclick=refreshImportPeople;
$('import-page').onchange=async()=>{if(!pending?.bytes)return;const page=Number($('import-page').value);$('import-page').disabled=true;setImportActionBusy(true,'正在读取页面…');try{pending.page=await renderDocument(pending.bytes,page);pending.pageNumber=page;await prepareAlignment();}catch(error){$('import-status').textContent=error.message;}finally{$('import-page').disabled=false;setImportActionBusy(false);}};
for(const id of ['import-rows','import-cols'])$(id).oninput=updateAlignment;$('import-count').onchange=refreshImportPeople;$('extract-people').onchange=refreshImportPeople;
document.querySelectorAll('[data-rect]').forEach(input=>input.oninput=()=>{rect[input.dataset.rect]=Number(input.value)/100;updateAlignment();});
let alignDrag=null;
$('grid-selection').onpointerdown=event=>{event.preventDefault();const box=$('page-preview').getBoundingClientRect();alignDrag={x:event.clientX,y:event.clientY,width:box.width,height:box.height,rect:clone(rect),handle:event.target.dataset.handle};$('grid-selection').setPointerCapture(event.pointerId);};
$('grid-selection').onpointermove=event=>{if(!alignDrag)return;const dx=(event.clientX-alignDrag.x)/alignDrag.width,dy=(event.clientY-alignDrag.y)/alignDrag.height,{rect:r,handle:h}=alignDrag;rect=clone(r);if(!h){rect.x=Math.min(1-r.w,Math.max(0,r.x+dx));rect.y=Math.min(1-r.h,Math.max(0,r.y+dy));}else{if(h.includes('w')){const x=Math.max(0,Math.min(r.x+r.w-.02,r.x+dx));rect.x=x;rect.w=r.w+r.x-x;}if(h.includes('e'))rect.w=r.w+dx;if(h.includes('n')){const y=Math.max(0,Math.min(r.y+r.h-.02,r.y+dy));rect.y=y;rect.h=r.h+r.y-y;}if(h.includes('s'))rect.h=r.h+dy;}updateAlignment();};
$('grid-selection').onpointerup=()=>alignDrag=null;$('grid-selection').onpointercancel=()=>alignDrag=null;
$('grid-selection').onkeydown=event=>{const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(moves[event.key]){event.preventDefault();const delta=event.shiftKey?.01:.001;rect.x+=moves[event.key][0]*delta;rect.y+=moves[event.key][1]*delta;updateAlignment();}};
$('prev-page').onclick=()=>changePage(workspace.book.page-1);$('next-page').onclick=()=>changePage(workspace.book.page+1);
$('original-btn').onclick=()=>{message('原始题目','');const img=el('img','original-image');img.src=p().originalPage||p().background;img.alt='导入的原始题目';$('message-body').append(img);if(p().extractedText){const details=el('details'),summary=el('summary','','提取的原文（未经校对）');details.append(summary,el('p','',p().extractedText));$('message-body').append(details);}};
$('demo-btn').onclick=async()=>{const saved=await getCase('original-rainy-archive-v1').catch(()=>null);await activate(saved||newWorkspace(demoPuzzle()));$('library-dialog').close();};
$('map-tab').onclick=()=>{$('map-editor').hidden=false;$('people-editor').hidden=true;$('map-tab').classList.add('active');$('people-tab').classList.remove('active');};$('people-tab').onclick=()=>{$('map-editor').hidden=true;$('people-editor').hidden=false;$('people-tab').classList.add('active');$('map-tab').classList.remove('active');renderPersonEditor();};
for(const input of document.querySelectorAll('[data-editor-grid]'))input.oninput=()=>{if(edit?.grid){edit.grid[input.dataset.editorGrid]=Number(input.value)/100;updateEditorGrid();}};
let editorGridDrag=null;
$('editor-grid-selection').onpointerdown=event=>{if(!edit?.grid||!edit.originalPage)return;event.preventDefault();const box=$('editor-source-page').getBoundingClientRect();editorGridDrag={x:event.clientX,y:event.clientY,width:box.width,height:box.height,rect:clone(edit.grid),handle:event.target.dataset.handle};$('editor-grid-selection').setPointerCapture(event.pointerId);};
$('editor-grid-selection').onpointermove=event=>{if(!editorGridDrag)return;const dx=(event.clientX-editorGridDrag.x)/editorGridDrag.width,dy=(event.clientY-editorGridDrag.y)/editorGridDrag.height,{rect:r,handle:h}=editorGridDrag;edit.grid=clone(r);if(!h){edit.grid.x=Math.min(1-r.w,Math.max(0,r.x+dx));edit.grid.y=Math.min(1-r.h,Math.max(0,r.y+dy));}else{if(h.includes('w')){const x=Math.max(0,Math.min(r.x+r.w-.02,r.x+dx));edit.grid.x=x;edit.grid.w=r.w+r.x-x;}if(h.includes('e'))edit.grid.w=r.w+dx;if(h.includes('n')){const y=Math.max(0,Math.min(r.y+r.h-.02,r.y+dy));edit.grid.y=y;edit.grid.h=r.h+r.y-y;}if(h.includes('s'))edit.grid.h=r.h+dy;}updateEditorGrid();};
$('editor-grid-selection').onpointerup=()=>editorGridDrag=null;$('editor-grid-selection').onpointercancel=()=>editorGridDrag=null;
$('editor-grid-selection').onkeydown=event=>{const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(moves[event.key]&&edit?.grid){event.preventDefault();const delta=event.shiftKey?.01:.001;edit.grid.x+=moves[event.key][0]*delta;edit.grid.y+=moves[event.key][1]*delta;updateEditorGrid();}};
$('editor-board').onpointerdown=event=>{const cell=event.target.closest('[data-edit-cell]');if(cell){event.preventDefault();painting=true;paint(Number(cell.dataset.editCell));}};
$('editor-board').onpointermove=event=>{if(!painting)return;const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-edit-cell]');if(cell)paint(Number(cell.dataset.editCell));};
$('paint-room').onchange=selectRoom;
$('room-name').oninput=()=>{const room=edit.rooms.find(r=>r.id===$('paint-room').value);if(room){room.name=$('room-name').value;$('paint-room').selectedOptions[0].textContent=room.name;}};
$('room-color').oninput=()=>{const room=edit.rooms.find(r=>r.id===$('paint-room').value);if(room){room.color=$('room-color').value;renderEditorGrid();}};
$('add-room').onclick=()=>{const room={id:crypto.randomUUID(),name:`区域 ${edit.rooms.length+1}`,color:ROOM_COLORS[edit.rooms.length%ROOM_COLORS.length]};edit.rooms.push(room);renderRoomOptions();$('paint-room').value=room.id;selectRoom();};
$('fill-room').onclick=()=>{for(const cell of edit.cells)if(!cell.room)cell.room=$('paint-room').value;edit.people.forEach(person=>person.verified=false);renderEditorGrid();};
$('edit-person').onchange=()=>{editPerson=Number($('edit-person').value);renderPersonEditor();};
$('person-name').oninput=()=>{edit.people[editPerson].name=$('person-name').value;$('edit-person').selectedOptions[0].textContent=`${edit.people[editPerson].id} · ${$('person-name').value}`;};
$('person-clue').oninput=()=>{edit.people[editPerson].clue=$('person-clue').value;edit.people[editPerson].verified=false;$('person-verified').checked=false;};
$('person-victim').onchange=()=>{if($('person-victim').checked)edit.people.forEach((person,i)=>person.victim=i===editPerson);else edit.people[editPerson].victim=false;renderPersonEditor();};
$('person-gender').onchange=()=>{edit.people[editPerson].gender=$('person-gender').value;edit.people.forEach(person=>person.verified=false);$('person-verified').checked=false;};
$('person-verified').onchange=()=>edit.people[editPerson].verified=$('person-verified').checked;
$('add-person').onclick=()=>{if(edit.people.length>=64)return toast('最多 64 人。');let index=0;while(edit.people.some(x=>x.id===personLabel(index)))index++;const id=personLabel(index);edit.people.push({id,name:`人物 ${id}`,clue:'',rules:[],verified:false,victim:false});editPerson=edit.people.length-1;renderPersonEditor();};
$('delete-person').onclick=()=>{const removed=edit.people[editPerson];if(removed.victim)return;edit.people.splice(editPerson,1);for(const person of edit.people){const count=person.rules.length;person.rules=person.rules.filter(r=>!(['with','notWith'].includes(r.type)&&r.value===removed.id));if(person.rules.length!==count)person.verified=false;}editPerson=Math.max(0,editPerson-1);renderPersonEditor();};
$('relabel-people').onclick=()=>{
  const result=relabelPeople(edit,editState);edit=result.puzzle;editState=result.state;
  renderPersonEditor();$('editor-status').textContent='已按姓名首字母修正编号，位置和笔记随人物保留。点击保存生效。';
};
$('edit-portrait').onclick=adjustPortrait;
$('portrait-source-page').onchange=updatePortraitSourcePreview;
$('upload-portrait').onclick=()=>$('portrait-file').click();
$('portrait-file').onchange=event=>uploadPortrait(event.target.files[0]);
$('clear-portrait').onclick=()=>{const person=edit.people[editPerson];for(const key of ['portrait','portraitRect','portraitSource','portraitPage'])delete person[key];renderPortraitEditor();};
$('add-rule').onclick=addRule;$('save-editor').onclick=saveEditor;$('realign-grid').onclick=realignEditorGrid;
$('rule-type').onchange=()=>{$('rule-gender').hidden=!['otherOn','otherBeside'].includes($('rule-type').value);$('rule-value').disabled=$('rule-type').value==='alone';$('rule-value').placeholder=['row','col'].includes($('rule-type').value)?'从 1 开始，例如 3':$('rule-type').value==='cells'?'例如 A1,B3,C5':'已有区域名称、物品名或人物编号';};
document.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]')||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.isComposing)return;
  if(event.key==='?'){event.preventDefault();$('help-dialog').showModal();return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();return;}
  if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('#minimap,.view-toolbar,.map-navigation,#col-labels,#row-labels'))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const row=Math.floor(currentCell/p().cols),col=currentCell%p().cols;let r=row,c=col;if(event.key==='ArrowUp')r--;if(event.key==='ArrowDown')r++;if(event.key==='ArrowLeft')c--;if(event.key==='ArrowRight')c++;currentCell=Math.max(0,Math.min(p().rows-1,r))*p().cols+Math.max(0,Math.min(p().cols-1,c));if(!containsCell(p(),bounds(),currentCell))updateView({...currentView(),row:Math.max(0,Math.min(r,currentView().row+(r>=bounds().row+bounds().rows?1:0))),col:Math.max(0,Math.min(c,currentView().col+(c>=bounds().col+bounds().cols?1:0)))});else renderBoard();$('board').querySelector(`[data-cell="${currentCell}"]`)?.focus({preventScroll:true});return;}
  if(['Enter',' '].includes(event.key)&&event.target.closest('#board')){event.preventDefault();move(currentCell,event.key===' '?'place':mode);return;}
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();move(currentCell,'erase');return;}
  if(/^[1-6]$/.test(event.key)){chooseMode(['place','note','exclude','erase','color','ink'][Number(event.key)-1]);render();return;}
  const person=p().people.find(x=>x.id===event.key.toUpperCase());if(person){event.preventDefault();choosePerson(person.id);}
});
window.addEventListener('resize',()=>{drawInk();fitAlignmentPreview();});document.addEventListener('fullscreenchange',()=>setTimeout(drawInk,100));
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});window.addEventListener('pagehide',persist);
setInterval(()=>{if(!paused&&!document.hidden&&!document.querySelector('dialog[open]')){s().elapsed++;renderTimer();if(s().elapsed%15===0)scheduleSave();}},1000);
try{const saved=await currentCase();if(saved){validatePuzzle(saved.puzzle);saved.state=validateState(saved.puzzle,saved.state);workspace=saved;}}catch(error){toast(`未能恢复存档：${error.message}`);}
try{setCrossWidth(await readSetting('crossWidth'));}catch{setCrossWidth(3);}
render();chooseMode('place');scheduleSave();
// Optional browser-native agent access. It shares the UI's validated state.
if(document.modelContext?.registerTool){
  const controller=new AbortController();window.addEventListener('pagehide',()=>controller.abort(),{once:true});
  for(const tool of [
    {name:'read_murdoku_case',description:'Read the current case, placements, and validation status without changing them.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async()=>({title:p().title,rows:p().rows,cols:p().cols,people:clone(p().people),placements:clone(s().placements),assessment:assess(p(),s())})},
    {name:'place_murdoku_person',description:'Place a named person at a zero-based cell index in the current case. This changes the same board shown in the interface.',inputSchema:{type:'object',properties:{person:{type:'string'},cell:{type:'integer',minimum:0}},required:['person','cell'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(paused)throw Error('The case is paused.');if(!input||!p().people.some(x=>x.id===input.person)||!Number.isInteger(input.cell)||input.cell<0||input.cell>=p().cells.length)throw Error('Invalid person or cell.');selected=input.person;mutate(applyMove(p(),s(),'place',input.cell,selected));return {placements:clone(s().placements),assessment:assess(p(),s())};}}
  ])try{Promise.resolve(document.modelContext.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{}
}
