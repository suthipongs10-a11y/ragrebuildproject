/* ---------- art ---------- */
const EMB=__EMB__;
const MAN=__MANIFEST__;
const IMG={};let artReady=false;
const okImg=i=>i&&i.complete&&i.naturalWidth>0;
function loadArt(){
  const jobs=[];
  const add=(key,src)=>{const i=new Image();IMG[key]=i;jobs.push(new Promise(r=>{i.onload=r;i.onerror=r}));i.src=EMB[src]||('assets/'+src)};
  for(const z of ['forest','deep','town','sky','abyss','desert'])for(const k of ['far','mid','near','ground','plat'])add(z+'_'+k,MAN[z][k]);
  for(const[k,v]of Object.entries(MAN.sprites))add('spr_'+k,v.src);
  for(const[k,v]of Object.entries(MAN.icons))add('ic_'+k,v.src);
  for(const[k,v]of Object.entries(MAN.parts))add('hero_'+k,v.src);
  for(const f of Object.keys(EMB))if(/^(v3_)/.test(f))add(f.replace(/\.webp$/,''),f);
  return Promise.all(jobs).then(()=>{buildPatterns();artReady=true;setButtonIcons()});
}
const imgSrc=k=>{const i=IMG[k];return okImg(i)?i.src:''};
function setButtonIcons(){
  const s1=IMG.v3_skill_power_slash,s2=IMG.v3_skill_magnum_burst;
  $('#i_sk1').src=okImg(s1)?s1.src:imgSrc('ic_sword');$('#i_sk2').src=okImg(s2)?s2.src:imgSrc('ic_e_fire');
  updateUltIcon();
}
function updateUltIcon(){const l=leader();const u=IMG['v3_ult_'+l];$('#i_ult').src=okImg(u)?u.src:imgSrc('spr_'+l)}
function itemIcon(id){const b=ITEMS[id];const v=IMG['v3_'+(WPN_ART[id]||id)];return okImg(v)?v.src:imgSrc('ic_'+b.img)}
function cardIcon(id){const v=IMG['v3_card_'+id];return okImg(v)?v.src:imgSrc('spr_'+id)}

__TILES__

const EH={poring:24,king:62,mantis:44,bird:30,fish:24,scorpion:30,harpy:58,kraken:104};
function enemyPose(e){
  const flip=e.dir>0;let h=EH[e.t],sx=1,sy=1,rot=0;
  if(e.t==='poring'||e.t==='king'){const sq=e.onGround?1+Math.sin(time*6+e.ph)*.04:1;sy=e.onGround?sq:(e.vy<0?1.12:.92);sx=1/sy}
  if(e.t==='mantis'||e.t==='scorpion')rot=Math.sin(time*9+e.ph)*.03;
  if(e.t==='bird'||e.t==='harpy')sy=1+Math.sin(time*10+e.ph)*.04;
  if(e.t==='kraken'){sx=1+Math.sin(time*1.6)*.03;sy=1-Math.sin(time*1.6)*.03}
  if(e.t==='harpy'&&e.st==='dive')rot=(flip?1:-1)*.5;
  if(e.stun>0)rot+=Math.sin(time*40)*.06;
  const by=e.d.fly&&e.t!=='kraken'?e.y+e.h:e.y+e.h+2;
  return{flip,h,sx,sy,rot,by,cx:e.x+e.w/2};
}
function drawEnemy(e){
  const q=enemyPose(e);
  if(!e.d.fly){ctx.globalAlpha=.25;El(q.cx,e.y+e.h+1,e.w*.55,2.5,'#000');ctx.globalAlpha=1}
  if(!sprite('spr_'+e.t,q.cx,q.by,q.h,q.flip,q.rot,q.sx,q.sy))El(q.cx,e.y+e.h/2,e.w/2,e.h/2,'#c88');
  if(e.flash>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,e.flash*7)*.8;sprite('spr_'+e.t,q.cx,q.by,q.h,q.flip,q.rot,q.sx,q.sy);ctx.restore()}
  if(!e.d.boss&&e.hp<e.d.hp){const w=Math.max(18,e.w),x=q.cx-w/2,y=e.y-8;Rf(x,y,w,3,'rgba(20,10,5,.7)');Rf(x,y,w*Math.max(0,e.hp)/e.d.hp,3,'#e8503a')}
}
function drawDying(e){
  const q=enemyPose(e),k=e.dieT/.45;
  ctx.save();ctx.globalAlpha=1-k;sprite('spr_'+e.t,q.cx,q.by,q.h*(1+k*.25),q.flip,q.rot,q.sx,q.sy*(1-k*.3));
  ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(1-k)*.9;sprite('spr_'+e.t,q.cx,q.by,q.h*(1+k*.25),q.flip,q.rot,q.sx,q.sy*(1-k*.3));ctx.restore();
}
function drawPet(q){
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.22+.08*Math.sin(time*4);El(q.x,q.y,10,10,PETS[q.id].c);ctx.restore();
  sprite('spr_'+q.id,q.x,q.y+10,q.id==='buddy'?17:21,p.dir<0);
  if(q.id===leader()){ctx.globalAlpha=.9;icon('crown',q.x,q.y-12,7);ctx.globalAlpha=1}
}

/* hero cut-out rig (parts-sheet units) */
const PV={head:[225,392],torso:[715,483],uarm:[1050,165],farm:[1340,175],thigh:[180,578],shin:[515,592],scarf:[1090,628],sword:[1255,645]};
function part(k,rot=0){const P=MAN.parts[k],i=IMG['hero_'+k];if(rot)ctx.rotate(rot);if(okImg(i))ctx.drawImage(i,P.x-PV[k][0],P.y-PV[k][1],P.w,P.h)}
function leg(th,sh){ctx.save();ctx.rotate(th);part('thigh');ctx.translate(-20,327);part('shin',sh);ctx.restore()}
function drawSword(){
  const w=weapon(),id=w?w.id:'w_train',el=ITEMS[id].el,art=IMG['v3_'+WPN_ART[id]];
  const big=id==='w_king'||id==='w_kraken'?1.25:id==='w_iron'?1.1:1;
  ctx.save();ctx.scale(big,big);
  if(okImg(art)){const s=360/art.naturalWidth*1.0;ctx.drawImage(art,-60,-55,art.naturalWidth*s*.9,art.naturalHeight*s*.9)}
  else part('sword');
  const glowC=el?ELC[el]:(w&&w.ref>=7?'#ffd88a':ITEMS[id].rare?'#fff0c0':null);
  if(glowC){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.35+.15*Math.sin(time*6);ctx.strokeStyle=glowC;ctx.lineCap='round';
    ctx.lineWidth=46;ctx.beginPath();ctx.moveTo(40,40);ctx.lineTo(230,250);ctx.stroke();ctx.lineWidth=20;ctx.globalAlpha=.5;ctx.stroke()}
  ctx.restore();
}
function drawPlayer(){
  if(p.dead)return;if(p.inv>0&&!ult&&Math.floor(time*20)%2)return;
  const cx=p.x+p.w/2,feet=p.y+p.h+1,d=p.dir;
  ctx.globalAlpha=.28;El(cx,feet,9,2.5,'#000');ctx.globalAlpha=1;
  if(!okImg(IMG.hero_torso)){Rf(p.x,p.y,p.w,p.h,'#3c6fd8');return}
  const SC=42/1344;
  let bob=0,tf=-.05,sf=.05,tb=.08,sb=.05,ua=.12,fa=-.35,ba=.15,lean=0,sw=-1.236,scarf=Math.sin(time*5)*.12;
  const run=p.onGround&&Math.abs(p.vx)>12;
  if(run){const ph=p.walk*11;tf=.55*Math.sin(ph);tb=.55*Math.sin(ph+Math.PI);
    sf=.1+.75*Math.max(0,Math.sin(ph-1.4));sb=.1+.75*Math.max(0,Math.sin(ph+Math.PI-1.4));
    ua=-.5*Math.sin(ph);ba=.45*Math.sin(ph);bob=-Math.abs(Math.cos(ph))*22;lean=.08;scarf=.35+Math.sin(time*14)*.15}
  else if(!p.onGround){tf=-.75;sf=1.05;tb=.35;sb=.75;ua=p.vy<0?-.9:-.4;fa=-.4;ba=-.3;lean=.05;scarf=p.vy<0?-.25:.5}
  else{bob=Math.sin(time*2.4)*7;ua=.12+Math.sin(time*2.4)*.04}
  if(p.atkT>0){
    const dur=p.atkKind==='heavy'?.2:p.atkKind==='slam'?.18:.16,k=1-p.atkT/dur,e=1-(1-k)*(1-k);
    if(p.atkKind==='n'){ua=2.4+e*2.6;fa=-.15;sw=.335;lean=.12}
    else if(p.atkKind==='n2'){ua=4.9-e*2.2;fa=-.6;sw=.335;lean=.06}
    else if(p.atkKind==='heavy'){ua=2.0+e*3.2;fa=-.1;sw=.335;lean=.22;tf=-.5;sf=.5;bob=-30*e}
    else{ua=3.1+e*1.9;fa=-.2;sw=.335;tf=-.6;sf=.9;tb=.5;sb=.9;bob=60*e}
  }else if(p.atkCd>.1){ua=4.7;fa=-.1;sw=.335}
  if(ult){ua=3.3+Math.sin(time*10)*.1;fa=-.3;sw=-.4;lean=-.05}
  if(R.water){bob+=Math.sin(time*3)*10;scarf=Math.sin(time*3)*.4-.2}
  ctx.save();ctx.translate(cx,feet);ctx.scale(d*SC,SC);ctx.translate(0,-655+bob);
  leg(tb,sb);leg(tf,sf);
  ctx.save();ctx.rotate(lean);
  ctx.save();ctx.translate(-167,-105);part('farm',ba);ctx.restore();
  ctx.save();ctx.translate(-75,-345);part('scarf',scarf);ctx.restore();
  part('torso');
  ctx.save();ctx.translate(-25,-365);part('head',Math.sin(time*2.4)*.02);ctx.restore();
  ctx.save();ctx.translate(-15,-288);ctx.rotate(ua);part('uarm');ctx.translate(55,275);ctx.rotate(fa);
  ctx.save();ctx.translate(110,280);ctx.rotate(sw);drawSword();ctx.restore();
  part('farm');ctx.restore();
  ctx.restore();ctx.restore();
  if(R.water&&!has('dive')&&p.breath<5){Rf(cx-12,p.y-14,24,3,'#1b1b2f');Rf(cx-12,p.y-14,24*Math.max(0,p.breath)/5,3,'#7fd0ff')}
}

/* ---------- VFX ---------- */
function vimg(k){const i=IMG['v3_'+k];return okImg(i)?i:null}
function drawVfxImg(i,x,y,w,h,rot=0,a=1,flipX=false){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a;ctx.translate(x,y);if(rot)ctx.rotate(rot);if(flipX)ctx.scale(-1,1);ctx.drawImage(i,-w/2,-h/2,w,h);ctx.restore()}
function starPath(x,y,n,r1,r2,rot){ctx.beginPath();for(let i=0;i<n*2;i++){const r=i%2?r2:r1,a=rot+i*Math.PI/n;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}ctx.closePath()}
function drawVfx(v){
  const k=v.t/v.life;
  ctx.save();ctx.globalCompositeOperation='lighter';
  if(v.k==='slash'){
    const im=vimg(v.heavy?'vfx_slash_heavy':'vfx_slash');const R0=(v.heavy?30:21)*(v.s||1);
    if(im){drawVfxImg(im,v.x+v.dir*8,v.y,R0*2.6,R0*2.6,v.flip?.6:0,1-k,v.dir<0)}
    else{
      const a0=v.flip?1.1:-1.3,sweep=2.5*Math.min(1,k*2.2),dirS=v.flip?-1:1;
      for(let L=0;L<3;L++){ctx.strokeStyle=L===2?`rgba(255,255,255,${.9*(1-k)})`:v.c;ctx.globalAlpha=(L===2?1:.45)*(1-k);
        ctx.lineWidth=(v.heavy?10:6)*(1-L*.3);ctx.lineCap='round';ctx.beginPath();
        const st=a0,en=a0+dirS*sweep;
        if(v.dir>0)ctx.arc(v.x,v.y,R0-L*2,Math.min(st,en),Math.max(st,en));
        else ctx.arc(v.x,v.y,R0-L*2,Math.PI-Math.max(st,en),Math.PI-Math.min(st,en));
        ctx.stroke()}
    }
  }else if(v.k==='spark'){
    const im=vimg('vfx_hit_spark'),s=(v.s||1);
    if(im)drawVfxImg(im,v.x,v.y,34*s*(.6+k),34*s*(.6+k),v.t*3,1-k);
    else{ctx.fillStyle=v.c;ctx.globalAlpha=1-k;starPath(v.x,v.y,6,14*s*(.5+k),2.5*s,v.x);ctx.fill();El(v.x,v.y,4*s*(1-k)+1,4*s*(1-k)+1,'#fff')}
  }else if(v.k==='crit'){
    const im=vimg('vfx_crit_burst'),sc=k<.25?.6+k*2.4:1.2;
    if(im)drawVfxImg(im,v.x,v.y,46*sc,46*sc,0,1-k*k);
    else{ctx.globalAlpha=1-k*k;ctx.fillStyle='#ff3a1f';starPath(v.x,v.y,10,22*sc,10*sc,time*2);ctx.fill();ctx.fillStyle='#ffd23f';starPath(v.x,v.y,10,14*sc,7*sc,time*2+.3);ctx.fill()}
  }else if(v.k==='ring'){
    ctx.strokeStyle=v.c;ctx.globalAlpha=(1-k)*.9;ctx.lineWidth=3*(1-k)+1;ctx.beginPath();ctx.ellipse(v.x,v.y,v.r*k+4,(v.r*k+4)*.45,0,0,7);ctx.stroke();
  }else if(v.k==='pillar'){
    const im=vimg('vfx_levelup'),h=120,w=v.w||26,a=k<.2?k*5:1-(k-.2)/.8;
    if(im)drawVfxImg(im,v.x,v.y-h/2,w*2.2,h,0,a);
    else{const g=ctx.createLinearGradient(0,v.y-h,0,v.y);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,v.c);ctx.fillStyle=g;ctx.globalAlpha=a*.7;ctx.fillRect(v.x-w/2,v.y-h,w,h);ctx.globalAlpha=a;ctx.fillRect(v.x-w/6,v.y-h,w/3,h)}
  }else if(v.k==='firering'){
    const im=vimg('vfx_fire_ring'),r=v.r*(.3+k*.9);
    if(im)drawVfxImg(im,v.x,v.y-r*.15,r*2.4,r*1.1,0,1-k);
    else{for(let i=0;i<22;i++){const a=i/22*6.28,fx=v.x+Math.cos(a)*r,fy=v.y-6+Math.sin(a)*r*.3;ctx.globalAlpha=(1-k);ctx.fillStyle=i%2?'#ff7a2a':'#ffd23f';ctx.beginPath();ctx.moveTo(fx-4,fy);ctx.lineTo(fx,fy-14*(1-k)-6);ctx.lineTo(fx+4,fy);ctx.fill()}}
  }else if(v.k==='circle'){
    const im=vimg('vfx_magic_circle'),r=v.r*(k<.2?k*5:1),a=k<.8?1:(1-k)*5;
    if(im)drawVfxImg(im,v.x,v.y,r*2.2,r*2.2,time*.8,a*.95);
    else{ctx.globalAlpha=a;ctx.strokeStyle=v.c;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(v.x,v.y,r,0,7);ctx.stroke();ctx.beginPath();ctx.arc(v.x,v.y,r*.72,0,7);ctx.stroke();
      ctx.save();ctx.translate(v.x,v.y);ctx.rotate(time);for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillStyle=v.c;ctx.fillRect(r*.76,-1.5,r*.18,3)}ctx.restore();starPath(v.x,v.y,6,r*.66,r*.33,-time*.7);ctx.stroke()}
  }else if(v.k==='tornado'){
    const im=vimg('vfx_tornado'),h=80,a=Math.sin(k*Math.PI);
    if(im)drawVfxImg(im,v.x,v.y-h/2,40,h,Math.sin(time*20)*.05,a);
    else{for(let i=0;i<8;i++){const yy=v.y-i*10,rw=6+i*3;ctx.strokeStyle='#8ff0bf';ctx.globalAlpha=a*.7;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(v.x+Math.sin(time*20+i)*3,yy,rw,3,0,time*12+i,time*12+i+4);ctx.stroke()}}
  }else if(v.k==='meteor'){
    const x=v.x+(v.tx-v.x)*Math.min(1,k*1.6),y=v.y+(v.ty-v.y)*Math.min(1,k*1.6),im=vimg('vfx_meteor');
    if(k<.62){if(im)drawVfxImg(im,x,y,40,40,0,1);else{ctx.strokeStyle='#ff8a3d';ctx.lineWidth=6;ctx.lineCap='round';ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(x+24,y-30);ctx.lineTo(x,y);ctx.stroke();El(x,y,6,6,'#ffd23f')}}
    else{const kk=(k-.62)/.38;ctx.globalAlpha=1-kk;El(v.tx,v.ty,22*kk+6,22*kk+6,'#ff7a2a');El(v.tx,v.ty,12*kk+3,12*kk+3,'#ffe28a')}
  }else if(v.k==='wave'){
    const im=vimg('vfx_wave'),x=-140+k*(VW+280);
    if(im)drawVfxImg(im,x,VH-90,260,200,0,.9*Math.sin(k*Math.PI));
    else{ctx.globalAlpha=.55*Math.sin(k*Math.PI);ctx.fillStyle='#4fb6ff';ctx.beginPath();ctx.moveTo(x-200,VH);ctx.quadraticCurveTo(x-80,VH-60,x,VH-150);ctx.quadraticCurveTo(x+40,VH-170,x+30,VH-120);ctx.quadraticCurveTo(x+10,VH-60,x+60,VH);ctx.fill();ctx.fillStyle='#dff6ff';ctx.globalAlpha*=.8;El(x+18,VH-140,14,6,'#dff6ff')}
  }
  ctx.restore();
}
function drawUltScene(){
  if(!ult)return;
  const k=ult.t/1.6,id=ult.id,pd=PETS[id];
  ctx.fillStyle=`rgba(10,6,20,${Math.min(.45,ult.t*1.5)*(k>.85?(1-k)/.15:1)})`;ctx.fillRect(0,0,VW,VH);
  const cx=p.x+p.w/2,cy=Math.max(60,p.y-44);
  const appear=Math.min(1,ult.t/.35),out=k>.85?(1-k)/.15:1;
  ctx.save();ctx.globalCompositeOperation='lighter';
  const ci=vimg('vfx_magic_circle');
  if(ci)drawVfxImg(ci,cx,cy+8,90*appear,90*appear,time*.8,.8*out);
  else{ctx.globalAlpha=.8*out;ctx.strokeStyle=pd.c;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy+8,40*appear,0,7);ctx.stroke();starPath(cx,cy+8,6,36*appear,18*appear,time);ctx.stroke()}
  ctx.globalAlpha=.35*out;El(cx,cy,52*appear,52*appear,pd.c);ctx.restore();
  const big=IMG['v3_spirit_big_'+id];
  ctx.save();ctx.globalAlpha=out;const s=appear*(1+Math.sin(time*3)*.03);
  if(okImg(big)){const h=88*s;ctx.drawImage(big,cx-h/2,cy-h*.55,h,h)}else sprite('spr_'+id,cx,cy+34*s,68*s,p.dir<0);
  ctx.restore();
  if(ult.t<.5){ctx.textAlign='center';ctx.font=FT(16);ctx.lineWidth=4;ctx.strokeStyle='rgba(20,10,30,.85)';ctx.globalAlpha=Math.min(1,ult.t*5);ctx.strokeText(pd.ult,VW/2,44);ctx.fillStyle='#fff';ctx.fillText(pd.ult,VW/2,44);ctx.globalAlpha=1;ctx.textAlign='left'}
}

/* ---------- RO numbers ---------- */
function drawNumbers(){
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  for(const q of texts){
    const k=q.t/q.life,a=k>.7?(1-k)/.3:1;
    if(q.kind==='info'){ctx.globalAlpha=a;ctx.font=FT(8);ctx.lineWidth=3;ctx.strokeStyle='rgba(25,14,6,.9)';ctx.strokeText(q.s,q.x,q.y);ctx.fillStyle=q.c||'#fff';ctx.fillText(q.s,q.x,q.y);continue}
    const pop=q.t<.1?1.9-q.t*9:1;
    const cfg={dmg:[16,'#ffffff','#1a0f05'],crit:[22,'#ff3b30','#3a0500'],weak:[18,'#ffb347','#2a1200'],resist:[13,'#b9b9c8','#15151c'],hurt:[15,'#ff6f8f','#2a0010'],heal:[15,'#7dff9a','#002a10']}[q.kind];
    const size=cfg[0]*pop;
    ctx.globalAlpha=a;ctx.font=FP(size);
    ctx.lineWidth=size*.32;ctx.strokeStyle=cfg[2];ctx.strokeText(q.s,q.x,q.y);
    if(q.kind==='crit'){ctx.lineWidth=size*.12;ctx.strokeStyle='#ffd23f';ctx.strokeText(q.s,q.x,q.y)}
    ctx.fillStyle=cfg[1];ctx.fillText(q.s,q.x,q.y);
    if(q.kind==='crit'&&q.t<.5){ctx.font=FP(6);ctx.lineWidth=2.5;ctx.strokeStyle='#3a0500';ctx.strokeText('CRITICAL',q.x,q.y-size*.75);ctx.fillStyle='#ffd23f';ctx.fillText('CRITICAL',q.x,q.y-size*.75)}
  }
  ctx.globalAlpha=1;ctx.textAlign='left';
}
function drawParticles(){
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const q of parts){
    const a=Math.min(1,q.t/(q.t0*.5));ctx.globalAlpha=a;
    if(q.shape==='leaf'){ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot);El(0,0,q.s*1.4,q.s*.6,q.c);ctx.restore()}
    else if(q.shape==='drop'){El(q.x,q.y,q.s*.7,q.s,q.c)}
    else if(q.shape==='spark'){ctx.strokeStyle=q.c;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-q.vx*.04,q.y-q.vy*.04);ctx.stroke();El(q.x,q.y,1,1,'#fff')}
    else{El(q.x,q.y,q.s*1.6,q.s*1.6,q.c);ctx.globalAlpha=a*.8;El(q.x,q.y,q.s*.6,q.s*.6,'#fff')}
  }
  ctx.restore();
}
function drawDrops(){
  for(const d of drops){
    const x=d.x+5,y=d.y+5+Math.sin(time*4+d.x)*1.5;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.35+.15*Math.sin(time*5);El(x,y,9,9,d.kind==='card'?'#c9a6ff':d.kind==='stone'?'#b98cff':ITEMS[d.id]&&ITEMS[d.id].rare?'#ffd88a':'#fff0c8');ctx.restore();
    if(d.kind==='stone')icon('crystal',x,y,13);
    else if(d.kind==='card'){const c=IMG['v3_card_'+d.id];if(okImg(c))ctx.drawImage(c,x-6,y-8,12,16);else icon('card',x,y,13)}
    else{const b=ITEMS[d.id],v=IMG['v3_'+(WPN_ART[d.id]||d.id)];if(okImg(v)){const h=14;ctx.drawImage(v,x-h/2,y-h/2,h,h)}else icon(b.img,x,y,13)}
  }
}

/* ---------- HUD ---------- */
function bar(x,y,w,h,v,c,bg){Rf(x,y,w,h,bg);Rf(x,y,w*Math.max(0,Math.min(1,v)),h,c)}
function drawHUD(){
  ctx.textBaseline='middle';ctx.textAlign='left';
  RR(4,4,138,52,6,'rgba(28,20,12,.6)');
  ctx.font=FP(9);ctx.fillStyle='#ffd88a';ctx.fillText('Lv '+S.lv,9,12);
  ctx.font=FT(7);ctx.fillStyle='#f0e2c4';ctx.fillText(`นักดาบ · ATK ${atk()} · DEF ${def()}`,36,12);
  const mh=maxHP(),ms=maxSP();
  bar(9,18,128,8,S.hp/mh,'#d9573f','#3a1a14');ctx.font=FT(6.5);ctx.fillStyle='#fff';ctx.fillText(`HP ${Math.ceil(S.hp)}/${mh}`,12,22.5);
  bar(9,28,128,6,S.sp/ms,'#4f8fe8','#16243a');ctx.font=FT(5.5);ctx.fillText(`SP ${Math.floor(S.sp)}/${ms}`,12,31.5);
  bar(9,36,128,3,S.exp/need(),'#e8b54a','#3b2d1c');
  bar(9,42,80,4,ug/100,ug>=100?`hsl(${(time*200)%360},80%,75%)`:'#c9a6ff','#2a2040');
  ctx.font=FT(6);ctx.fillStyle=ug>=100?'#fff':'#c9b8ee';ctx.fillText(ug>=100?'ภูตพร้อม! (F)':'เกจภูต',92,44.5);
  S.team.forEach((id,i)=>sprite('spr_'+id,16+i*14,62,11));
  RR(VW-70,30,66,30,6,'rgba(28,20,12,.55)');
  icon('coin',VW-60,38,10);ctx.font=FP(8);ctx.fillStyle='#fff';ctx.fillText(S.zeny+'z',VW-52,38.5);
  icon('crystal',VW-60,51,11);ctx.fillText(S.stones+' หิน',VW-52,51.5);
  // skill cooldowns (keyboard players)
  if(matchMedia('(pointer:fine)').matches){
    [['sk1','slash','C'],['sk2','burst','V']].forEach(([s,id,key],i)=>{const x=VW-70+i*34,y=64;RR(x,y,30,16,4,'rgba(28,20,12,.6)');
      ctx.font=FT(6);ctx.fillStyle=S.sk[id]?(cds[s]>0?'#9a8a70':'#ffd88a'):'#6a5a40';ctx.fillText(`${key} ${S.sk[id]?(cds[s]>0?cds[s].toFixed(1):'พร้อม'):'—'}`,x+3,y+8.5)})}
  const b=enemies.find(e=>e.d.boss);
  if(b){const bw=220,bx=(VW-bw)/2,byy=VH-18;RR(bx-4,byy-12,bw+8,22,4,'rgba(28,20,12,.7)');
    ctx.font=FT(8);ctx.fillStyle='#ffd88a';ctx.textAlign='center';ctx.fillText(`${b.d.name} · ธาตุ${ELN[b.d.el]}`,VW/2,byy-5);ctx.textAlign='left';
    bar(bx,byy,bw,5,b.hp/b.d.hp,'#d9573f','#3a1a14')}
}
function drawUI(){
  ctx.textBaseline='middle';
  if(!p.dead&&!ult){
    let pr=promptFor(nearObj());
    if(onPipe())pr='▼ ลงท่อ';if(underPipe())pr='▲ ขึ้นท่อกลับเมือง';
    if(pr){ctx.font=FT(8);const w=ctx.measureText(pr).width+10,x=Math.max(4,Math.min(VW-w-4,p.x+p.w/2-w/2)),y=p.y-30;RR(x,y,w,13,4,'rgba(28,20,12,.85)');ctx.fillStyle='#ffd88a';ctx.textAlign='left';ctx.fillText(pr,x+5,y+7)}
    const o=nearObj();
    if(o&&o.k==='sign'){ctx.font=FT(8);const w=Math.min(VW-24,ctx.measureText(o.text).width+16);RR((VW-w)/2,VH-46,w,20,5,'rgba(255,246,225,.95)');ctx.fillStyle='#3a2a14';ctx.textAlign='center';ctx.fillText(o.text,VW/2,VH-36)}
  }
  if(banner>0){ctx.globalAlpha=Math.min(1,banner*1.5);ctx.textAlign='center';ctx.font=FT(20);ctx.lineWidth=4;ctx.strokeStyle='rgba(30,16,8,.75)';ctx.strokeText(R.name,VW/2,84);ctx.fillStyle='#fff6e2';ctx.fillText(R.name,VW/2,84);ctx.globalAlpha=1}
  ctx.textAlign='center';ctx.font=FT(8);
  toasts.slice(-3).forEach((t,i)=>{const w=Math.min(VW-20,ctx.measureText(t.s).width+16),y=60+i*16;ctx.globalAlpha=Math.min(1,t.t*2);RR((VW-w)/2,y,w,14,5,'rgba(28,20,12,.85)');ctx.fillStyle=t.c;ctx.fillText(t.s,VW/2,y+7.5)});
  ctx.globalAlpha=1;ctx.textAlign='left';
  if(p.dead){ctx.fillStyle=`rgba(10,5,2,${Math.min(.75,(1.8-deadT)*.8)})`;ctx.fillRect(0,0,VW,VH);ctx.textAlign='center';ctx.font=FT(20);ctx.fillStyle='#ffb09b';ctx.fillText('หมดสติ...',VW/2,VH/2);ctx.textAlign='left'}
  if(flash>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(.6,flash*2);ctx.fillStyle=flashC;ctx.fillRect(0,0,VW,VH);ctx.restore()}
  if(fade>0){ctx.fillStyle=`rgba(0,0,0,${Math.min(1,fade*3)})`;ctx.fillRect(0,0,VW,VH)}
}
function draw(){
  ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  if(shake>0)ctx.translate(rnd(-2.5,2.5)*Math.min(1,shake*5),rnd(-2.5,2.5)*Math.min(1,shake*5));
  drawBG();drawObjs();drawTiles();drawDrops();
  for(const e of dying)drawDying(e);
  for(const e of enemies)drawEnemy(e);
  for(const q of pets)drawPet(q);
  drawPlayer();
  for(const s of shots){ctx.save();ctx.globalCompositeOperation=s.hostile?'source-over':'lighter';El(s.x,s.y,s.r+1.5,s.r+1.5,s.c);El(s.x,s.y,s.r*.5,s.r*.5,'#fff');ctx.restore()}
  drawUltScene();
  for(const v of vfx)drawVfx(v);
  drawParticles();
  ambient();
  if(R.water){ctx.fillStyle='rgba(40,120,170,.10)';ctx.fillRect(0,0,VW,VH)}
  const vg=ctx.createRadialGradient(VW/2,VH/2,VH*.45,VW/2,VH/2,VH*.95);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(30,18,6,.35)');ctx.fillStyle=vg;ctx.fillRect(0,0,VW,VH);
  ctx.setTransform(2,0,0,2,0,0);
  drawNumbers();
  drawHUD();drawUI();
}
