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
    const result=[];
    for(let i=1;i<values.length-1;i++) if(values[i]>=minimum && values[i]>=values[i-1] && values[i]>=values[i+1]) {
      if(result.length && i-result.at(-1)<4) {if(values[i]>values[result.at(-1)])result[result.length-1]=i;}
      else result.push(i);
    }
    return result.sort((a,b)=>values[b]-values[a]).slice(0,100).sort((a,b)=>a-b);
  }
  function sequences(points, values) {
    const found=[];
    for(let a=0;a<points.length;a++) for(let b=a+1;b<points.length;b++) {
      const step=points[b]-points[a]; if(step<8||step>values.length/3)continue;
      const run=[points[a],points[b]];let strength=values[points[a]]+values[points[b]];
      for(let next=points[b]+step;next<values.length;next+=step) {
        const near=points.find(p=>Math.abs(p-next)<Math.max(3,step*.06));
        if(near===undefined)break;run.push(near);strength+=values[near];
      }
      if(run.length>=5)found.push({start:run[0],end:run.at(-1),count:run.length-1,score:strength*(run.at(-1)-run[0])});
    }
    return found.sort((a,b)=>b.score-a.score).slice(0,12);
  }
  const xs=sequences(peaks(vertical,height*.12),vertical), ys=sequences(peaks(horizontal,width*.12),horizontal);
  let best=null, score=0;
  for(const x of xs) for(const y of ys) {
    const ratio=((x.end-x.start)/x.count)/((y.end-y.start)/y.count);
    if(ratio<.7||ratio>1.4||x.count>64||y.count>64)continue;
    let intersections=0;
    for(let a=0;a<=x.count;a++)for(let b=0;b<=y.count;b++) {
      const xx=Math.round(x.start+(x.end-x.start)*a/x.count), yy=Math.round(y.start+(y.end-y.start)*b/y.count);
      if(dark(xx,yy))intersections++;
    }
    const density=intersections/((x.count+1)*(y.count+1));
    const value=(x.end-x.start)*(y.end-y.start)*density;
    if(density>.55&&value>score){score=value;best={x:x.start/width,y:y.start/height,w:(x.end-x.start)/width,h:(y.end-y.start)/height,rows:y.count,cols:x.count};}
  }
  return best;
}
export async function detectGrid(src) {
  const image=await loadImage(src), canvas=document.createElement('canvas'), scale=Math.min(1,1100/Math.max(image.width,image.height));
  canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return detectGridPixels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
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
