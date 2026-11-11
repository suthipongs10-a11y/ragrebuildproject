// Redraws a fighter's reference picture with the arms straight out to the sides (Meshy image-to-image, 9 credits).
// Usage: node tools/meshy-tpose.mjs <reference.png> <out.png>
// Why: a body built from a picture with the arms hanging at 45 degrees or lower comes out with the inner arm joined to the
// ribs, and that skin stretches into a flap whenever the arm lifts. Build from a strict T-pose and check the result with
// LAB.stretch(['guard', 'jab', 'hook', 'win']) in the lab page: a clean body scores [0, 0] or close to it in 'guard'.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
const API = 'https://api.meshy.ai/openapi/v1', AUTH = 'Authorization: Bearer ' + (process.env.MESHY_API_KEY || 'proxy-injected');
const curl = a => execFileSync('curl', ['-sS', '-m', '120', ...a], {maxBuffer: 1 << 28});
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node tools/meshy-tpose.mjs <reference.png> <out.png>'); process.exit(1); }
const body = {ai_model: 'nano-banana-pro', reference_image_urls: ['data:image/png;base64,' + readFileSync(src).toString('base64')],
  prompt: 'Redraw exactly the same man: same face, same hair, same skin, same tattoos, same body build, same shorts, same boxing gloves, same ankle wraps, same lighting and plain light grey studio background. Change only the pose: both arms raised straight out to the sides at shoulder height, perfectly horizontal, a strict T-pose, arms fully extended and well away from the torso with clear empty space under the armpits. Legs slightly apart. Full body from head to bare feet, front view, facing the camera, photorealistic character reference.'};
const f = out + '.json'; writeFileSync(f, JSON.stringify(body)); // through a file: the picture is too long for a command argument
let j; try { j = JSON.parse(curl(['-X', 'POST', '-H', AUTH, '-H', 'Content-Type: application/json', '-d', '@' + f, API + '/image-to-image']).toString()); } finally { unlinkSync(f); }
if (!j.result) { console.error('rejected', JSON.stringify(j)); process.exit(1); }
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 6000));
  const t = JSON.parse(curl(['-H', AUTH, API + '/image-to-image/' + j.result]).toString());
  if (t.status === 'SUCCEEDED') { curl(['-L', '-o', out, t.image_urls[0]]); console.log('saved', out, 'credits', t.consumed_credits); process.exit(0); }
  if (t.status === 'FAILED' || t.status === 'CANCELED') { console.error(t.status, JSON.stringify(t.task_error)); process.exit(1); }
}
console.error('timed out'); process.exit(1);
