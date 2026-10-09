import {makePuzzle} from './engine.js';
export function demoPuzzle() {
  const p=makePuzzle(6,6,6);
  p.id='original-rainy-archive-v1';p.title='雨夜档案室';p.source='原创入门练习 · 非官方题目';
  p.rooms=[{id:'office',name:'办公室',color:'#e4e9ce'},{id:'lounge',name:'会客室',color:'#dbe8e6'},{id:'archive',name:'档案室',color:'#eee1cc'},{id:'reading',name:'阅览室',color:'#e4dced'},{id:'storage',name:'储藏室',color:'#dbe5d2'}];
  const map=['000111','000111','222111','222333','444333','444333'];
  p.cells.forEach((cell,i)=>{cell.room=p.rooms[Number(map[Math.floor(i/6)][i%6])].id;});
  for(const [index,object,blocked] of [[0,'桌子',true],[6,'文件柜',true],[10,'椅子',false],[14,'文件柜',true],[23,'地毯',false],[25,'架子',true],[4,'植物',true],[18,'箱子',true],[32,'箱子',true]])Object.assign(p.cells[index],{object,blocked});
  p.people=[
    {id:'A',name:'安娜',clue:'她在办公室，与桌子相邻。',rules:[{type:'room',value:'office'},{type:'beside',value:'桌子'}]},
    {id:'B',name:'柏文',clue:'他坐在椅子上。',rules:[{type:'on',value:'椅子'}]},
    {id:'C',name:'程远',clue:'他在第三行的档案室。',rules:[{type:'row',value:2},{type:'room',value:'archive'}]},
    {id:'D',name:'黛宁',clue:'她站在阅览室的地毯上。',rules:[{type:'room',value:'reading'},{type:'on',value:'地毯'}]},
    {id:'E',name:'恩哲',clue:'他在储藏室，与架子相邻。',rules:[{type:'room',value:'storage'},{type:'beside',value:'架子'}]},
    {id:'V',name:'维安',clue:'受害者。他与凶手在同一区域，那里没有第三人。',rules:[],victim:true}
  ].map(x=>({...x,verified:true,victim:!!x.victim}));
  return p;
}
