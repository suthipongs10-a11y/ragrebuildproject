// Generates one rigged fighter with the Meshy API: reference image -> textured 3D model -> auto-rig.
// Usage: node tools/meshy-fighter.mjs <name> "<prompt>"      writes assets/<name>.glb and assets/<name>-reference.png
// The API key comes from MESHY_API_KEY (in a Claude cloud session the network proxy injects it, so any placeholder works).
// Cost seen on 10 Nov 2026: image 9 + model 30 + rig 5 = 44 credits per fighter.
import { execFileSync } from 'node:child_process';
// curl is used for every request so that a system or session HTTPS proxy applies
const API = 'https://api.meshy.ai/openapi/v1', AUTH = 'Authorization: Bearer ' + (process.env.MESHY_API_KEY || 'proxy-injected');
const curl = args => execFileSync('curl', ['-sS', '-m', '120', ...args], {maxBuffer: 1 << 28});
const getJson = url => JSON.parse(curl(['-H', AUTH, url]).toString());
const postJson = (url, body) => JSON.parse(curl(['-X', 'POST', '-H', AUTH, '-H', 'Content-Type: application/json', '-d', JSON.stringify(body), url]).toString());
const [name, prompt] = process.argv.slice(2);
if (!name || !prompt) { console.error('usage: node tools/meshy-fighter.mjs <name> "<prompt>"'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(path, body) {
  const j = postJson(API + path, body); if (!j.result) throw new Error(path + ' ' + JSON.stringify(j));
  for (let i = 0; i < 120; i++) {
    await sleep(8000);
    const t = getJson(API + path + '/' + j.result);
    if (t.status === 'SUCCEEDED') { console.log(path, 'done, credits', t.consumed_credits); return t; }
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(path + ' ' + t.status + ' ' + JSON.stringify(t.task_error));
  }
  throw new Error(path + ' timed out');
}
const save = async (url, file) => { curl(['-L', '-o', file, url]); };
const img = await run('/text-to-image', {ai_model: 'nano-banana-pro', pose_mode: 't-pose', prompt});
await save(img.image_urls[0], `assets/${name}-reference.png`);
const mesh = await run('/image-to-3d', {input_task_id: img.id, pose_mode: 'a-pose', should_texture: true, should_remesh: true, target_polycount: 30000, topology: 'triangle', texture_resolution: '2k', enable_pbr: false, target_formats: ['glb']});
const rig = await run('/rigging', {input_task_id: mesh.id, height_meters: 1.72});
await save(rig.result.rigged_character_glb_url, `assets/${name}.glb`);
console.log('saved assets/' + name + '.glb');
