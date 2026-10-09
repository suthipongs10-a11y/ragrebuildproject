(()=>{
const $=s=>document.querySelector(s);
const cv=$('#game'),ctx=cv.getContext('2d');
cv.width=960;cv.height=544;
const KEY='summonjump-v2',OLDKEY='summonjump-v1';
const T=16,W=30,H=17,VW=480,VH=272;
const isSolid=c=>'#=PTXUc'.includes(c);
const FT=n=>`${n}px Itim, system-ui, sans-serif`;
const FP=n=>`700 ${n}px 'Pixelify Sans', Itim, monospace`;

/* ---------- world ---------- */
function mk(fn){const g=[];for(let y=0;y<H;y++)g.push(Array(W).fill('.'));fn((x1,y1,x2,y2,c)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)g[y][x]=c});return g}
const ROOMS={
  town:{name:'เมืองกลาง',theme:'town',exits:{left:'forest',right:'desert',up:'sky1'},
    map:mk(f=>{f(0,15,29,16,'#');f(3,12,7,12,'-');f(8,9,12,9,'-');f(3,6,7,6,'-');f(19,12,20,12,'T');f(19,13,20,14,'P');f(28,4,29,14,'X')}),
    objs:[{k:'fountain',x:1,y:14},{k:'sign',x:5,y:14,text:'ทางขึ้นเมืองฟ้า: ปีนแท่นไม้ขึ้นไป แล้วกระโดด 2 ชั้น (ต้องมีภูตลมในทีม)'},{k:'anvil',x:10,y:14},{k:'altar',x:14,y:14},{k:'sign',x:17,y:14,text:'ท่อลงเมืองบาดาล: ยืนบนท่อแล้วกด ▼ (ต้องมีภูตน้ำถึงจะหายใจใต้น้ำได้)'},{k:'sign',x:25,y:14,text:'หินยักษ์ขวางทางทะเลทราย... ใส่ภูตไฟในทีมแล้วฟันหิน'}],
    enemies:[],items:[]},
  forest:{name:'ป่าโพริง',theme:'forest',exits:{left:'deep',right:'town'},
    map:mk(f=>{f(0,15,29,16,'#');f(4,12,7,12,'-');f(10,9,14,9,'-');f(22,12,25,12,'-');f(17,13,18,14,'#')}),
    objs:[{k:'sign',x:2,y:14,text:'← ป่าลึก: ราชาโพริงเฝ้าภูตลมอยู่ข้างใน'}],
    enemies:[['poring',8,14],['poring',21,14],['poring',26,14],['mantis',13,14],['poring',12,8]],items:[['stone',24,11]]},
  deep:{name:'ป่าลึก',theme:'deep',exits:{right:'forest'},
    map:mk(f=>{f(0,15,29,16,'#');f(0,0,1,14,'#');f(6,11,10,11,'-');f(19,11,23,11,'-')}),
    objs:[],enemies:[['king',14,14],['poring',24,14],['mantis',8,14]],items:[]},
  sky1:{name:'เมืองฟ้า',theme:'sky',exits:{down:'town',right:'sky2'},
    map:mk(f=>{f(0,14,14,14,'-');f(15,11,19,11,'-');f(21,8,25,8,'-');f(26,7,29,7,'-');f(23,13,29,13,'-')}),
    objs:[],enemies:[['bird',10,9],['bird',22,4],['bird',4,10]],items:[['stone',17,10]]},
  sky2:{name:'รังฮาร์ปี้',theme:'sky',exits:{left:'sky1'},safe:[14,12],
    map:mk(f=>{f(0,13,29,16,'c');f(4,9,8,9,'-');f(21,9,25,9,'-')}),
    objs:[],enemies:[['harpy',15,5]],items:[]},
  abyss1:{name:'เมืองบาดาล',theme:'abyss',water:1,exits:{right:'abyss2'},
    map:mk(f=>{f(0,15,29,16,'#');f(0,0,1,14,'#');f(0,0,29,0,'#');f(19,0,20,1,'U');f(6,11,9,14,'#');f(13,8,16,8,'=');f(24,12,26,14,'#')}),
    objs:[],enemies:[['fish',11,5],['fish',22,6],['fish',4,9],['fish',18,12]],items:[['stone',14,7]]},
  abyss2:{name:'วิหารคราเคน',theme:'abyss',water:1,exits:{left:'abyss1'},
    map:mk(f=>{f(0,15,29,16,'#');f(0,0,29,0,'#');f(28,0,29,14,'#');f(4,10,8,10,'=');f(12,7,15,7,'=')}),
    objs:[],enemies:[['kraken',21,8]],items:[]},
  desert:{name:'ทะเลทราย',theme:'desert',exits:{left:'town'},
    map:mk(f=>{f(0,15,29,16,'#');f(28,0,29,14,'#');f(8,14,11,14,'#');f(9,13,10,13,'#');f(16,11,20,11,'-')}),
    objs:[{k:'sign',x:3,y:14,text:'ปิรามิดอยู่ไกลออกไปทางขวา... (โซนถัดไปของเกมเต็ม)'},{k:'chest',x:24,y:14}],
    enemies:[['scorpion',14,14],['scorpion',21,14]],items:[['stone',18,10]]}
};
const MAPPOS={deep:[0,1],forest:[1,1],town:[2,1],desert:[3,1],sky1:[2,0],sky2:[3,0],abyss1:[2,2],abyss2:[3,2]};

/* ---------- data ---------- */
const EN={
  poring:{name:'โพริง',hp:22,atk:7,w:20,h:16,stomp:1,el:'water',exp:8,z:[4,9],card:.06,drops:[['n_luck',.03],['a_leather',.02]]},
  mantis:{name:'แมนทิส',hp:60,atk:12,w:22,h:30,stomp:0,el:'earth',exp:18,z:[9,16],card:.06,drops:[['w_iron',.07],['r_power',.04]]},
  bird:{name:'นกลม',hp:28,atk:10,w:24,h:18,stomp:1,el:'wind',fly:1,exp:14,z:[6,12],card:.06,drops:[['b_wind',.05],['w_gale',.03]]},
  fish:{name:'ปลาฟันเลื่อย',hp:48,atk:15,w:28,h:16,stomp:0,el:'water',fly:1,exp:20,z:[9,15],card:.06,drops:[['w_tide',.04],['e_light',.04]]},
  scorpion:{name:'แมงป่องทราย',hp:80,atk:17,w:32,h:18,stomp:0,el:'earth',exp:26,z:[12,20],card:.06,drops:[['w_flame',.05],['a_knight',.04]]},
  king:{name:'ราชาโพริง',hp:420,atk:18,w:50,h:44,stomp:1,el:'water',exp:140,z:[80,80],boss:1,pet:'wind',drops:[['w_king',1]]},
  harpy:{name:'ฮาร์ปี้',hp:650,atk:22,w:40,h:36,stomp:1,el:'wind',fly:1,exp:240,z:[120,120],boss:1,pet:'water',drops:[['a_knight',1],['b_wind',1]]},
  kraken:{name:'MVP คราเคน',hp:1300,atk:28,w:84,h:76,stomp:0,el:'water',fly:1,exp:600,z:[300,300],boss:1,mvp:1,drops:[['w_kraken',1],['a_royal',1]]}
};
const CARDS={poring:{name:'การ์ดโพริง',luk:2,hp:20},mantis:{name:'การ์ดแมนทิส',str:2,atk:5},bird:{name:'การ์ดนกลม',agi:3},fish:{name:'การ์ดปลาฟันเลื่อย',def:3},scorpion:{name:'การ์ดแมงป่อง',atk:6,crit:3},king:{name:'การ์ดราชาโพริง',hp:80,vit:3},harpy:{name:'การ์ดฮาร์ปี้',agi:4,crit:5},kraken:{name:'การ์ดคราเคน',atk:12,def:6}};
const BONUS_NAMES={str:'STR',agi:'AGI',vit:'VIT',int:'INT',dex:'DEX',luk:'LUK',atk:'ATK',def:'DEF',hp:'MaxHP',crit:'คริ%'};
const bonusText=o=>Object.keys(BONUS_NAMES).filter(k=>o[k]).map(k=>`${BONUS_NAMES[k]} +${o[k]}`).join(' · ');
const ITEMS={
  w_train:{n:'ดาบฝึกหัด',t:'wpn',atk:6,slots:1,img:'sword'},
  w_iron:{n:'ดาบเหล็กกล้า',t:'wpn',atk:16,slots:1,img:'sword'},
  w_flame:{n:'ดาบเปลวเพลิง',t:'wpn',atk:24,el:'fire',slots:0,img:'sword2'},
  w_gale:{n:'ดาบสายลม',t:'wpn',atk:22,el:'wind',slots:1,img:'sword2'},
  w_tide:{n:'ดาบกระแสน้ำ',t:'wpn',atk:22,el:'water',slots:1,img:'sword2'},
  w_king:{n:'ดาบราชันย์',t:'wpn',atk:36,slots:2,img:'sword2',rare:1},
  w_kraken:{n:'ดาบคราเคน',t:'wpn',atk:58,el:'water',slots:2,img:'sword2',rare:2},
  a_cotton:{n:'เสื้อผ้าฝ้าย',t:'arm',def:2,slots:1,img:'card'},
  a_leather:{n:'เกราะหนัง',t:'arm',def:6,hp:25,slots:1,img:'card'},
  a_knight:{n:'เกราะอัศวิน',t:'arm',def:12,hp:50,slots:1,img:'card',rare:1},
  a_royal:{n:'เกราะราชวงศ์',t:'arm',def:20,hp:100,slots:2,img:'card',rare:2},
  r_power:{n:'แหวนพลัง',t:'acc',str:3,slots:1,img:'potion_r'},
  b_wind:{n:'เข็มกลัดขนนก',t:'acc',agi:3,slots:1,img:'e_wind'},
  n_luck:{n:'สร้อยโชคลาภ',t:'acc',luk:4,slots:1,img:'coin'},
  e_light:{n:'ตุ้มหูแสง',t:'acc',int:3,slots:1,img:'potion_b'}
};
const WPN_ART={w_train:'wpn_01_training_sword',w_iron:'wpn_02_iron_sword',w_flame:'wpn_03_flame_sword',w_gale:'wpn_04_gale_sword',w_tide:'wpn_05_tide_sword',w_king:'wpn_06_king_greatsword',w_kraken:'wpn_07_kraken_blade'};
const PETS={
  buddy:{name:'ลูกโพริง',el:'neutral',pow:4,ab:null,desc:'เพื่อนตัวแรก ยิงลูกเยลลี่',c:'#ff9cc4',lead:'หัวหน้า: MaxHP +10%',ult:'โพริงยักษ์ทับ'},
  wind:{name:'ภูตลม',el:'wind',pow:7,ab:'double',desc:'กระโดด 2 ชั้น · แรงใส่ธาตุน้ำ',c:'#7be3b0',lead:'หัวหน้า: ดาบธาตุลม · ตีเร็วขึ้น 15%',ult:'พายุทอร์นาโด'},
  water:{name:'ภูตน้ำ',el:'water',pow:7,ab:'dive',desc:'ดำน้ำได้ไม่จำกัด · แรงใส่ธาตุไฟ',c:'#5cb8ff',lead:'หัวหน้า: ดาบธาตุน้ำ · DEF +30%',ult:'คลื่นยักษ์'},
  fire:{name:'ภูตไฟ',el:'fire',pow:9,ab:'break',desc:'ทุบหินยักษ์ · แรงใส่ธาตุดิน',c:'#ff8a3d',lead:'หัวหน้า: ดาบธาตุไฟ · ATK +12%',ult:'ฝนอุกกาบาต'},
  angel:{name:'แองเจลลิ่ง',el:'holy',pow:3,ab:'regen',desc:'ฟื้น HP ต่อเนื่อง',c:'#fff1a8',lead:'หัวหน้า: ฟื้น HP เร็วขึ้น',ult:'เสาแสงศักดิ์สิทธิ์ (ฮีลด้วย)'}
};
const SKILLS={
  slash:{n:'ฟันกระแทก',max:5,desc:l=>`ฟันหนักใส่ศัตรูข้างหน้า ${Math.round((2+.4*l)*100)}% ของ ATK · กระเด็น`,sp:l=>6+l,cd:1.4,icon:'skill_power_slash'},
  burst:{n:'วงระเบิดเพลิง',max:5,desc:l=>`ระเบิดไฟรอบตัว ${Math.round((1.4+.3*l)*100)}% ของ ATK · ธาตุไฟ`,sp:l=>12+l*2,cd:4.5,icon:'skill_magnum_burst',req:2},
  mastery:{n:'ชำนาญดาบ',max:5,desc:l=>`ติดตัว: ATK +${l*4}`,passive:1,icon:'skill_sword_mastery'}
};
const ELN={neutral:'ไร้ธาตุ',water:'น้ำ',fire:'ไฟ',wind:'ลม',earth:'ดิน',holy:'แสง'};
const ELC={neutral:'#ffe6b0',water:'#6cc6ff',fire:'#ff8a3d',wind:'#8ff0bf',earth:'#d1a066',holy:'#fff1a8'};
const BEATS={water:'fire',fire:'earth',earth:'wind',wind:'water'};
const elMult=(a,d)=>BEATS[a]===d?1.5:(BEATS[d]===a?.75:1);
const STATS=[['str','STR','ATK +2 ต่อแต้ม'],['agi','AGI','ตีเร็วขึ้น · เดินเร็วขึ้น'],['vit','VIT','MaxHP +10 · DEF'],['int','INT','SP · แรงสกิลและท่าภูต'],['dex','DEX','ATK +1 ทุก 2 แต้ม · ดาเมจคงที่ขึ้น'],['luk','LUK','โอกาสคริติคอล · ของดรอปบ่อยขึ้น']];

/* ---------- state ---------- */
let UID=1;
const mkItem=id=>({u:'i'+Date.now().toString(36)+(UID++),id,ref:0,cards:Array(ITEMS[id].slots).fill(null)});
function fresh(){
  const w=mkItem('w_train'),a=mkItem('a_cotton');
  return{v:2,lv:1,exp:0,zeny:80,stones:0,owned:['buddy'],team:['buddy'],cards:{},boss:{},broken:{},items:{},chest:{},seen:{town:1},hp:120,sp:30,won:0,started:0,
    st:{str:1,agi:1,vit:1,int:1,dex:1,luk:1},stPts:5,skPts:1,sk:{slash:0,burst:0,mastery:0},inv:[w,a],eq:{wpn:w.u,arm:a.u,acc1:null,acc2:null}};
}
function loadSave(){
  try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&s.v===2)return Object.assign(fresh(),s)}catch(e){}
  try{const o=JSON.parse(localStorage.getItem(OLDKEY)||'null');if(o&&o.v===1){const n=fresh();
    for(const k of ['lv','zeny','stones','owned','team','cards','boss','broken','items','chest','seen','won','started'])if(o[k]!=null)n[k]=o[k];
    n.stPts=5+(n.lv-1)*3;n.skPts=n.lv;n.inv[0].ref=o.refine||0;return n}}catch(e){}
  return null;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
let S=fresh();

const itemBy=u=>S.inv.find(i=>i.u===u);
const eqItems=()=>['wpn','arm','acc1','acc2'].map(k=>S.eq[k]&&itemBy(S.eq[k])).filter(Boolean);
const refBonus=r=>{let b=0;for(let i=1;i<=r;i++)b+=i<=4?3:6;return b};
function bonus(k){let s=0;for(const it of eqItems()){const b=ITEMS[it.id];if(b.t!=='wpn'||k!=='atk')s+=b[k]||0;for(const c of it.cards)if(c)s+=CARDS[c][k]||0}return s}
const stat=k=>S.st[k]+bonus(k);
const leader=()=>S.team[0];
const weapon=()=>itemBy(S.eq.wpn);
function maxHP(){let v=90+stat('vit')*10+S.lv*10+bonus('hp');if(leader()==='buddy')v*=1.1;return Math.round(v)}
const maxSP=()=>20+stat('int')*4+S.lv*2;
function atk(){const w=weapon();let v=8+stat('str')*2+Math.floor(stat('dex')/2)+S.lv+(w?ITEMS[w.id].atk+refBonus(w.ref):0)+S.sk.mastery*4+bonus('atk');if(leader()==='fire')v*=1.12;return Math.round(v)}
function def(){let v=bonus('def')+Math.floor(stat('vit')/2);if(leader()==='water')v*=1.3;return Math.round(v)}
const critRate=()=>Math.min(60,2+stat('luk')*.5+bonus('crit'));
const atkCD=()=>.34*(1-Math.min(.4,stat('agi')*.012))*(leader()==='wind'?.85:1);
const moveSpd=()=>112+Math.min(40,stat('agi')*.8);
const need=()=>Math.floor(30*Math.pow(S.lv,1.5));
const has=ab=>S.team.some(id=>PETS[id].ab===ab);
function atkEl(){const w=weapon();if(w&&ITEMS[w.id].el)return ITEMS[w.id].el;const l=PETS[leader()];return l&&l.el!=='holy'?l.el:'neutral'}
const RCH=[1,1,1,1,.8,.6,.45,.3,.2,.1];

let cur='town',R=ROOMS.town,grid=[],enemies=[],dying=[],shots=[],parts=[],texts=[],toasts=[],items=[],drops=[],objs=[],pets=[],hist=[],vfx=[];
let time=0,shake=0,banner=0,fade=0,paused=true,deadT=0,winT=0,rockMsgT=0,drownMsg=0,freeze=0,flash=0,flashC='#fff';
let ug=0,ult=null,lastSkillHit=-9,cds={sk1:0,sk2:0};
const p={x:2*T,y:210,w:14,h:30,vx:0,vy:0,dir:1,onGround:0,coy:0,jbuf:0,canDouble:1,atkT:0,atkCd:0,atkKind:'n',inv:0,breath:5,drownT:0,walk:0,hitSet:null,dead:0};
