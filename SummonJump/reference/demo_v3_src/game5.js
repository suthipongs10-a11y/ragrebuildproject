/* ---------- menu ---------- */
const over=$('#over');let tab='stat',pickSlot=null,resetArm=0;
function markMenu(){$('#menuBtn').classList.add('alert')}
function hasAlerts(){return{stat:S.stPts>0,skill:S.skPts>0}}
function showStart(){
  paused=true;over.hidden=false;
  over.innerHTML=`<div class="card">
    <h2>Summon Jump v3</h2>
    <p>นักดาบผู้มีภูตเป็นเพื่อนร่วมทาง เดินอิสระทุกทิศ ล้มบอสเพื่อได้ภูต ใช้พลังภูตเปิดทางใหม่</p>
    <ul class="quest">
      <li><i>1</i>เลเวลอัปแล้วแจกแต้มสเตตัสและสกิลในเมนู (ปุ่มเมนูมีจุดแดง = มีแต้มให้แจก)</li>
      <li><i>2</i>ตีศัตรูจนเกจภูตเต็ม แล้วกดปุ่ม "ภูต" ปล่อยท่าพิเศษ · ใช้สกิลก่อนแล้วตามด้วยท่าภูต = COMBO</li>
      <li><i>3</i>มอนดรอปอาวุธ เกราะ การ์ด เดินไปเก็บ แล้วสวมใส่หรือเสียบการ์ดในเมนู</li>
    </ul>
    <p class="note">ภูตตัวแรกในทีม (มีมงกุฎ) คือหัวหน้า ดาบจะติดธาตุของหัวหน้า · เล่นแนวนอนจะง่ายที่สุด</p>
    <div class="row"><button class="btn primary" id="go" ${artReady?'':'disabled'}>${artReady?(S.started?'เล่นต่อ':'เริ่มเล่น'):'กำลังโหลดภาพ…'}</button></div>
  </div>`;
  $('#go').onclick=()=>{S.started=1;save();over.hidden=true;paused=false};
}
function openMenu(){paused=true;over.hidden=false;pickSlot=null;renderMenu();$('#menuBtn').classList.remove('alert')}
function closeMenu(){over.hidden=true;paused=false;for(const k in K)K[k]=0}
function toggleMenu(){if(over.hidden)openMenu();else if(S.started)closeMenu()}
$('#menuBtn').onclick=()=>toggleMenu();
function itemDesc(it){const b=ITEMS[it.id];const parts=[];if(b.atk)parts.push(`ATK ${b.atk}${it.ref?` (+${refBonus(it.ref)})`:''}`);if(b.el)parts.push(`ธาตุ${ELN[b.el]}`);const bt=bonusText(Object.assign({},b,{atk:0}));if(bt)parts.push(bt);return parts.join(' · ')}
function renderMenu(){
  const al=hasAlerts();
  const tabs=[['stat','สถานะ',al.stat],['skill','สกิล',al.skill],['equip','ของสวมใส่'],['pets','ภูต'],['map','แผนที่']];
  let body='';
  if(tab==='stat'){
    body=`<div class="row between"><h3>แจกแต้มสเตตัส</h3><span class="pts">เหลือ ${S.stPts} แต้ม</span></div>
    <div class="grid2">${STATS.map(([k,n,d])=>`<div class="stat"><div class="nm">${n}<small>${d}</small></div><b>${S.st[k]}${bonus(k)?`<small style="font-size:11px;color:var(--good)">+${bonus(k)}</small>`:''}</b><button class="plus" data-st="${k}" ${S.stPts?'':'disabled'} aria-label="เพิ่ม ${n}">+</button></div>`).join('')}</div>
    <h3>ค่าพลัง</h3>
    <div class="kv"><div><span>เลเวล</span><b>${S.lv}</b></div><div><span>อาชีพ</span><b>นักดาบ</b></div><div><span>ATK</span><b>${atk()}</b></div><div><span>DEF</span><b>${def()}</b></div><div><span>HP</span><b>${Math.ceil(S.hp)}/${maxHP()}</b></div><div><span>SP</span><b>${Math.floor(S.sp)}/${maxSP()}</b></div><div><span>คริติคอล</span><b>${critRate().toFixed(1)}%</b></div><div><span>ความเร็วฟัน</span><b>${(1/atkCD()).toFixed(1)}/วิ</b></div><div><span>ธาตุดาบ</span><b>${ELN[atkEl()]}</b></div><div><span>เงิน</span><b>${S.zeny}z</b></div></div>`;
  }else if(tab==='skill'){
    body=`<div class="row between"><h3>สกิลนักดาบ</h3><span class="pts">เหลือ ${S.skPts} แต้ม</span></div>
    ${Object.entries(SKILLS).map(([id,s])=>{const lv=S.sk[id],can=S.skPts>0&&lv<s.max&&(!s.req||S.lv>=s.req);
      const ic=IMG['v3_'+s.icon];
      return `<div class="item"><div class="ic">${okImg(ic)?`<img src="${ic.src}" alt="">`:`<img src="${imgSrc(id==='burst'?'ic_e_fire':'ic_sword')}" alt="">`}</div><div class="bd"><b>${s.n} <span class="note">Lv ${lv}/${s.max}${s.passive?' · ติดตัว':id==='slash'?' · ปุ่มสกิล 1 (C)':' · ปุ่มสกิล 2 (V)'}</span></b><small>${s.desc(Math.max(1,lv))}${s.sp?` · ใช้ SP ${s.sp(Math.max(1,lv))} · คูลดาวน์ ${s.cd} วิ`:''}${s.req&&S.lv<s.req?` · ต้อง Lv ${s.req}`:''}</small></div><button class="plus" data-sk="${id}" ${can?'':'disabled'} aria-label="อัป ${s.n}">+</button></div>`}).join('')}
    <p class="note">ท่าภูต: ตีศัตรูจนเกจเต็มแล้วกดปุ่ม "ภูต" (F) · ใช้สกิลก่อนแล้วตามด้วยท่าภูตภายใน 2.5 วิ = COMBO ดาเมจ ×1.3</p>`;
  }else if(tab==='equip'){
    const slotName={wpn:'อาวุธ',arm:'ชุดเกราะ',acc1:'เครื่องประดับ 1',acc2:'เครื่องประดับ 2'};
    const eqRow=k=>{const it=S.eq[k]&&itemBy(S.eq[k]);if(!it)return `<div class="item"><div class="ic"></div><div class="bd"><b class="note">${slotName[k]}: ว่าง</b></div></div>`;
      const b=ITEMS[it.id];
      return `<div class="item eq"><div class="ic"><img src="${itemIcon(it.id)}" alt=""></div><div class="bd"><b>${slotName[k]}: ${b.n}${it.ref?` +${it.ref}`:''}</b><small>${itemDesc(it)}</small>
        <div class="slots">${it.cards.map((c,i)=>c?`<span class="slot full">${CARDS[c].name}</span>`:`<button class="slot" data-pick="${it.u}:${i}">+ เสียบการ์ด</button>`).join('')||'<span class="note" style="font-size:12px">ไม่มีช่องการ์ด</span>'}</div></div>
        ${k!=='wpn'&&k!=='arm'?`<button class="btn sm" data-uneq="${k}">ถอด</button>`:''}</div>`};
    let pick='';
    if(pickSlot){const cs=Object.entries(S.cards).filter(([,n])=>n>0);
      pick=`<div class="item" style="border-color:#c9a6ff"><div class="bd"><b>เลือกการ์ดที่จะเสียบ (เสียบแล้วถอดไม่ได้)</b>
        <div class="chips">${cs.length?cs.map(([id,n])=>`<button class="chip" data-card="${id}"><img src="${cardIcon(id)}" alt=""><span><b>${CARDS[id].name} ×${n}</b><small>${bonusText(CARDS[id])}</small></span></button>`).join(''):'<span class="note">ยังไม่มีการ์ด — มอนทุกตัวมีโอกาสดรอป บอสดรอปแน่นอน</span>'}</div>
        <div class="row"><button class="btn sm" data-cancel="1">ยกเลิก</button></div></div></div>`}
    const eqd=new Set(Object.values(S.eq));
    const bag=S.inv.filter(i=>!eqd.has(i.u));
    body=`${pick}<h3>กำลังสวมใส่</h3>${['wpn','arm','acc1','acc2'].map(eqRow).join('')}
      <h3>กระเป๋า (${bag.length})</h3>
      ${bag.length?bag.map(it=>{const b=ITEMS[it.id];return `<div class="item"><div class="ic"><img src="${itemIcon(it.id)}" alt=""></div><div class="bd"><b>${b.n}${it.ref?` +${it.ref}`:''}${b.rare?`<span class="tag">${b.rare>1?'MVP':'หายาก'}</span>`:''}</b><small>${itemDesc(it)} · ช่องการ์ด ${it.cards.length} (${it.cards.filter(Boolean).length} ใช้แล้ว)</small></div><div class="row" style="flex-direction:column;gap:4px"><button class="btn sm" data-eq="${it.u}">สวมใส่</button><button class="btn sm warn" data-sell="${it.u}">ขาย</button></div></div>`}).join(''):'<p class="note">ยังไม่มีของในกระเป๋า — มอนจะดรอปของ เดินไปเก็บได้เลย</p>'}
      <p class="note">การ์ดที่ยังไม่ได้เสียบ: ${Object.entries(S.cards).filter(([,n])=>n>0).map(([id,n])=>`${CARDS[id].name} ×${n}`).join(', ')||'ไม่มี'} · ตีบวกอาวุธที่ทั่งในเมืองกลาง</p>`;
  }else if(tab==='pets'){
    body=`<h3>ทีมภูต (3 ตัว · ตัวแรก = หัวหน้า)</h3>
    <div class="chips">${S.owned.map(id=>{const d=PETS[id],inT=S.team.includes(id),isL=leader()===id;return `<div class="chip ${inT?'on':''}"><img src="${imgSrc('spr_'+id)}" alt=""><span style="flex:1;min-width:0"><b>${d.name}${isL?'<span class="tag">หัวหน้า</span>':inT?'<span class="tag" style="background:var(--panel);color:var(--ink)">ในทีม</span>':''}</b><small>ธาตุ${ELN[d.el]} · ${d.desc}</small><small>${d.lead}</small><small>ท่าพิเศษ: ${d.ult}</small>
      <span class="row" style="margin-top:4px">${inT&&!isL?`<button class="btn sm" data-lead="${id}">ตั้งเป็นหัวหน้า</button>`:''}${inT?(S.team.length>1?`<button class="btn sm" data-out="${id}">เอาออก</button>`:''):`<button class="btn sm" data-in="${id}">ใส่ทีม</button>`}</span></span></div>`}).join('')}</div>
    <p class="note" id="teamMsg">ธาตุ: น้ำ ชนะ ไฟ → ไฟ ชนะ ดิน → ดิน ชนะ ลม → ลม ชนะ น้ำ (แรงขึ้น ×1.5) · พลังเปิดทาง (กระโดด 2 ชั้น / ดำน้ำ / ทุบหิน) ใช้ได้ถ้าภูตอยู่ในทีม</p>`;
  }else{
    const cells=[];for(let r=0;r<3;r++)for(let c=0;c<4;c++){const id=Object.keys(MAPPOS).find(k=>MAPPOS[k][0]===c&&MAPPOS[k][1]===r);
      cells.push(id?`<div class="cell ${id===cur?'here':S.seen[id]?'seen':''}">${S.seen[id]?ROOMS[id].name:'?'}</div>`:'<div class="cell void"></div>')}
    const q=[[S.boss.king,'ป่าลึก (ซ้ายสุด): ล้มราชาโพริง → ภูตลม + ดาบราชันย์'],[S.boss.harpy,'เมืองฟ้า (ปีนขึ้นจากเมือง): ล้มฮาร์ปี้ → ภูตน้ำ'],[S.boss.kraken,'เมืองบาดาล (ลงท่อ): ล้ม MVP คราเคน'],[S.broken.town,'เสริม: หิน 3 ก้อน → อัญเชิญภูตไฟ → ทุบหินไปทะเลทราย']];
    body=`<h3>เป้าหมาย</h3><ul class="quest">${q.map(([d,t])=>`<li class="${d?'done':''}"><i>${d?'✓':'○'}</i>${t}</li>`).join('')}</ul><h3>แผนที่</h3><div class="map">${cells.join('')}</div>
    <div class="row"><button class="btn warn sm" id="reset">เริ่มใหม่ทั้งหมด</button></div>`;
  }
  over.innerHTML=`<div class="card"><div class="row between"><h2>เมนู</h2><button class="btn primary" id="close">กลับไปเล่น</button></div>
    <div class="tabs">${tabs.map(([k,n,a])=>`<button class="tab ${tab===k?'on':''}" data-tab="${k}">${n}${a?'<span class="dot"></span>':''}</button>`).join('')}</div>${body}</div>`;
  $('#close').onclick=closeMenu;
  over.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;pickSlot=null;renderMenu()});
  over.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{if(S.stPts>0){S.st[b.dataset.st]++;S.stPts--;save();renderMenu()}});
  over.querySelectorAll('[data-sk]').forEach(b=>b.onclick=()=>{const id=b.dataset.sk;if(S.skPts>0&&S.sk[id]<SKILLS[id].max){S.sk[id]++;S.skPts--;save();renderMenu()}});
  over.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{pickSlot=b.dataset.pick;renderMenu()});
  over.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{pickSlot=null;renderMenu()});
  over.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{const[u,i]=pickSlot.split(':');const it=itemBy(u);const c=b.dataset.card;if(it&&!it.cards[+i]&&S.cards[c]>0){it.cards[+i]=c;S.cards[c]--;pickSlot=null;save();renderMenu()}});
  over.querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>{const it=itemBy(b.dataset.eq);const t=ITEMS[it.id].t;let slot=t==='acc'?(!S.eq.acc1?'acc1':!S.eq.acc2?'acc2':'acc1'):t;S.eq[slot]=it.u;S.hp=Math.min(S.hp,maxHP());save();renderMenu()});
  over.querySelectorAll('[data-uneq]').forEach(b=>b.onclick=()=>{S.eq[b.dataset.uneq]=null;S.hp=Math.min(S.hp,maxHP());save();renderMenu()});
  over.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{const u=b.dataset.sell;if(b.dataset.arm!=='1'){b.dataset.arm='1';b.textContent='ยืนยันขาย';return}const it=itemBy(u);const price=Math.round((ITEMS[it.id].atk||ITEMS[it.id].def||10)*6+it.ref*40);S.inv=S.inv.filter(i=>i.u!==u);S.zeny+=price;toast(`ขายได้ ${price}z`,'#ffd88a');save();renderMenu()});
  over.querySelectorAll('[data-lead]').forEach(b=>b.onclick=()=>{const id=b.dataset.lead;S.team=[id,...S.team.filter(x=>x!==id)];syncPets();updateUltIcon();save();renderMenu()});
  over.querySelectorAll('[data-out]').forEach(b=>b.onclick=()=>{S.team=S.team.filter(x=>x!==b.dataset.out);syncPets();updateUltIcon();save();renderMenu()});
  over.querySelectorAll('[data-in]').forEach(b=>b.onclick=()=>{if(S.team.length>=3){$('#teamMsg').textContent='ทีมเต็ม 3 ตัวแล้ว — เอาตัวอื่นออกก่อน';return}S.team.push(b.dataset.in);syncPets();updateUltIcon();save();renderMenu()});
  const rs=$('#reset');if(rs)rs.onclick=()=>{if(!resetArm){resetArm=1;rs.textContent='แตะอีกครั้งเพื่อลบเซฟ';setTimeout(()=>{resetArm=0},3000);return}
    resetArm=0;S=fresh();pets=[];ug=0;placeAtFountain();syncPets();updateUltIcon();save();showStart()};
}
function showWin(){
  paused=true;over.hidden=false;
  over.innerHTML=`<div class="card"><h2>ล้ม MVP คราเคนแล้ว!</h2>
    <p>จบเดโม: Lv ${S.lv} · ATK ${atk()} · ภูต ${S.owned.length}/5 ตัว · ของในกระเป๋า ${S.inv.length} ชิ้น</p>
    <p class="note">ในเกมเต็ม: อาชีพ 2, รูน 6 ช่องของภูต, ตีบวกดาวภูต, ปิรามิดในทะเลทราย, บอส MVP เกิดตามเวลา</p>
    <div class="row"><button class="btn primary" id="go">เล่นต่อในโลกนี้</button></div></div>`;
  $('#go').onclick=closeMenu;
}

/* ---------- touch button state ---------- */
const bs1=$('#b_sk1'),bs2=$('#b_sk2'),bu=$('#b_ult');
const padEl=$('#pad');
function updateButtons(){
  padEl.style.visibility=over.hidden?'visible':'hidden';
  [[bs1,'sk1','slash'],[bs2,'sk2','burst']].forEach(([b,s,id])=>{const sk=SKILLS[id],lv=S.sk[id];
    b.style.setProperty('--cd',lv?Math.max(0,cds[s]/sk.cd).toFixed(3):1);b.classList.toggle('nosp',!lv||S.sp<sk.sp(lv))});
  bu.style.setProperty('--g',(ug/100).toFixed(3));bu.classList.toggle('ready',ug>=100);
}

/* ---------- loop ---------- */
let last=performance.now(),btnT=0;
function frame(now){
  const dt=Math.min(1/30,(now-last)/1000);last=now;
  if(!paused)update(dt);else updateFx(0);
  for(const k in K)PK[k]=K[k];
  draw();
  btnT+=dt;if(btnT>.1){btnT=0;updateButtons()}
  requestAnimationFrame(frame);
}
function start(data){
  const loaded=(data&&data.S)||loadSave();
  if(loaded)S=Object.assign(fresh(),loaded);
  S.hp=Math.min(Math.max(1,S.hp),maxHP());S.sp=Math.min(S.sp,maxSP());
  if(data&&data.cur&&ROOMS[data.cur]){loadRoom(data.cur);p.x=data.px;p.y=data.py;if(data.ug!=null)ug=data.ug}else placeAtFountain();
  syncPets();
  if(S.stPts>0||S.skPts>0)markMenu();
  loadArt().then(()=>{const g=document.getElementById('go');if(g&&g.disabled){g.disabled=false;g.textContent=S.started?'เล่นต่อ':'เริ่มเล่น'}});
  if(data&&data.cur&&S.started){over.hidden=true;paused=false}else showStart();
  requestAnimationFrame(frame);
}
try{window.claude?.hot?.snapshot?.(()=>({S,cur,px:p.x,py:p.y,ug}))}catch(e){}
const hot=window.claude?.hot;
hot?.ready?hot.ready(start):start(hot?.data??{});
if(document.fonts&&document.fonts.load){document.fonts.load('10px Itim');document.fonts.load("700 10px 'Pixelify Sans'")}
})();
