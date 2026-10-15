// Optical decoration stays outside the interactive grid: hit targets never warp.
export function setupLens({puzzle, bounds, detail, artwork}) {
  const shell=document.getElementById('lens-shell'), canvas=document.getElementById('lens-optics');
  const board=document.getElementById('board');
  let frame=0, source='', image=null;
  function render(){
    shell.classList.toggle('lens-active',detail());
    const b=bounds();
    shell.style.setProperty('--lens-board-width',`${70*Math.min(1,b.cols/b.rows)}%`);
    cancelAnimationFrame(frame);
    if(detail())frame=requestAnimationFrame(paint);
  }
  function paint(){
    if(!detail())return;
    const p=puzzle(), b=bounds(), url=artwork()?p.background||'':'';
    if(url!==source){
      source=url;image=null;
      if(url){const next=new Image();next.onload=()=>{if(source===url){image=next;render();}};next.src=url;}
    }
    const size=512, map=document.createElement('canvas');map.width=1024;map.height=1024;
    const ctx=map.getContext('2d');ctx.fillStyle='#eee9d9';ctx.fillRect(0,0,1024,1024);
    if(image)ctx.drawImage(image,0,0,1024,1024);
    else {
      const colors=new Map(p.rooms.map(room=>[room.id,room.color]));
      p.cells.forEach((cell,i)=>{ctx.fillStyle=colors.get(cell.room)||'#f7f8f3';ctx.fillRect(i%p.cols*1024/p.cols,Math.floor(i/p.cols)*1024/p.rows,1024/p.cols,1024/p.rows);});
    }
    ctx.strokeStyle='#514c4480';ctx.lineWidth=1.5;ctx.beginPath();
    for(let col=0;col<=p.cols;col++){ctx.moveTo(col*1024/p.cols,0);ctx.lineTo(col*1024/p.cols,1024);}
    for(let row=0;row<=p.rows;row++){ctx.moveTo(0,row*1024/p.rows);ctx.lineTo(1024,row*1024/p.rows);}
    ctx.stroke();
    const rect=shell.getBoundingClientRect(), grid=board.getBoundingClientRect();
    if(!grid.width||!grid.height)return;
    const cx=(grid.left-rect.left+grid.width/2)/rect.width, cy=(grid.top-rect.top+grid.height/2)/rect.height;
    const pixels=ctx.getImageData(0,0,1024,1024).data;
    canvas.width=size;canvas.height=size;
    const out=canvas.getContext('2d'), result=out.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const dx=x/size-cx,dy=y/size-cy,r=Math.hypot(dx,dy)*2;
      // Increasing radial compression toward the rim produces curved grid lines.
      const bend=1+0.38*Math.pow(Math.max(0,r-0.45)/0.55,2);
      const col=b.col+b.cols/2+dx*rect.width/grid.width*b.cols*bend;
      const row=b.row+b.rows/2+dy*rect.height/grid.height*b.rows*bend;
      const target=(y*size+x)*4;
      if(col<0||row<0||col>=p.cols||row>=p.rows){result.data.set([231,224,203,255],target);continue;}
      const from=(Math.floor(row/p.rows*1024)*1024+Math.floor(col/p.cols*1024))*4;
      result.data[target]=pixels[from];result.data[target+1]=pixels[from+1];result.data[target+2]=pixels[from+2];result.data[target+3]=255;
    }
    out.putImageData(result,0,0);
  }
  new ResizeObserver(render).observe(shell);
  return {render};
}
