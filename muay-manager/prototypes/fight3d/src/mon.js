// Ads and purchases: one small interface for the game, three ways to answer it.
//   'native'  the game runs inside the iOS / Android app, which provides window.MuayNative (docs/APP_BUILD_GUIDE.md):
//             rewarded ads and interstitials from the ad network, purchases from the store
//   'test'    the page was opened with ?mon=test: a stand-in advert (a few seconds of countdown) and a stand-in
//             purchase, so the whole flow can be tried on the web and in automated checks. Nothing is charged.
//   'none'    the public web page: no adverts to show and nothing to buy; the game hides the ad buttons and the
//             offer only says it is coming to the app (and counts who pressed it)
// The game never talks to an ad or billing library itself.
export const PRODUCT = 'camp_owner';                      // the one-time purchase (non-consumable)
export const PLACEMENTS = ['purse', 'massage', 'revenge']; // rewarded placements; 'camp' is the interstitial

const N = () => (typeof window !== 'undefined' && window.MuayNative) || null;
let testOn = false;
try { if (/[?&]mon=test\b/.test(location.search)) sessionStorage.setItem('muayMon', 'test'); testOn = sessionStorage.getItem('muayMon') === 'test'; } catch (e) { /* no storage: no test mode */ }
export const mode = () => (N() ? 'native' : testOn ? 'test' : 'none');

// a full-screen card for the stand-ins; resolves with what was pressed
function card(html, wire) {
  return new Promise(done => {
    const el = document.createElement('div'); el.id = 'monCard'; el.setAttribute('role', 'dialog'); el.innerHTML = '<div class="mc">' + html + '</div>';
    document.body.appendChild(el); wire(el, v => { el.remove(); done(v); });
  });
}
// A rewarded advert for this placement. Resolves true when it was watched to the end (the reward is earned).
export async function rewarded(placement) {
  const n = N();
  if (n) { try { const r = await n.rewarded(placement); return !!(r && r.rewarded); } catch (e) { return false; } }
  if (!testOn) return false;
  return card('<b>โฆษณาทดสอบ</b><p>ของจริงจะเป็นวิดีโอจากเครือข่ายโฆษณา</p><div class="mc-n" id="monN">3</div><button class="btn" id="monX">ปิดก่อนจบ (ไม่ได้รางวัล)</button>', (el, done) => {
    let left = 3; const t = setInterval(() => { left--; const x = el.querySelector('#monN'); if (x) x.textContent = String(Math.max(0, left)); if (left <= 0) { clearInterval(t); done(true); } }, 700);
    el.querySelector('#monX').addEventListener('click', () => { clearInterval(t); done(false); });
  });
}
// An advert between screens (the app only); never waits long and never fails loudly
export async function interstitial() { const n = N(); if (n && n.interstitial) { try { await n.interstitial(); } catch (e) { /* no advert this time */ } } }
// Localised price of the one-time purchase, or '' when unknown
export async function price() {
  const n = N(); if (n && n.products) { try { const p = await n.products(); return (p && p[PRODUCT] && p[PRODUCT].price) || ''; } catch (e) { return ''; } }
  return testOn ? '฿99 (ทดสอบ)' : '';
}
// Buy the one-time purchase. Resolves true when the store says it is owned now.
export async function purchase() {
  const n = N();
  if (n) { try { const r = await n.purchase(PRODUCT); return !!(r && r.ok); } catch (e) { return false; } }
  if (!testOn) return false;
  return card('<b>ทดสอบการซื้อ</b><p>แพ็กเจ้าของค่าย · ไม่มีการตัดเงินจริง</p><button class="btn go" id="monY">ยืนยันซื้อ (ทดสอบ)</button><button class="btn" id="monX">ยกเลิก</button>', (el, done) => {
    el.querySelector('#monY').addEventListener('click', () => done(true)); el.querySelector('#monX').addEventListener('click', () => done(false));
  });
}
// What the store says this player owns (asked at start and by "restore purchases"). null: not known here.
export async function owned() {
  const n = N(); if (!n || !n.owned) return null;
  try { const a = await n.owned(); return Array.isArray(a) ? a : null; } catch (e) { return null; }
}
