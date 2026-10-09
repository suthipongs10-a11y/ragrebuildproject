/* ---------- input ---------- */
const K={left:0,right:0,up:0,down:0,jump:0,atk:0,sk1:0,sk2:0,ult:0},PK={...K};
const pressed=k=>K[k]&&!PK[k];
const KM={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'jump',KeyZ:'jump',KeyX:'atk',KeyJ:'atk',KeyC:'sk1',KeyK:'sk1',KeyV:'sk2',KeyL:'sk2',KeyF:'ult',KeyB:'ult',Semicolon:'ult'};
addEventListener('keydown',e=>{
  if(e.code==='KeyM'||e.code==='Escape'){toggleMenu();e.preventDefault();return}
  const k=KM[e.code];if(k){K[k]=1;e.preventDefault()}
});
addEventListener('keyup',e=>{const k=KM[e.code];if(k)K[k]=0});
addEventListener('blur',()=>{for(const k in K)K[k]=0});
document.querySelectorAll('.pb').forEach(b=>{
  const k=b.dataset.k;
  const on=e=>{e.preventDefault();K[k]=1;b.classList.add('held');try{b.setPointerCapture(e.pointerId)}catch(_){}};
  const off=()=>{K[k]=0;b.classList.remove('held')};
  b.addEventListener('pointerdown',on);
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>b.addEventListener(ev,off));
  b.addEventListener('contextmenu',e=>e.preventDefault());
});
(()=>{const joy=$('#joy'),knob=$('#knob');let id=null,cx=0,cy=0;
  const set=(dx,dy)=>{const r=46,m=Math.hypot(dx,dy),s=m>r?r/m:1;dx*=s;dy*=s;knob.style.transform=`translate(${dx}px,${dy}px)`;
    const nx=dx/r,ny=dy/r;K.left=nx<-.3?1:0;K.right=nx>.3?1:0;K.up=ny<-.65?1:0;K.down=ny>.65?1:0};
  joy.addEventListener('pointerdown',e=>{e.preventDefault();id=e.pointerId;const r=joy.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;try{joy.setPointerCapture(id)}catch(_){}set(e.clientX-cx,e.clientY-cy)});
  joy.addEventListener('pointermove',e=>{if(e.pointerId===id)set(e.clientX-cx,e.clientY-cy)});
  const end=e=>{if(e.pointerId!==id)return;id=null;knob.style.transform='';K.left=K.right=K.up=K.down=0};
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joy.addEventListener(ev,end));
})();

/* ---------- helpers ---------- */
const rnd=(a,b)=>a+Math.random()*(b-a);
const ov=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function gtP(tx,ty){if(ty<0||ty>=H||tx<0||tx>=W)return '.';return grid[ty][tx]}
function gtE(tx,ty){if(tx<0||tx>=W)return '#';if(ty<0||ty>=H)return '.';return grid[ty][tx]}
function moveBody(e,dt,gt){
  e.hitWall=0;e.x+=e.vx*dt;
  let y0=Math.floor(e.y/T),y1=Math.floor((e.y+e.h-.01)/T);
  if(e.vx>0){const tx=Math.floor((e.x+e.w-.001)/T);for(let ty=y0;ty<=y1;ty++)if(isSolid(gt(tx,ty))){e.x=tx*T-e.w;e.vx=0;e.hitWall=1;break}}
  else if(e.vx<0){const tx=Math.floor(e.x/T);for(let ty=y0;ty<=y1;ty++)if(isSolid(gt(tx,ty))){e.x=(tx+1)*T;e.vx=0;e.hitWall=1;break}}
  const pb=e.y+e.h;e.y+=e.vy*dt;e.onGround=0;
  const x0=Math.floor(e.x/T),x1=Math.floor((e.x+e.w-.01)/T);
  if(e.vy>0){const ty=Math.floor((e.y+e.h-.001)/T);for(let tx=x0;tx<=x1;tx++){const c=gt(tx,ty);if(isSolid(c)||(c==='-'&&pb<=ty*T+.5)){e.y=ty*T-e.h;e.vy=0;e.onGround=1;break}}}
  else if(e.vy<0){const ty=Math.floor(e.y/T);for(let tx=x0;tx<=x1;tx++)if(isSolid(gt(tx,ty))){e.y=(ty+1)*T;e.vy=0;break}}
}
function toast(s,c='#f6ecd8',t=2.8){toasts.push({s,c,t});if(toasts.length>4)toasts.shift()}
/* RO-style floating numbers */
function num(x,y,val,kind){texts.push({x,y,vx:rnd(-28,28),vy:kind==='info'?-30:-150,s:String(val),kind,t:0,life:kind==='info'?1.3:1.05})}
function info(x,y,s,c){texts.push({x,y,vx:0,vy:-30,s,kind:'info',c,t:0,life:1.4})}
function glow(x,y,c,n=10,sp=120,shape='dot',size=[1.5,3.2]){for(let i=0;i<n;i++){const a=Math.random()*6.28,v=rnd(sp*.3,sp);parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,t:rnd(.35,.8),t0:.8,c,s:rnd(size[0],size[1]),shape,rot:Math.random()*6,add:1,g:shape==='ember'?-40:220})}}
const burst=(x,y,c,n,sp)=>glow(x,y,c,n,sp);
function addVfx(o){o.t=0;vfx.push(o);return o}
function hitstop(t){freeze=Math.max(freeze,t)}

function mkEnemy(t,x,y){const d=EN[t];return{t,d,x,y,w:d.w,h:d.h,vx:0,vy:0,hp:d.hp,dir:-1,timer:rnd(.5,1.5),ox:x,oy:y,ph:Math.random()*6,flash:0,onGround:0,st:'hover',jumps:0,air:0,stun:0}}
function loadRoom(id){
  cur=id;R=ROOMS[id];S.seen[id]=1;
  grid=R.map.map(r=>r.slice());
  if(S.broken[id])grid=grid.map(r=>r.map(c=>c==='X'?'.':c));
  enemies=R.enemies.filter(([t])=>!(EN[t].boss&&S.boss[t])).map(([t,c,r])=>{const d=EN[t];return mkEnemy(t,c*T+(T-d.w)/2,d.fly?r*T:(r+1)*T-d.h)});
  items=R.items.map(([k,c,r],i)=>({k,x:c*T+8,y:r*T+8,id:id+':'+i})).filter(it=>!S.items[it.id]);
  objs=R.objs||[];shots=[];drops=[];dying=[];vfx=[];banner=1.8;
}
function syncPets(){pets=S.team.map((id,i)=>pets.find(q=>q.id===id)||{id,x:p.x,y:p.y-12,cd:.6+i*.35})}
function go(dir){
  loadRoom(R.exits[dir]);
  if(dir==='left')p.x=VW-p.w-1;
  if(dir==='right')p.x=1;
  if(dir==='up'){p.y=VH-p.h-1;p.vy=Math.min(p.vy,-420)}
  if(dir==='down'){p.y=-p.h+2}
  fade=.25;hist=[];save();
}
function placeAtFountain(){loadRoom('town');p.x=2*T;p.y=15*T-p.h;p.vx=p.vy=0}

/* ---------- progression ---------- */
function gainExp(n){S.exp+=n;let up=0;while(S.exp>=need()){S.exp-=need();S.lv++;S.stPts+=3;S.skPts+=1;up=1}
  if(up){S.hp=maxHP();S.sp=maxSP();toast(`เลเวลอัป! Lv ${S.lv} · ได้แต้มสเตตัส +3 · แต้มสกิล +1 (กดเมนู)`,'#ffd88a',4);
    addVfx({k:'pillar',x:p.x+p.w/2,y:p.y+p.h,c:'#ffd88a',life:1.1,w:30});glow(p.x+p.w/2,p.y+p.h/2,'#ffe2a0',26,160,'spark');markMenu()}}
function gainPet(id){
  if(S.owned.includes(id))return;
  S.owned.push(id);let m=`ได้ภูตใหม่: ${PETS[id].name} — ${PETS[id].desc}`;
  if(S.team.length<3)S.team.push(id);else m+=' (จัดทีมในเมนู)';
  toast(m,'#ffb347',4.5);syncPets();markMenu();save();
}
function dropItem(x,y,kind,id){drops.push({x,y,vx:rnd(-50,50),vy:-200,w:10,h:10,kind,id,t:0,onGround:0})}
function giveItem(id){if(S.inv.length>=40){toast('กระเป๋าเต็ม (40 ชิ้น)','#ff9b9b');return false}const it=mkItem(id);S.inv.push(it);const b=ITEMS[id];toast(`ได้ ${b.n}!`,b.rare?'#ffd88a':'#f6ecd8');markMenu();return true}

/* ---------- combat ---------- */
function rollDamage(base,el,e,canCrit=true){
  const m=elMult(el,e.d.el);let dmg=base*rnd(.92,1.08)*(1+Math.min(.1,stat('dex')*.004));
  let crit=canCrit&&Math.random()*100<critRate();
  if(crit)dmg*=1.6*Math.max(1,m);else dmg*=m;
  return{dmg:Math.max(1,Math.round(dmg)),crit,m};
}
function hitEnemy(e,r,opt={}){
  if(e.dead)return;
  e.hp-=r.dmg;e.flash=.14;
  const cx=e.x+e.w/2,cy=e.y+e.h*.35;
  num(cx,cy-6,r.dmg,r.crit?'crit':r.m>1?'weak':r.m<1?'resist':'dmg');
  if(r.crit){addVfx({k:'crit',x:cx,y:cy-6,life:.32});hitstop(.07);shake=Math.max(shake,.14)}
  addVfx({k:'spark',x:cx+rnd(-4,4),y:e.y+e.h*.5+rnd(-4,4),c:ELC[opt.el||'neutral'],life:.2,s:r.crit?1.5:1});
  if(opt.el&&opt.el!=='neutral')glow(cx,e.y+e.h/2,ELC[opt.el],7,110,opt.el==='fire'?'ember':opt.el==='wind'?'leaf':opt.el==='water'?'drop':'dot');
  if(!e.d.boss){e.vx=(cx<p.x+p.w/2?-1:1)*(opt.kb||70);if(opt.kb)e.vy=-160;e.stun=opt.kb?.35:.12}
  if(!opt.pet)ug=Math.min(100,ug+(opt.skill?8:4)+(r.crit?5:0));else ug=Math.min(100,ug+1.5);
  if(opt.skill)lastSkillHit=time;
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  const d=e.d;e.dead=1;e.dieT=0;dying.push(e);
  const cx=e.x+e.w/2,cy=e.y+e.h/2;
  glow(cx,cy,d.boss?'#ffd88a':'#fff2cc',d.boss?46:16,d.boss?240:140,'spark');
  addVfx({k:'ring',x:cx,y:cy,c:d.boss?'#ffd88a':'#fff',life:.4,r:d.boss?80:30});
  if(d.boss){hitstop(.18);flash=.35;flashC='#fff3d0';shake=.4}
  gainExp(d.exp);const z=Math.round(rnd(d.z[0],d.z[1]));S.zeny+=z;info(cx,e.y-14,`+${z}z`,'#ffd88a');
  const lk=1+stat('luk')*.03;
  if(d.boss){S.boss[e.t]=1;for(let i=0;i<2;i++)dropItem(cx,cy,'stone');toast(`ล้ม${d.name}!`,'#ffd88a')}
  else if(Math.random()<.22*lk)dropItem(cx,cy,'stone');
  if(d.boss||Math.random()<d.card*lk)dropItem(cx,cy,'card',e.t);
  for(const[id,ch]of d.drops||[])if(Math.random()<ch*(d.boss?1:lk))dropItem(cx,cy,'item',id);
  if(d.pet)gainPet(d.pet);
  if(d.mvp){S.won=1;winT=2}
  save();
}
function hurt(dmg,srcX){
  if(p.inv>0||p.dead||ult)return;
  dmg=Math.max(1,Math.round(dmg*rnd(.9,1.1)-def()*.6));S.hp-=dmg;p.inv=1;
  p.vx=(p.x+p.w/2<srcX?-1:1)*160;p.vy=R.water?-120:-220;
  num(p.x+p.w/2,p.y-6,dmg,'hurt');shake=Math.max(shake,.15);hitstop(.05);
  if(S.hp<=0)die();
}
function hurtRaw(n){if(p.dead)return;S.hp-=n;num(p.x+p.w/2,p.y-6,n,'hurt');if(S.hp<=0)die()}
function die(){S.hp=0;p.dead=1;deadT=1.8;glow(p.x+p.w/2,p.y+p.h/2,'#ff6b6b',24,180)}
function respawn(){
  p.dead=0;S.hp=maxHP();S.sp=maxSP();const lost=Math.floor(S.zeny*.1);S.zeny-=lost;
  placeAtFountain();p.inv=1.2;p.breath=5;fade=.5;syncPets();hist=[];
  toast(`ฟื้นที่น้ำพุเมืองกลาง (เสีย ${lost}z)`,'#ff9b9b');save();
}

/* skills */
function useSkill(slot){
  const id=slot==='sk1'?'slash':'burst',sk=SKILLS[id],lv=S.sk[id];
  if(!lv){toast(`ยังไม่ได้เรียน ${sk.n} — อัปในเมนู > สกิล`,'#ff9b9b');markMenu();return}
  if(cds[slot]>0)return;
  const cost=sk.sp(lv);if(S.sp<cost){info(p.x+p.w/2,p.y-10,'SP ไม่พอ','#7fb6ff');return}
  S.sp-=cost;cds[slot]=sk.cd;
  const intM=1+stat('int')*.012,el=atkEl();
  if(id==='slash'){
    p.atkT=.2;p.atkKind='heavy';p.atkCd=.3;
    const hb={x:p.dir>0?p.x+p.w-4:p.x-40,y:p.y-10,w:44,h:p.h+14};
    addVfx({k:'slash',x:p.x+p.w/2+p.dir*10,y:p.y+p.h*.45,dir:p.dir,c:ELC[el],life:.28,s:1.7,heavy:1});
    let hit=0;for(const e of enemies)if(!e.dead&&ov(hb,e)){hit=1;hitEnemy(e,rollDamage(atk()*(2+.4*lv)*intM,el,e),{el,kb:220,skill:1})}
    if(hit){hitstop(.11);shake=Math.max(shake,.22)}
    checkRocks(hb);
  }else{
    const r=46+lv*5,cx=p.x+p.w/2,cy=p.y+p.h/2;
    p.atkT=.18;p.atkKind='slam';
    addVfx({k:'firering',x:cx,y:p.y+p.h,life:.55,r});addVfx({k:'ring',x:cx,y:cy,c:'#ffb36b',life:.4,r:r+10});
    glow(cx,p.y+p.h,'#ff9a3d',30,200,'ember');shake=Math.max(shake,.25);
    let hit=0;for(const e of enemies){if(e.dead)continue;const d=Math.hypot(e.x+e.w/2-cx,e.y+e.h/2-cy);if(d<r+e.w/2){hit=1;hitEnemy(e,rollDamage(atk()*(1.4+.3*lv)*intM,'fire',e),{el:'fire',kb:180,skill:1})}}
    if(hit)hitstop(.09);
  }
}
/* spirit ultimate */
function startUlt(){
  if(ug<100||ult||p.dead)return;
  const id=leader();ug=0;
  const combo=time-lastSkillHit<2.5;
  ult={id,t:0,hits:0,combo,next:.45};
  flash=.25;flashC=ELC[PETS[id].el]||'#fff';hitstop(.05);
  if(combo)toast('COMBO! สกิล + ภูต ดาเมจ ×1.3','#ffd88a',2);
}
function ultHit(){
  const id=ult.id,pd=PETS[id];
  const base=(pd.pow*4+S.lv*3+stat('int')*3+atk()*.45)*(ult.combo?1.3:1);
  const el=pd.el==='holy'?'neutral':pd.el;
  for(const e of enemies){if(e.dead)continue;const r=rollDamage(base,el,e);hitEnemy(e,r,{el,pet:1});
    const cx=e.x+e.w/2;
    if(id==='wind')addVfx({k:'tornado',x:cx,y:e.y+e.h+4,life:.5});
    if(id==='fire')addVfx({k:'meteor',x:cx+40,y:-20,tx:cx,ty:e.y+e.h/2,life:.35});
    if(id==='angel')addVfx({k:'pillar',x:cx,y:e.y+e.h,c:'#fff3c0',life:.5,w:26});
    if(id==='buddy')addVfx({k:'ring',x:cx,y:e.y+e.h,c:'#ff9cc4',life:.35,r:40});
  }
  if(id==='water'&&ult.hits===0)addVfx({k:'wave',life:1.0});
  if(id==='angel'){const h=Math.round(maxHP()*.1);S.hp=Math.min(maxHP(),S.hp+h);num(p.x+p.w/2,p.y-8,h,'heal')}
  shake=Math.max(shake,.16);ult.hits++;
}
function checkRocks(hb){
  const x0=Math.floor(hb.x/T),x1=Math.floor((hb.x+hb.w)/T),y0=Math.floor(hb.y/T),y1=Math.floor((hb.y+hb.h)/T);
  let rock=0;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(gtP(x,y)==='X')rock=1;
  if(!rock)return;
  if(has('break'))breakRocks();
  else{glow(p.dir>0?hb.x+hb.w:hb.x,p.y+10,'#ccc',5,80);if(rockMsgT<=0){toast('หินแข็งเกินไป! ต้องมีภูตไฟในทีม','#ff9b9b');rockMsgT=3}}
}
function breakRocks(){
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(grid[y][x]==='X'){grid[y][x]='.';glow(x*T+8,y*T+8,'#ffb36b',4,160,'ember')}
  S.broken[cur]=1;shake=.4;hitstop(.12);toast('ภูตไฟทุบหินยักษ์! ทางไปทะเลทรายเปิดแล้ว →','#ff8a3d');save();
}

/* ---------- interactions ---------- */
function nearObj(){const cx=p.x+p.w/2,cy=p.y+p.h;for(const o of objs){const ox=o.x*T+8,oy=(o.y+1)*T;if(Math.abs(cx-ox)<18&&Math.abs(cy-oy)<20)return o}return null}
function onPipe(){if(cur!=='town'||!p.onGround)return false;return gtP(Math.floor((p.x+p.w/2)/T),Math.floor((p.y+p.h+1)/T))==='T'}
function underPipe(){return cur==='abyss1'&&p.x+p.w/2>19*T&&p.x+p.w/2<21*T&&p.y<2*T+10}
function promptFor(o){
  if(!o)return null;
  if(o.k==='fountain')return '▲ พักฟื้น HP/SP';
  if(o.k==='anvil'){const w=weapon();if(!w)return 'ไม่มีอาวุธ';return w.ref>=10?'อาวุธ +10 สูงสุดแล้ว':`▲ ตีบวก ${ITEMS[w.id].n} +${w.ref}→+${w.ref+1} · ${50*(w.ref+1)}z · ${Math.round(RCH[w.ref]*100)}%`}
  if(o.k==='altar')return `▲ อัญเชิญภูต (หิน ${S.stones}/3)`;
  if(o.k==='chest')return S.chest[cur]?'หีบว่างแล้ว':'▲ เปิดหีบ';
  return null;
}
function interact(o){
  if(o.k==='fountain'){S.hp=maxHP();S.sp=maxSP();toast('ฟื้นฟูเต็ม · บันทึกเกมแล้ว','#8fd08a');glow(o.x*T+8,o.y*T,'#bfe9ff',16,90);save()}
  if(o.k==='anvil'){
    const w=weapon();if(!w)return;if(w.ref>=10)return toast('ตีบวกสูงสุดแล้ว');
    const cost=50*(w.ref+1);if(S.zeny<cost)return toast(`เงินไม่พอ ต้องใช้ ${cost}z`,'#ff9b9b');
    S.zeny-=cost;const ox=o.x*T+8,oy=o.y*T+4;
    if(Math.random()<RCH[w.ref]){w.ref++;toast(`ตีบวกสำเร็จ! ${ITEMS[w.id].n} +${w.ref} (ATK ${atk()})`,'#8fd08a');glow(ox,oy,'#ffd88a',22,160,'spark');addVfx({k:'ring',x:ox,y:oy,c:'#ffd88a',life:.4,r:30});hitstop(.08)}
    else if(w.ref>=5){w.ref--;toast(`ตีบวกล้มเหลว... ลดเหลือ +${w.ref}`,'#ff6b6b');glow(ox,oy,'#888',14,120);shake=.2}
    else toast('ตีบวกล้มเหลว','#ff6b6b');
    save();
  }
  if(o.k==='altar'){
    const pool=['fire','angel'].filter(id=>!S.owned.includes(id));
    if(!pool.length)return toast('อัญเชิญภูตในเดโมครบทุกตัวแล้ว');
    if(S.stones<3)return toast(`หินอัญเชิญไม่พอ (${S.stones}/3) — ตีมอนหรือเก็บตามแมพ`,'#ff9b9b');
    S.stones-=3;addVfx({k:'circle',x:o.x*T+8,y:o.y*T-6,life:1.2,r:28,c:'#c9a6ff'});glow(o.x*T+8,o.y*T,'#c9a6ff',30,180,'spark');shake=.25;flash=.2;flashC='#e2d2ff';
    gainPet(pool[Math.floor(Math.random()*pool.length)]);
  }
  if(o.k==='chest'&&!S.chest[cur]){S.chest[cur]=1;S.zeny+=150;dropItem(o.x*T+8,o.y*T,'stone');dropItem(o.x*T+8,o.y*T,'stone');dropItem(o.x*T+8,o.y*T,'item','n_luck');toast('เปิดหีบ! +150z · ปิรามิดรออยู่ในเกมเต็ม','#ffd88a',4);glow(o.x*T+8,o.y*T+6,'#ffd88a',20,140,'spark');save()}
}
