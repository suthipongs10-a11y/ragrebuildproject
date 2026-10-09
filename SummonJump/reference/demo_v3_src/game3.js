/* ---------- update ---------- */
function updateFx(dt){
  for(const q of parts){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=q.g*dt;q.vx*=Math.pow(.2,dt);q.t-=dt;q.rot+=dt*6}parts=parts.filter(q=>q.t>0);
  if(parts.length>500)parts.splice(0,parts.length-500);
  for(const q of texts){q.t+=dt;if(q.kind!=='info'){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=330*dt}else q.y+=q.vy*dt}texts=texts.filter(q=>q.t<q.life);
  for(const v of vfx)v.t+=dt;vfx=vfx.filter(v=>v.t<v.life);
  for(const e of dying)e.dieT+=dt;dying=dying.filter(e=>e.dieT<.45);
  for(const t of toasts)t.t-=dt;toasts=toasts.filter(t=>t.t>0);
  if(flash>0)flash-=dt;
}
function update(dt){
  time+=dt;
  updateFx(dt);
  if(shake>0)shake-=dt;if(banner>0)banner-=dt;if(fade>0)fade-=dt;if(rockMsgT>0)rockMsgT-=dt;if(drownMsg>0)drownMsg-=dt;
  if(winT>0){winT-=dt;if(winT<=0)showWin()}
  if(freeze>0){freeze-=dt;return}
  if(p.dead){deadT-=dt;if(deadT<=0)respawn();return}
  for(const k in cds)if(cds[k]>0)cds[k]-=dt;
  S.sp=Math.min(maxSP(),S.sp+dt*(1.2+stat('int')*.08)*(leader()==='water'?1.5:1));
  if(has('regen'))S.hp=Math.min(maxHP(),S.hp+dt*(leader()==='angel'?4:2));

  // ultimate cinematic: world pauses, spirit acts
  if(ult){
    ult.t+=dt;p.inv=Math.max(p.inv,.3);
    if(ult.t>=ult.next&&ult.hits<6){ultHit();ult.next+=.14}
    if(ult.t>1.6){ult=null}
    updatePets(dt);
    return;
  }

  const water=!!R.water,dive=has('dive');
  const want=(K.right?1:0)-(K.left?1:0);
  const spd=water?(dive?95:60):moveSpd();
  if(want){p.dir=want;p.vx+=(want*spd-p.vx)*Math.min(1,dt*(p.onGround?14:8))}
  else p.vx*=Math.pow(p.onGround?.0005:.05,dt);
  if(pressed('jump'))p.jbuf=.12;else p.jbuf-=dt;
  p.coy=p.onGround?.09:p.coy-dt;
  if(p.onGround)p.canDouble=1;
  if(p.jbuf>0){
    if(water){if(dive){p.vy=-210;p.jbuf=0;glow(p.x+p.w/2,p.y+p.h,'#bfe6ff',4,40)}else if(p.onGround){p.vy=-230;p.jbuf=0}}
    else if(p.coy>0){p.vy=-430;p.jbuf=0;p.coy=0}
    else if(p.canDouble&&has('double')){p.vy=-410;p.canDouble=0;p.jbuf=0;glow(p.x+p.w/2,p.y+p.h,'#8ff0bf',12,100,'leaf');addVfx({k:'ring',x:p.x+p.w/2,y:p.y+p.h,c:'#8ff0bf',life:.3,r:16})}
  }
  if(!water&&!K.jump&&p.vy<-170)p.vy=-170;
  const g=water?(dive?380:900):1400,mf=water?(dive?90:170):430;
  p.vy=Math.min(mf,p.vy+g*dt);
  const pb=p.y+p.h;const wasAir=!p.onGround,vyBefore=p.vy;
  moveBody(p,dt,gtP);
  p.prevBottom=pb;
  if(wasAir&&p.onGround&&vyBefore>300)glow(p.x+p.w/2,p.y+p.h,'#e8d6b0',6,60);
  if(Math.abs(p.vx)>10&&p.onGround)p.walk+=dt;
  const ex=R.exits;
  if(!ex.left&&p.x<0){p.x=0;p.vx=0}
  if(!ex.right&&p.x+p.w>VW){p.x=VW-p.w;p.vx=0}
  if(!ex.up&&p.y<-24){p.y=-24;p.vy=Math.max(p.vy,0)}
  if(ex.left&&p.x+p.w/2<0)go('left');
  else if(ex.right&&p.x+p.w/2>VW)go('right');
  else if(ex.up&&p.y+p.h/2<0)go('up');
  else if(p.y>VH){
    if(ex.down)go('down');
    else{const s=R.safe||[2,14];p.x=s[0]*T;p.y=(s[1]+1)*T-p.h;p.vx=p.vy=0;hurtRaw(10);toast('ตกเมฆ! -10 HP','#ff9b9b')}
  }
  if(water&&!dive){
    p.breath-=dt;
    if(p.breath<=0){p.drownT-=dt;if(p.drownT<=0){p.drownT=.7;hurtRaw(10)}
      if(drownMsg<=0){toast('หายใจไม่ออก! ต้องมีภูตน้ำในทีมถึงจะดำน้ำได้','#ff9b9b',3.5);drownMsg=6}}
  }else p.breath=Math.min(5,p.breath+dt*3);
  if(p.inv>0)p.inv-=dt;

  if(pressed('down')&&onPipe()){loadRoom('abyss1');p.x=20*T-p.w/2;p.y=2*T+2;p.vx=p.vy=0;fade=.4;hist=[];toast('ลงท่อสู่เมืองบาดาล…','#7fd0ff');save()}
  if(pressed('up')){
    if(underPipe()){placeAtFountain();p.x=20*T-p.w/2;p.y=12*T-p.h;fade=.4;hist=[];save()}
    else{const o=nearObj();if(o)interact(o)}
  }
  if(pressed('sk1'))useSkill('sk1');
  if(pressed('sk2'))useSkill('sk2');
  if(pressed('ult')){if(ug>=100)startUlt();else info(p.x+p.w/2,p.y-10,`ภูตยังไม่พร้อม ${Math.floor(ug)}%`,'#c9a6ff')}

  if(p.atkCd>0)p.atkCd-=dt;
  if(K.atk&&p.atkCd<=0&&p.atkT<=0){
    p.atkT=.16;p.atkCd=atkCD();p.atkKind=(p.atkKind==='n'?'n2':'n');p.hitSet=new Set();
    const el=atkEl();addVfx({k:'slash',x:p.x+p.w/2+p.dir*8,y:p.y+p.h*.42,dir:p.dir,c:ELC[el],life:.18,s:1,flip:p.atkKind==='n2'});
  }
  if(p.atkT>0){
    p.atkT-=dt;
    if(p.atkKind==='n'||p.atkKind==='n2'){
      const hb={x:p.dir>0?p.x+p.w-2:p.x-28,y:p.y-4,w:30,h:p.h+6};const el=atkEl();
      for(const e of enemies)if(!e.dead&&!p.hitSet.has(e)&&ov(hb,e)){p.hitSet.add(e);hitEnemy(e,rollDamage(atk(),el,e),{el});hitstop(.035)}
      if(!p.hitSet.has('rock')){p.hitSet.add('rock');checkRocks(hb)}
    }
  }

  for(const it of items){if(!it.got&&Math.abs(p.x+p.w/2-it.x)<12&&Math.abs(p.y+p.h/2-it.y)<18){it.got=1;S.items[it.id]=1;S.stones++;toast(`เก็บหินอัญเชิญ (${S.stones}/3)`,'#c9a6ff');glow(it.x,it.y,'#c9a6ff',14,100,'spark');save()}}
  items=items.filter(i=>!i.got);
  for(const d of drops){
    d.t+=dt;if(!d.onGround){d.vy=Math.min(400,d.vy+900*dt);moveBody(d,dt,gtE);if(d.onGround){d.vx=0;glow(d.x+5,d.y+10,'#fff',3,40)}}
    if(R.water&&d.vy>60)d.vy=60;
    if(d.t>.35&&ov({x:p.x-4,y:p.y,w:p.w+8,h:p.h},d)){
      d.got=1;
      if(d.kind==='stone'){S.stones++;toast(`หินอัญเชิญ (${S.stones}/3)`,'#c9a6ff')}
      else if(d.kind==='card'){S.cards[d.id]=(S.cards[d.id]||0)+1;toast(`ได้ ${CARDS[d.id].name}! (${bonusText(CARDS[d.id])}) · เสียบในเมนู > ของสวมใส่`,'#e2d2ff',4);addVfx({k:'pillar',x:d.x+5,y:d.y+10,c:'#c9a6ff',life:.7,w:18});markMenu()}
      else if(!giveItem(d.id))d.got=0;
      if(d.got){glow(d.x+5,d.y+5,d.kind==='card'?'#e2d2ff':'#ffd88a',14,110,'spark');save()}
    }
  }
  drops=drops.filter(d=>!d.got);

  for(const e of enemies){if(!e.dead)updateEnemy(e,dt)}
  for(const e of enemies){
    if(e.dead||p.dead||!ov(p,e))continue;
    if(e.d.stomp&&p.vy>0&&p.prevBottom<=e.y+8){
      hitEnemy(e,rollDamage(Math.max(atk()*1.6,18),'neutral',e),{});
      p.vy=water?-260:(K.jump?-430:-320);p.canDouble=1;glow(p.x+p.w/2,p.y+p.h,'#fff',8,90,'spark');addVfx({k:'ring',x:p.x+p.w/2,y:p.y+p.h,c:'#fff',life:.25,r:18});hitstop(.05);
    }else hurt(e.d.atk,e.x+e.w/2);
  }
  enemies=enemies.filter(e=>!e.dead);
  updatePets(dt);
  for(const s of shots){
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
    if(!s.ghost&&isSolid(gtP(Math.floor(s.x/T),Math.floor(s.y/T))))s.life=0;
    if(!s.hostile&&Math.random()<.5)parts.push({x:s.x,y:s.y,vx:rnd(-10,10),vy:rnd(-10,10),t:.25,t0:.25,c:s.c,s:2,shape:'dot',add:1,g:0,rot:0});
    const box={x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2};
    if(s.hostile){if(ov(box,p)){hurt(s.dmg,s.x);s.life=0}}
    else for(const e of enemies){if(!e.dead&&ov(box,e)){hitEnemy(e,rollDamage(s.dmg,s.el,e,false),{el:s.el,pet:1});s.life=0;break}}
  }
  enemies=enemies.filter(e=>!e.dead);
  shots=shots.filter(s=>s.life>0);
}
function updatePets(dt){
  hist.push({x:p.x+p.w/2,y:p.y});if(hist.length>80)hist.shift();
  pets.forEach((q,i)=>{
    const h=hist[Math.max(0,hist.length-1-(i+1)*12)]||{x:p.x,y:p.y};
    const tx=h.x-p.dir*6,ty=h.y-10+Math.sin(time*4+i)*3;
    q.x+=(tx-q.x)*Math.min(1,dt*8);q.y+=(ty-q.y)*Math.min(1,dt*8);
    if(ult)return;
    q.cd-=dt;
    if(q.cd<=0){
      let best=null,bd=170;
      for(const e of enemies){const d=Math.hypot(e.x+e.w/2-q.x,e.y+e.h/2-q.y);if(d<bd){bd=d;best=e}}
      if(best){const pd=PETS[q.id],a=Math.atan2(best.y+best.h/2-q.y,best.x+best.w/2-q.x),el=pd.el==='holy'?'neutral':pd.el;
        shots.push({x:q.x,y:q.y,vx:Math.cos(a)*260,vy:Math.sin(a)*260,r:3,c:ELC[pd.el],el,dmg:pd.pow+S.lv*1.3+stat('int')*.6,life:1});q.cd=1.3}
      else q.cd=.3;
    }
  });
}
function updateEnemy(e,dt){
  const d=e.d,px=p.x+p.w/2,ex=e.x+e.w/2,dx=px-ex;
  e.ph+=dt;if(e.flash>0)e.flash-=dt;
  if(e.stun>0){e.stun-=dt;if(!d.fly){e.vy=Math.min(400,e.vy+1100*dt);moveBody(e,dt,gtE);e.vx*=Math.pow(.05,dt)}else{e.x+=e.vx*dt*.5;e.vx*=Math.pow(.05,dt)}return}
  if(e.t==='poring'){
    if(e.onGround){e.vx*=Math.pow(.02,dt);e.timer-=dt;
      if(e.timer<=0){e.dir=Math.abs(dx)<170?(Math.sign(dx)||1):(Math.random()<.5?-1:1);e.vx=e.dir*55;e.vy=-240;e.timer=rnd(.8,2)}}
    e.vy=Math.min(400,e.vy+1100*dt);moveBody(e,dt,gtE);
  }else if(e.t==='mantis'||e.t==='scorpion'){
    let sp=32;if(Math.abs(dx)<130&&Math.abs(p.y-e.y)<40){e.dir=Math.sign(dx)||1;sp=e.t==='scorpion'?64:48}
    e.vx=e.dir*sp;e.vy=Math.min(400,e.vy+1100*dt);moveBody(e,dt,gtE);
    if(e.hitWall)e.dir*=-1;
    else if(e.onGround){const fx=e.dir>0?e.x+e.w+1:e.x-1,c=gtE(Math.floor(fx/T),Math.floor((e.y+e.h+2)/T));if(!isSolid(c)&&c!=='-')e.dir*=-1}
  }else if(e.t==='bird'){
    e.x+=e.dir*45*dt;if(Math.abs(e.x-e.ox)>70)e.dir=Math.sign(e.ox-e.x)||1;
    e.x=Math.max(0,Math.min(VW-e.w,e.x));e.y=e.oy+Math.sin(e.ph*3)*14;
  }else if(e.t==='fish'){
    const fx=e.dir>0?e.x+e.w+2:e.x-2;
    if(isSolid(gtE(Math.floor(fx/T),Math.floor((e.y+e.h/2)/T)))||Math.abs(e.x-e.ox)>90)e.dir*=-1;
    if(Math.abs(dx)<110&&Math.abs(p.y-e.y)<50)e.dir=Math.sign(dx)||1;
    e.x+=e.dir*(Math.abs(dx)<110?55:35)*dt;e.y=e.oy+Math.sin(e.ph*2)*8;
  }else if(e.t==='king'){
    const wasAir=!e.onGround;
    if(e.onGround){e.vx*=Math.pow(.01,dt);e.timer-=dt;
      if(e.timer<=0){e.dir=Math.sign(dx)||1;e.vx=e.dir*95;e.vy=-400;e.timer=e.hp<d.hp/2?1.0:1.5;e.jumps++;
        if(e.hp<d.hp/2&&e.jumps%3===0&&enemies.filter(q=>q.t==='poring').length<3)enemies.push(mkEnemy('poring',ex-10,e.y+e.h-16))}}
    e.vy=Math.min(500,e.vy+1100*dt);moveBody(e,dt,gtE);
    if(wasAir&&e.onGround&&e.air>.2){shake=Math.max(shake,.18);glow(ex,e.y+e.h,'#e8d6b0',10,100);addVfx({k:'ring',x:ex,y:e.y+e.h,c:'#ffd6e6',life:.35,r:40})}
    e.air=e.onGround?0:e.air+dt;
  }else if(e.t==='harpy'){
    if(e.st==='hover'){
      const tx=px+Math.sin(e.ph*.8)*80-e.w/2,ty=46+Math.sin(e.ph*2)*8;
      e.x+=Math.sign(tx-e.x)*Math.min(Math.abs(tx-e.x),90*dt);e.y+=Math.sign(ty-e.y)*Math.min(Math.abs(ty-e.y),70*dt);
      e.timer-=dt;e.dir=Math.sign(dx)||1;
      e.shotT=(e.shotT||0)-dt;
      if(e.hp<d.hp/2&&e.shotT<=0){e.shotT=1.5;const a=Math.atan2(p.y+10-(e.y+e.h/2),dx);
        for(const o of[-.25,0,.25])shots.push({x:ex,y:e.y+e.h/2,vx:Math.cos(a+o)*140,vy:Math.sin(a+o)*140,r:3.5,c:'#c9a6ff',hostile:1,dmg:14,life:3,ghost:1})}
      if(e.timer<=0){e.st='dive';const a=Math.atan2(p.y+10-(e.y+e.h/2),dx);e.vx=Math.cos(a)*270;e.vy=Math.sin(a)*270;e.dt=.85}
    }else if(e.st==='dive'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.dt-=dt;if(e.dt<=0||e.y>180)e.st='rise'}
    else{e.y-=130*dt;if(e.y<56){e.st='hover';e.timer=rnd(2,3.2)}}
    e.x=Math.max(0,Math.min(VW-e.w,e.x));e.y=Math.max(8,Math.min(200-e.h,e.y));
  }else if(e.t==='kraken'){
    e.y=e.oy+Math.sin(e.ph*1.2)*10;e.dir=Math.sign(dx)||-1;e.timer-=dt;
    if(e.timer<=0){const a=Math.atan2(p.y+10-(e.y+28),dx);
      for(const o of[-.3,0,.3])shots.push({x:ex,y:e.y+30,vx:Math.cos(a+o)*115,vy:Math.sin(a+o)*115,r:4.5,c:'#2a1838',hostile:1,dmg:d.atk,life:4,ghost:1});
      e.timer=e.hp<d.hp/2?1.4:2.3;
      if(e.hp<d.hp/2&&enemies.filter(q=>q.t==='fish').length<2&&Math.random()<.4)enemies.push(mkEnemy('fish',e.x-10,e.y+40))}
  }
}
