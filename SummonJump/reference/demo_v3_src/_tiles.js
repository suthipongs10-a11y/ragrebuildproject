const PAT={};
function buildPatterns(){
  for(const z of ['forest','deep','town','sky','abyss','desert']){
    const g=IMG[z+'_ground'];if(!okImg(g))continue;
    const top=Math.floor(g.naturalHeight*(MAN[z].groundTop+.3));const h=Math.max(8,g.naturalHeight-top);
    const c=document.createElement('canvas');c.width=g.naturalWidth;c.height=h;const x=c.getContext('2d');
    x.drawImage(g,0,top,g.naturalWidth,h,0,0,g.naturalWidth,h);
    x.fillStyle='rgba(20,14,8,.28)';x.fillRect(0,0,c.width,c.height);
    const p=ctx.createPattern(c,'repeat');
    try{p.setTransform(new DOMMatrix().scale(VW/g.naturalWidth))}catch(e){}
    PAT[z]=p;
  }
}
const ZONE={town:'town',forest:'forest',deep:'deep',sky:'sky',abyss:'abyss',desert:'desert'};

/* ---------- drawing ---------- */
const Rf=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)};
const El=(x,y,rx,ry,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()};
const Poly=(pts,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);ctx.closePath();ctx.fill()};
function RR(x,y,w,h,r,c){ctx.fillStyle=c;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);ctx.fill()}
function sprite(key,cx,bottom,h,flip=false,rot=0,sx=1,sy=1){
  const i=IMG[key];if(!okImg(i))return false;
  const w=h*i.naturalWidth/i.naturalHeight;
  ctx.save();ctx.translate(cx,bottom);if(rot)ctx.rotate(rot);ctx.scale((flip?-1:1)*sx,sy);ctx.drawImage(i,-w/2,-h,w,h);ctx.restore();return true;
}
function icon(key,cx,cy,h){const i=IMG['ic_'+key];if(!okImg(i))return;const w=h*i.naturalWidth/i.naturalHeight;ctx.drawImage(i,cx-w/2,cy-h/2,w,h)}

const AMB=[];
function drawLayer(key,depth){
  const i=IMG[key];if(!okImg(i))return;
  const k=1+depth*.12,w=VW*k,h=VH*k;
  const fx=(p.x+p.w/2)/VW-.5,fy=(p.y+p.h/2)/VH-.5;
  ctx.drawImage(i,(VW-w)/2-fx*(w-VW),(VH-h)-fy*(h-VH)*.4*0,w,h);
}
function drawBG(){
  const z=ZONE[R.theme];
  ctx.fillStyle=R.theme==='abyss'?'#163a52':'#d9c49a';ctx.fillRect(0,0,VW,VH);
  drawLayer(z+'_far',.25);
  // god rays / ambience behind mid layer
  if(R.theme==='forest'||R.theme==='deep'||R.theme==='abyss'){
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<4;i++){const x=80+i*110+Math.sin(time*.3+i)*12,a=.035+.02*Math.sin(time*.7+i*2);
      ctx.fillStyle=R.theme==='abyss'?`rgba(140,220,255,${a})`:`rgba(255,226,160,${a})`;
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+34,0);ctx.lineTo(x+120,VH);ctx.lineTo(x+40,VH);ctx.fill()}
    ctx.restore();
  }
  drawLayer(z+'_mid',.5);
  drawLayer(z+'_near',.85);
}
function ambient(){
  const th=R.theme,n=th==='abyss'?22:16;
  for(let i=0;i<n;i++){
    const s=i*97.13;
    if(th==='abyss'){const x=(s*3.1)%VW+Math.sin(time+i)*5,y=VH-((time*22+s*5)%(VH+20));El(x,y,1.4,1.4,'rgba(200,240,255,.45)')}
    else if(th==='deep'){ctx.globalAlpha=.4+.4*Math.sin(time*2+i);El((s*4.7)%VW+Math.sin(time*.6+i)*14,(s*2.3)%200+30+Math.cos(time*.5+i)*10,1.3,1.3,'#d8ffa8');ctx.globalAlpha=1}
    else if(th==='desert'){const x=((s*4.1)+time*40)%(VW+40)-20,y=(s*1.7)%120+130;ctx.globalAlpha=.25;El(x,y,2.5,.8,'#fff0cc');ctx.globalAlpha=1}
    else if(th==='sky'){const x=((s*3.3)+time*14)%(VW+60)-30,y=(s*1.9)%220+20;ctx.globalAlpha=.18;El(x,y,26,5,'#fff');ctx.globalAlpha=1}
    else{const x=((s*4.1)+time*(18+i%5*4))%(VW+40)-20,y=((s*2.9)+time*(10+i%3*6))%(VH+20)-10,r=time*2+i;
      ctx.save();ctx.translate(x,y);ctx.rotate(r);ctx.globalAlpha=.55;El(0,0,2.6,1.1,i%3?'#d7a24a':'#9fae4c');ctx.restore()}
  }
}
function drawTiles(){
  const z=ZONE[R.theme],M=MAN[z],g=IMG[z+'_ground'],pl=IMG[z+'_plat'];
  const isG=c=>c==='#'||c==='c';
  // body fill
  ctx.fillStyle=PAT[z]||'#5b4630';
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(isG(grid[y][x]))ctx.fillRect(x*T,y*T,T,T);
  ctx.fillStyle='rgba(0,0,0,.22)';
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(isG(grid[y][x])){if(!isG(gtE(x-1,y)))ctx.fillRect(x*T,y*T,3,T);if(!isG(gtE(x+1,y)))ctx.fillRect(x*T+T-3,y*T,3,T);if(y<H-1&&!isG(grid[y+1][x]))ctx.fillRect(x*T,y*T+T-3,T,3)}
  // painted ground edge on the main floor, rock caps elsewhere
  let gy=H-1;const full=y=>grid[y].every(isG);if(full(gy))while(gy>0&&full(gy-1))gy--;
  if(okImg(g)){
    const dh=VW*M.groundAR,iw=g.naturalWidth,ih=g.naturalHeight;
    for(let y=1;y<H;y++){let x=0;
      while(x<W){if(isG(grid[y][x])&&!isG(grid[y-1][x])){let x1=x;while(x1<W&&isG(grid[y][x1])&&!isG(grid[y-1][x1]))x1++;
          if(y===gy){const sx=x/W*iw,sw=(x1-x)/W*iw;ctx.drawImage(g,sx,0,sw,ih,x*T,y*T-M.groundTop*dh,(x1-x)*T,dh)}
          else if(okImg(pl)){let bh=0;while(y+bh<gy&&y+bh<H){let all=true;for(let k=x;k<x1;k++)if(!isG(grid[y+bh][k]))all=false;if(!all)break;bh++}
            const dw=(x1-x)*T+10,ph=dw*M.platAR,top=M.platTop*ph,dh=Math.max(ph,bh*T+top+8);ctx.drawImage(pl,x*T-5,y*T-top-1,dw,dh)}
          x=x1}else x++}}
  }
  // platforms
  for(let y=0;y<H;y++){let x=0;
    while(x<W){const c=grid[y][x];
      if(c==='-'||c==='='){let x1=x;while(x1<W&&grid[y][x1]===c)x1++;
        const run=x1-x,n=Math.max(1,Math.round(run/5)),seg=run*T/n;
        for(let k=0;k<n;k++){const dw=seg+12,dh=dw*M.platAR,dx=x*T+k*seg-6;
          if(okImg(pl))ctx.drawImage(pl,dx,y*T-M.platTop*dh-1,dw,dh);else Rf(dx,y*T,dw,6,'#8a6a45')}
        x=x1}else x++}}
  // rocks & pipes
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=grid[y][x],X=x*T,Y=y*T;
    if(c==='X'){if(gtP(x-1,y)!=='X'){const ri=IMG.desert_plat;if(okImg(ri)){const w=T*2+8,h=w*MAN.desert.platAR;ctx.save();ctx.translate(X+T,Y+T/2);if((x+y)%2)ctx.scale(-1,1);ctx.drawImage(ri,-w/2,-h/2-2,w,h+4);ctx.restore()}else Rf(X,Y,T*2,T,'#7a6a55')}}
    else if('TPU'.includes(c)){
      const left=gtP(x-1,y)!==c,lip=c==='T'||(c==='U'&&gtP(x,y+1)!=='U');
      if(lip){Rf(left?X-2:X,Y,18,T,'#2f5d33');Rf(left?X-1:X,Y+1,17,14,'#4f8c4a');if(left)Rf(X+1,Y+2,4,12,'#9ccf86')}
      else{Rf(left?X+1:X,Y,15,T,'#2f5d33');Rf(left?X+2:X,Y,13,T,'#4f8c4a');if(left)Rf(X+4,Y,4,T,'#9ccf86')}
    }}
}
function drawObjs(){
  for(const o of objs){const cx=o.x*T+8,bottom=(o.y+1)*T+1;
    const map={fountain:['fountain',36],anvil:['anvil',24],altar:['altar',36],sign:['sign',26],chest:['chest',22]};
    const [k,h]=map[o.k];const i=IMG['ic_'+k];
    if(okImg(i)){const w=h*i.naturalWidth/i.naturalHeight;
      if(o.k==='altar'){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.25+.15*Math.sin(time*3);El(cx,bottom-h*.55,h*.55,h*.45,'#b48cff');ctx.restore()}
      if(o.k==='chest'&&S.chest[cur])ctx.globalAlpha=.55;
      ctx.drawImage(i,cx-w/2,bottom-h,w,h);ctx.globalAlpha=1}
    if(o.k==='fountain')for(let j=0;j<3;j++){const k2=(time*1.4+j/3)%1;El(cx+(j-1)*k2*9,bottom-30-Math.sin(k2*Math.PI)*8,1.4,1.4,'#d8f4ff')}
  }
  for(const it of items)icon('crystal',it.x,it.y+Math.sin(time*3)*2,16);
}
