import {t} from './i18n.js';
import {groupExistingCells,seedPatternGroups,movePatternCell,mergePatternGroups} from './patterns.js';
import {patternTiles,discoverPatterns} from './pattern-images.js';

const categoryNames={unclassified:'待分类',floor:'地板',occupiable:'可占用',blocked:'不可占用'};
const $=id=>document.getElementById(id);
const node=(tag,className,text)=>{const element=document.createElement(tag);element.className=className||'';if(text!==undefined)element.textContent=text;return element;};

export function createPatternEditor({draft,book,coord,onDirty,setBusy}) {
  let selected=null,tiles={thumbnails:[],features:[]},cache=null,loading=null,token=0,abort=null,busy=false,gridSignature='';
  const title=group=>group.name||t`图案 ${draft().patternGroups.indexOf(group)+1}`;
  const focusControl=(group,selector)=>[...$('pattern-groups').children].find(card=>card.dataset.patternGroup===group.id)?.querySelector(selector)?.focus({preventScroll:true});
  function cancel() {token++;abort?.abort();abort=null;const wasBusy=busy;busy=false;if(wasBusy)setBusy(false);}
  function reset() {cancel();selected=null;tiles={thumbnails:[],features:[]};cache=null;loading=null;gridSignature=JSON.stringify(draft()?.grid);$('pattern-status').textContent='';}
  async function loadTiles(current) {
    const key=JSON.stringify([current.id,current.rows,current.cols,current.grid]),source=current.originalPage||current.background;
    if(cache?.key===key && cache.source===source) return loading;
    cache={key,source};const localCache=cache;
    loading=patternTiles(current);
    const result=await loading;if(cache===localCache) tiles=result;
    return result;
  }
  function renderMerge() {
    const old=$('pattern-merge-target').value;
    $('pattern-merge-target').replaceChildren(node('option','',t('选择合并目标')));
    $('pattern-merge-target').firstChild.value='';
    for(const group of draft().patternGroups||[]) if(group.id!==selected) {
      const option=node('option','',`${title(group)} (${group.cells.length})`);option.value=group.id;$('pattern-merge-target').append(option);
    }
    $('pattern-merge-target').value=old;
    $('merge-patterns').disabled=busy||!$('pattern-merge-target').value;
  }
  function renderBoard() {
    const current=draft();if(!current)return;
    const group=current.patternGroups?.find(group=>group.id===selected),chosen=new Set(group?.cells||[]),grid=$('pattern-board');
    grid.style.gridTemplateColumns=`repeat(${current.cols},minmax(0,1fr))`;grid.style.aspectRatio=`${current.cols}/${current.rows}`;
    const source=current.originalPage||current.background;
    grid.style.backgroundImage=source?`url("${source}")`:'';
    const rect=current.originalPage?current.grid:{x:0,y:0,w:1,h:1};
    grid.style.backgroundSize=`${100/rect.w}% ${100/rect.h}%`;
    grid.style.backgroundPosition=`${rect.w>=1?0:rect.x/(1-rect.w)*100}% ${rect.h>=1?0:rect.y/(1-rect.h)*100}%`;
    grid.setAttribute('aria-rowcount',current.rows);grid.setAttribute('aria-colcount',current.cols);
    grid.replaceChildren(...current.cells.map((cell,i)=>{
      const button=node('button',`pattern-cell${chosen.has(i)?' selected':''}`);button.type='button';button.dataset.patternCell=i;
      button.setAttribute('role','gridcell');button.setAttribute('aria-rowindex',Math.floor(i/current.cols)+1);button.setAttribute('aria-colindex',i%current.cols+1);button.tabIndex=i===(group?.cells[0]??0)?0:-1;button.setAttribute('aria-label',t`格子 ${coord(i,current)}${chosen.has(i)?t('，属于本组'):''}`);
      button.setAttribute('aria-pressed',String(chosen.has(i)));button.disabled=busy||!group;
      if(!source) {button.style.background=current.rooms.find(room=>room.id===cell.room)?.color||'';button.textContent=cell.object;}
      return button;
    }));
    $('pattern-selection').textContent=group?t`${title(group)}：${group.cells.length} 个格子`:t('选择一个图案组查看对应格子。');
  }
  function render() {
    const current=draft();if(!current)return;
    const groups=current.patternGroups||[];
    if(!groups.some(group=>group.id===selected))selected=groups[0]?.id||null;
    const classified=groups.filter(group=>group.category!=='unclassified').length;
    $('pattern-summary').textContent=t`${groups.length} 组图案，${classified} 组已分类`;
    $('pattern-rescan').textContent=classified?t('整理未分类图案'):t('整理图案');
    $('pattern-rescan').disabled=busy;
    const cards=[];
    for(const group of groups) {
      if($('pattern-unclassified').checked&&group.category!=='unclassified')continue;
      const card=node('article',`pattern-group${group.id===selected?' selected':''}`);card.dataset.patternGroup=group.id;
      const preview=node('button','pattern-preview');preview.type='button';preview.disabled=busy;preview.setAttribute('aria-label',t`查看 ${title(group)} 的格子`);
      const sampleIndices=[...new Set([group.cells[0],group.cells[Math.floor(group.cells.length/2)],group.cells.at(-1)])];
      for(const i of sampleIndices) {
        if(tiles.thumbnails[i]) {const image=node('img');image.src=tiles.thumbnails[i];image.alt=coord(i,current);preview.append(image);}
        else preview.append(node('span','pattern-text-preview',current.cells[i].object||'◇'));
      }
      preview.onclick=()=>{selected=group.id;render();focusControl(group,'.pattern-preview');};card.append(preview);
      const fields=node('div','pattern-fields'),heading=node('div','pattern-group-heading');
      heading.append(node('strong','',t`图案 ${groups.indexOf(group)+1}`),node('span','',t`${group.cells.length} 格`));fields.append(heading);
      const nameLabel=node('label','',t('图案名称')),name=node('input');name.value=group.name;name.maxLength=120;name.placeholder=t('例如：草地、床、木桶');name.disabled=busy;name.dataset.patternName=group.id;
      name.onfocus=()=>{selected=group.id;for(const card of $('pattern-groups').children)card.classList.toggle('selected',card.dataset.patternGroup===selected);renderBoard();renderMerge();};
      name.oninput=()=>{group.name=name.value;renderMerge();if(group.id===selected)$('pattern-selection').textContent=t`${title(group)}：${group.cells.length} 个格子`;};nameLabel.append(name);fields.append(nameLabel);
      const categoryLabel=node('label','',t('类别')),category=node('select');category.disabled=busy;category.dataset.patternCategory=group.id;
      for(const [value,label] of Object.entries(categoryNames)) {const option=node('option','',t(label));option.value=value;category.append(option);}
      category.value=group.category;category.onchange=()=>{group.category=category.value;selected=group.id;render();focusControl(group,'select');};categoryLabel.append(category);fields.append(categoryLabel);card.append(fields);cards.push(card);
    }
    $('pattern-groups').replaceChildren(...cards);
    if(!cards.length)$('pattern-groups').append(node('p','muted',groups.length?t('全部图案已分类。'):t('点击「整理图案」，按相似图案分组。')));
    renderBoard();renderMerge();
  }
  async function scan() {
    const current=draft();if(!current||busy)return;
    const stamp=++token,grid=JSON.stringify(current.grid);abort=new AbortController();busy=true;setBusy(true);render();
    $('pattern-status').textContent=t('正在整理棋盘图案…');
    try {
      const images=await loadTiles(current);
      let clusters;
      if(images.features.length)clusters=await discoverPatterns(current,book(),images.features,abort.signal);
      else clusters=groupExistingCells(current).map(group=>group.cells);
      if(stamp!==token||draft()!==current||JSON.stringify(current.grid)!==grid||!$('editor-dialog').open)return;
      // Re-running discovery keeps all player classifications, even if new
      // similarity groups would otherwise merge or split those cells.
      const kept=(current.patternGroups||[]).filter(group=>group.category!=='unclassified'),claimed=new Set(kept.flatMap(group=>group.cells));
      const fresh=seedPatternGroups(current,clusters.map(cells=>cells.filter(i=>!claimed.has(i))));
      current.patternGroups=[...kept,...fresh];const ids=new Set();
      current.patternGroups.forEach((group,i)=>{let suffix=0;while(ids.has(group.id))group.id=`discovered-${i}-${suffix++}`;ids.add(group.id);});
      selected=current.patternGroups[0]?.id||null;
      $('pattern-status').textContent=t('图案已整理。请核对分组、填写物品名称并选择类别；保存案件后生效。');
    } catch(error) {if(stamp===token&&error.name!=='AbortError')$('pattern-status').textContent=error.message;}
    finally {if(stamp===token){busy=false;setBusy(false);if(draft()===current)render();}}
  }
  async function open() {
    const current=draft();if(!current)return;
    if(!current.patternGroups)return scan();
    render();try {await loadTiles(current);if(draft()===current&&$('editor-dialog').open)render();}catch(error){if(draft()===current)$('pattern-status').textContent=error.message;}
  }
  function invalidate() {cancel();if(draft())delete draft().patternGroups;cache=null;loading=null;tiles={thumbnails:[],features:[]};$('pattern-status').textContent=t('网格范围已更改，请重新整理图案。');}
  function checkGrid() {const next=JSON.stringify(draft()?.grid);if(next!==gridSignature){gridSignature=next;invalidate();}}
  $('pattern-rescan').onclick=scan;$('pattern-unclassified').onchange=render;
  $('pattern-merge-target').onchange=renderMerge;
  $('merge-patterns').onclick=()=>{const target=$('pattern-merge-target').value;mergePatternGroups(draft(),selected,target);selected=target;render();};
  $('pattern-board').onclick=event=>{
    const button=event.target.closest('[data-pattern-cell]');if(!button||busy||!selected)return;
    const index=Number(button.dataset.patternCell);movePatternCell(draft(),index,selected);onDirty();render();$('pattern-board').children[index]?.focus({preventScroll:true});
  };
  $('pattern-board').onkeydown=event=>{
    const button=event.target.closest('[data-pattern-cell]'),current=draft();if(!button||!current)return;
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-current.cols,ArrowDown:current.cols}[event.key];if(delta===undefined)return;
    const index=Math.max(0,Math.min(current.cells.length-1,Number(button.dataset.patternCell)+delta));event.preventDefault();$('pattern-board').children[index]?.focus();
  };
  $('editor-dialog').addEventListener('close',cancel);
  return {reset,open,render,invalidate,checkGrid,isBusy:()=>busy};
}
