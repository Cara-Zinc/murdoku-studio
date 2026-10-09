export async function renderDocument(bytes, page = 1, scale = 1800) {
  const response = await fetch(`/api/pdf?page=${page}&scale=${scale}`, {method:'POST', headers:{'Content-Type':'application/pdf'}, body:bytes});
  if (!response.ok) {
    const error = await response.json().catch(()=>({error:'PDF 服务不可用，请用 python3 server.py 启动本地工具。'}));
    throw Error(error.error || 'PDF 转换失败');
  }
  return response.json();
}
export function pageText(page) {
  return typeof page?.text === 'string' && page.text.trim() ? page.text : (page?.words || []).map(word=>word.text).join(' ');
}
export function loadImage(src) {
  return new Promise((resolve,reject)=>{const img = new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('图片无法读取'));img.src=src;});
}
export async function fileImage(file) {
  const url=URL.createObjectURL(file);
  try {
    const image=await loadImage(url), canvas=document.createElement('canvas'), scale=Math.min(1,2000/Math.max(image.width,image.height));
    canvas.width=image.width*scale;canvas.height=image.height*scale;
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return {image:canvas.toDataURL('image/png'),pages:1,page:1,words:[],text:'',width:canvas.width,height:canvas.height};
  } finally {URL.revokeObjectURL(url);}
}
export async function cropImage(src, rect, maxSize = Infinity) {
  const image=await loadImage(src), canvas=document.createElement('canvas');
  const [x,y,w,h]=[rect.x*image.width,rect.y*image.height,rect.w*image.width,rect.h*image.height];
  const scale=Math.min(1,maxSize/Math.max(w,h));
  canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/png');
}
// Find long dark lines, then score repeated spacings. Suggestions require confirmation.
export function detectGridPixels(pixels, width, height) {
  const vertical=new Float64Array(width), horizontal=new Float64Array(height);
  const dark=(x,y)=>{const i=(y*width+x)*4;return pixels[i]+pixels[i+1]+pixels[i+2]<350 && pixels[i+3]>100;};
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(dark(x,y)){vertical[x]++;horizontal[y]++;}
  function peaks(values, minimum) {
    const candidates=[];
    for(let i=1;i<values.length-1;i++) if(values[i]>=minimum && values[i]>=values[i-1] && values[i]>=values[i+1])candidates.push(i);
    const result=[];
    for(const i of candidates.sort((a,b)=>values[b]-values[a])) {
      if(result.some(p=>Math.abs(p-i)<7))continue;
      let left=i,right=i;
      while(left>0&&i-left<6&&values[left-1]>=values[i]*.97)left--;
      while(right<values.length-1&&right-i<6&&values[right+1]>=values[i]*.97)right++;
      result.push(Math.round((left+right)/2));
      if(result.length>=100)break;
    }
    return result.sort((a,b)=>a-b);
  }
  function sequences(points, values) {
    const found=[];
    for(let a=0;a<points.length;a++) for(let b=a+1;b<points.length;b++) {
      const step=points[b]-points[a]; if(step<8||step>values.length/3)continue;
      const run=[points[a],points[b]];let strength=values[points[a]]+values[points[b]];
      // Estimate spacing from the whole run. A rounded first interval otherwise
      // accumulates pixel error and can skip every other line on dense maps.
      while(true) {
        const spacing=(run.at(-1)-run[0])/(run.length-1);
        const next=run[0]+spacing*run.length;
        if(next>=values.length)break;
        const near=points.filter(p=>p>run.at(-1)&&Math.abs(p-next)<Math.max(4,spacing*.08))
          .sort((a,b)=>Math.abs(a-next)-Math.abs(b-next))[0];
        if(near===undefined)break;run.push(near);strength+=values[near];
        if(run.length>=5){
          // Fit all line centers; a wide outer border must not shift every cell.
          const count=run.length-1, mean=count/2, average=run.reduce((sum,p)=>sum+p,0)/run.length;
          const slope=run.reduce((sum,p,i)=>sum+(i-mean)*(p-average),0)/run.reduce((sum,p,i)=>sum+(i-mean)**2,0);
          const start=Math.round(average-slope*mean),end=Math.round(average+slope*mean);
          if(start>=0&&end<values.length)found.push({start,end,count,score:strength*(end-start)});
        }
      }
    }
    return found.sort((a,b)=>b.score-a.score).slice(0,80);
  }
  const xs=sequences(peaks(vertical,height*.12),vertical), ys=sequences(peaks(horizontal,width*.12),horizontal);
  let best=null, score=0;
  for(const x of xs) for(const y of ys) {
    const ratio=((x.end-x.start)/x.count)/((y.end-y.start)/y.count);
    if(ratio<.7||ratio>1.4||x.count>64||y.count>64)continue;
    let intersections=0;
    for(let a=0;a<=x.count;a++)for(let b=0;b<=y.count;b++) {
      const xx=Math.round(x.start+(x.end-x.start)*a/x.count), yy=Math.round(y.start+(y.end-y.start)*b/y.count);
      // Rasterized line centers can fall between pixels. Check a one-pixel
      // neighborhood so antialiasing does not favor a coarser sub-grid.
      let hit=false;
      for(let dy=-1;dy<=1&&!hit;dy++)for(let dx=-1;dx<=1;dx++){
        if(xx+dx>=0&&xx+dx<width&&yy+dy>=0&&yy+dy<height&&dark(xx+dx,yy+dy)){hit=true;break;}
      }
      if(hit)intersections++;
    }
    const density=intersections/((x.count+1)*(y.count+1));
    // Text and portraits can continue a periodic run outside the map.
    // A real board must also have four continuous enclosing grid lines.
    const edge=(vertical,position,start,end)=>{
      let hits=0;
      for(let i=0;i<=80;i++){
        const along=Math.round(start+(end-start)*i/80);
        for(let offset=-2;offset<=2;offset++){
          const xx=vertical?position+offset:along, yy=vertical?along:position+offset;
          if(xx>=0&&xx<width&&yy>=0&&yy<height&&dark(xx,yy)){hits++;break;}
        }
      }
      return hits/81;
    };
    const edges=[edge(true,x.start,y.start,y.end),edge(true,x.end,y.start,y.end),edge(false,y.start,x.start,x.end),edge(false,y.end,x.start,x.end)];
    // Allow objects to overlap part of an edge without preferring a smaller crop.
    const border=Math.pow(edges.reduce((product,value)=>product*value,1),.25);
    const value=(x.end-x.start)*(y.end-y.start)*density*border;
    if(density>.55&&Math.min(...edges)>.65&&value>score){score=value;best={x:x.start/width,y:y.start/height,w:(x.end-x.start)/width,h:(y.end-y.start)/height,rows:y.count,cols:x.count};}
  }
  return best;
}
// Ignore thick outside strokes when fitting the spacing of the actual cells.
export function refineGridPixels(pixels, width, height, grid) {
  const dark=(x,y)=>{const i=(y*width+x)*4;return pixels[i]+pixels[i+1]+pixels[i+2]<350&&pixels[i+3]>100;};
  const fit=(vertical,start,span,count,otherStart,otherSpan)=>{
    const length=vertical?width:height,otherLength=vertical?height:width;
    const values=new Float64Array(length),from=Math.max(0,Math.ceil(otherStart)),to=Math.min(otherLength-1,Math.floor(otherStart+otherSpan));
    const step=span/count,lines=[];
    for(let k=1;k<count;k++){
      const expected=start+k*step,lo=Math.max(0,Math.floor(expected-step*.15)),hi=Math.min(length-1,Math.ceil(expected+step*.15));
      let peak=lo;
      for(let a=lo;a<=hi;a++){
        for(let b=from;b<=to;b++)if(vertical?dark(a,b):dark(b,a))values[a]++;
        if(values[a]>values[peak])peak=a;
      }
      if(values[peak]<(to-from)*.35)continue;
      let left=peak,right=peak;
      while(left>lo&&values[left-1]>=values[peak]*.97)left--;
      while(right<hi&&values[right+1]>=values[peak]*.97)right++;
      lines.push([k,(left+right)/2]);
    }
    if(lines.length<Math.max(3,(count-1)/2))return [start,span];
    const mean=lines.reduce((s,p)=>s+p[0],0)/lines.length,average=lines.reduce((s,p)=>s+p[1],0)/lines.length;
    const slope=lines.reduce((s,[k,p])=>s+(k-mean)*(p-average),0)/lines.reduce((s,[k])=>s+(k-mean)**2,0);
    const origin=average-slope*mean;
    if(origin<0||origin+slope*count>length||Math.abs(origin-start)>step*.2||Math.abs(slope*count-span)>step*.3)return [start,span];
    return [origin,slope*count];
  };
  const [x,w]=fit(true,grid.x*width,grid.w*width,grid.cols,grid.y*height,grid.h*height);
  const [y,h]=fit(false,grid.y*height,grid.h*height,grid.rows,grid.x*width,grid.w*width);
  return {...grid,x:x/width,y:y/height,w:w/width,h:h/height};
}
export async function detectGrid(src) {
  const image=await loadImage(src), canvas=document.createElement('canvas'), scale=Math.min(1,1100/Math.max(image.width,image.height));
  canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const grid=detectGridPixels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
  if(!grid)return null;
  // Locate the frame cheaply, then align to internal lines at source resolution.
  canvas.width=image.width;canvas.height=image.height;ctx.drawImage(image,0,0);
  return refineGridPixels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,grid);
}
// Only extracts possible names. No semantic rule is silently marked as verified.
export function suggestPeople(words, grid) {
  const ignore=new Set(['Rule','One','Can','Cannot','The','What','Read','He','She','There','Someone','They','His','Her','It','GET','NOW','MURDOKU','Row','Column','Chair','Shelf','Table','Bed','Car','TV','Box','Shrub','Plant','Victim','Preppers','Can','Beside']);
  const candidates=words.filter(w=>/^[A-Z][a-z]{2,18}$/.test(w.text)&&!ignore.has(w.text)&&w.height>.012&&!(w.x>=grid.x&&w.x<=grid.x+grid.w&&w.y>=grid.y&&w.y<=grid.y+grid.h));
  const names=[];
  for(const w of candidates.sort((a,b)=>b.height-a.height)) {
    if(names.some(n=>n.name===w.text))continue;
    const next=words.filter(t=>t.y>w.y+w.height*.5&&t.y<w.y+.12&&Math.abs(t.x-w.x)<.10).sort((a,b)=>Math.abs(a.y-b.y)<.008?a.x-b.x:a.y-b.y);
    const clue=next.map(x=>x.text).join(' ');
    if(/\b(He|She|was|Victim|Someone|There)\b/.test(clue))names.push({name:w.text,clue,nameRect:{x:w.x,y:w.y,w:w.width,h:w.height}});
  }
  return names.slice(0,64);
}

// Position every line independently: repeating raster tiles round their spacing.
export function renderAlignmentGrid(box, rows, cols) {
  const count=value=>Number.isFinite(value)?Math.max(1,Math.min(64,Math.trunc(value))):1;
  rows=count(rows);cols=count(cols);
  const ns='http://www.w3.org/2000/svg';
  let svg=box.querySelector('.alignment-lines');
  if(!svg){svg=document.createElementNS(ns,'svg');svg.classList.add('alignment-lines');svg.setAttribute('aria-hidden','true');box.prepend(svg);}
  svg.setAttribute('viewBox',`0 0 ${cols} ${rows}`);svg.setAttribute('preserveAspectRatio','none');
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',[
    ...Array.from({length:cols-1},(_,i)=>`M${i+1} 0V${rows}`),
    ...Array.from({length:rows-1},(_,i)=>`M0 ${i+1}H${cols}`)
  ].join(''));
  path.setAttribute('vector-effect','non-scaling-stroke');
  svg.replaceChildren(path);
}
