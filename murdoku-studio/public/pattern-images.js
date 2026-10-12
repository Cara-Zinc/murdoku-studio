import {loadImage} from './pdf.js';
import {imageFeature,clusterImageFeatures} from './patterns.js';

export async function patternTiles(puzzle) {
  const source=puzzle.originalPage||puzzle.background;
  if (!source) return {thumbnails:[],features:[]};
  const image=await loadImage(source), rect=puzzle.originalPage?puzzle.grid:{x:0,y:0,w:1,h:1};
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const context=canvas.getContext('2d',{willReadFrequently:true}),features=[],thumbnails=[];
  for(let i=0;i<puzzle.cells.length;i++) {
    const w=rect.w*image.width/puzzle.cols,h=rect.h*image.height/puzzle.rows;
    const x=rect.x*image.width+i%puzzle.cols*w,y=rect.y*image.height+Math.floor(i/puzzle.cols)*h;
    context.clearRect(0,0,64,64);context.drawImage(image,x+w*.06,y+h*.06,w*.88,h*.88,0,0,64,64);
    thumbnails.push(canvas.toDataURL('image/webp',.8));
    const small=document.createElement('canvas');small.width=16;small.height=16;
    const smallContext=small.getContext('2d',{willReadFrequently:true});smallContext.drawImage(canvas,0,0,16,16);
    features.push(imageFeature(smallContext.getImageData(0,0,16,16).data,16,16));
    if(i%128===127) await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {thumbnails,features};
}

export async function discoverPatterns(puzzle,book,features,signal) {
  const all=puzzle.cells.map((_,i)=>i);
  if (book?.bytes && puzzle.originalPage) {
    try {
      const query=new URLSearchParams({page:puzzle.mapPage||book.page,rows:puzzle.rows,cols:puzzle.cols,grid:JSON.stringify(puzzle.grid)});
      const response=await fetch(`/api/patterns?${query}`,{method:'POST',headers:{'Content-Type':'application/pdf'},body:new Uint8Array(book.bytes),signal});
      if(response.ok) {
        const result=await response.json(), assigned=new Set();
        for (const group of result.groups) for(const i of group.cells) {
          if(!Number.isInteger(i)||i<0||i>=all.length||assigned.has(i)) throw Error('Invalid grouping');
          assigned.add(i);
        }
        return [...result.groups.map(group=>group.cells),...clusterImageFeatures(features,all.filter(i=>!assigned.has(i)))];
      }
    } catch(error) {if(error.name==='AbortError') throw error;}
  }
  return clusterImageFeatures(features,all);
}
