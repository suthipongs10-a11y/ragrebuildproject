# ดนตรีประกอบฉากนอกเวที ให้ Gemini สร้าง — Muay Manager

สถานะ: 16 พ.ย. 2026 เจ้าของเกมส่งเพลงครบ 7 เพลงแล้ว ใส่ในเกมบนเว็บแล้ว (ต้นแบบ 2.40) รอฟังจริงว่าระดับเสียงและรอยต่อพอดีไหม

## ตอนนี้ในเกมเป็นยังไง

- ระหว่างชก: เพลงปี่กลองสองเพลงของเจ้าของเกม (`assets/music/track-1.mp3`, `track-2.mp3`) เปิดคลอเบา ๆ ดนตรีฉากไม่เล่นทับยก
- นอกเวที: เพลงตามฉาก (`assets/scene-music/`, `src/audio.js` ส่วน scene music, เลือกเพลงใน `tune()` ของ `src/game.js`)

| เพลง | ไฟล์ต้นฉบับ | เล่นตอน | ช่วงที่ใช้ (วินาทีในต้นฉบับ) |
|---|---|---|---|
| `win` | Victory at the Ring | กรรมการชูมือเมื่อนักมวยของผู้เล่นชนะ ต่อถึงหน้าผลการชก | เริ่มที่ต้นเพลง 2.0 แล้ววนช่วง 13.5–53.5 |
| `lose` | The Long Walk Back | ชูมือเมื่อแพ้ ต่อถึงหน้าผลการชก | เริ่มที่โน้ตเปิด 2.1 แล้ววนช่วง 22.3–54.4 |
| `camp` | Hands Wrapped in Linen | หน้าค่าย แต่งตัว อันดับ ตั้งค่า | วน 74.8–111.4 |
| `train` | Leather And Bone | ซ้อมทุกแบบ และวิ่ง | วน 80.5–112.5 |
| `calm` | Stillness by the Canal | ฉากพักผ่อน ฉากพักนวด | วน 68.5–110.2 |
| `night` | Before the First Bell | หน้าหาคู่ชก หน้าวางแผนก่อนขึ้นเวที หน้าดูมวย | วน 67.3–115.3 |
| `title` | Eight Limbs of Honor | หน้าสร้างนักมวยตอนเริ่มเกม | วน 39.5–93.8 |

- เพลงเริ่มจากต้นไฟล์ แล้ววนจากจุดวนด้วยการเฟดทับ 2 วินาที (เพลงช้า `lose` กับ `calm` 3 วินาที) เพลงชนะจึงเริ่มด้วยแตรเปิดแล้วเล่นต่อได้นานเท่าที่หน้าผลการชกเปิดอยู่
- จุดวนหาจากการเทียบคลื่นเสียง (ช่วงหลังจุดจบต้องเหมือนช่วงหลังจุดเริ่ม จังหวะตรงกัน เบสไม่หักล้างกัน) เพราะ Claude ฟังเองไม่ได้ **เจ้าของเกมต้องฟังรอยต่อ** ถ้าเพลงไหนสะดุด บอกชื่อเพลงมา จะเลือกช่วงอื่น
- ทุกเพลงปรับความดังเท่ากัน (-18 LUFS) ระดับในเกม: ค่าย ซ้อม คืนขึ้นชก 0.45 • พัก 0.42 • เพลงเปิด 0.50 • แพ้ 0.52 • ชนะ 0.62 ใช้แถบ "ดนตรี" ในหน้าตั้งค่าร่วมกับเพลงบนเวที
- เฉพาะเว็บ (muay-manager.pages.dev): แต่ละเพลงเป็นไฟล์แยก 0.4–0.7 MB โหลดเมื่อเข้าฉากนั้นครั้งแรก เกมจึงไม่เปิดช้าลง หน้าใน claude.ai ไม่มีเพลงชุดนี้ (ไม่มีที่ และโหลดไฟล์ภายนอกไม่ได้)
- นำเข้าใหม่: `node tools/scene-music-import.mjs <โฟลเดอร์ไฟล์ต้นฉบับ>` (ไฟล์ต้นฉบับรวม 26 MB ไม่ได้เก็บใน repo)

## กติกาทุกเพลง (ใส่ท้ายทุกคำสั่งแล้ว)

- บรรเลงล้วน ไม่มีเสียงร้อง ไม่มีเสียงพูด ไม่มีเสียงคนดู ไม่มีเสียงเอฟเฟกต์
- ทำนองแต่งใหม่ ไม่เลียนเพลงที่มีอยู่
- เริ่มเล่นทันที ไม่มีช่วงเงียบหรือค่อย ๆ ดังขึ้นตอนต้น
- เพลงวน (ข้อ 3–7): จังหวะและความดังสม่ำเสมอทั้งเพลง ไม่มีท่อนจบ เพราะเกมจะตัดช่วงกลางมาเล่นวน
- ยาวเท่าที่ Gemini ให้ได้ (30 วินาทีขึ้นไปพอ) ถ้าได้หลายแบบส่งมาได้ทั้งหมด Claude เลือกช่วงที่วนเนียนที่สุด

## คำสั่ง (ส่งทีละเพลง)

### 1. `win` ชูมือผู้ชนะ (เล่นครั้งเดียว ราว 15–25 วินาที)

ใช้ตอน: จบไฟต์ กรรมการชูมือนักมวยของผู้เล่นที่ชนะ ต่อเนื่องถึงหน้าผลการชก

```
A short triumphant victory fanfare for the winner of a Muay Thai fight, 15 to 25 seconds. Thai ceremonial feel: bright pi chawa (Thai oboe) lead melody over klong khaek hand drums and ching finger cymbals, joined by warm brass and a big drum hit at the start. Proud, joyful, celebratory, medium-fast tempo around 120 BPM. Starts immediately on a strong downbeat, builds to a final held chord and a clean ending. Instrumental only, no vocals, no speech, no crowd noise, no sound effects. Original melody.
```

### 2. `lose` แพ้ (เล่นครั้งเดียว ราว 12–20 วินาที)

ใช้ตอน: จบไฟต์ นักมวยของผู้เล่นแพ้

```
A short, dignified piece for a fighter who has just lost a Muay Thai bout, 12 to 20 seconds. Slow and bittersweet but not hopeless: a single khim (Thai hammered dulcimer) and a soft saw duang (Thai fiddle) over one quiet low drum. Tempo around 70 BPM. Respectful, reflective, ends on an unresolved but gentle note as if to say "next time". Starts immediately, no fade in. Instrumental only, no vocals, no speech, no crowd noise, no sound effects. Original melody.
```

### 3. `camp` หน้าค่าย (เพลงวน)

ใช้ตอน: หน้าแรกของเกม หน้าค่าย หน้าแต่งตัว หน้าอันดับ เปิดคลอเบา ๆ ตลอด

```
Calm background music for the home screen of a game set in a small Muay Thai training camp in rural Thailand, morning light. Gentle and warm: ranat ek (Thai wooden xylophone) and khim (hammered dulcimer) playing a simple, memorable pentatonic melody, with soft hand drum and ching finger cymbals keeping an easy pulse around 90 BPM. Relaxed, hopeful, unhurried. Even volume and steady rhythm throughout with no intro, no build-up and no ending, so a section can be looped seamlessly. Instrumental only, no vocals, no speech, no crowd noise, no sound effects. Original melody.
```

### 4. `train` ซ้อม (เพลงวน)

ใช้ตอน: ซ้อมกระสอบ เตะต้นกล้วย ถีบหุ่น กระโดดเชือก ลงนวม วิ่ง

```
Driving, motivating training music for a Muay Thai gym workout: hitting the heavy bag, skipping rope, kicking pads. A tight, repetitive groove of klong khaek hand drums and ching finger cymbals at a steady 120 BPM, with a short punchy pi chawa (Thai oboe) riff that repeats, and a low drum accent on every bar. Energetic, focused, sweaty, makes you want to keep the rhythm. Even volume and steady rhythm throughout with no intro, no breakdown and no ending, so a section can be looped seamlessly. Instrumental only, no vocals, no speech, no crowd noise, no sound effects. Original melody.
```

### 5. `calm` พักผ่อน พักนวด (เพลงวน)

ใช้ตอน: ฉากพักผ่อนหย่อนใจ (ตกปลา กินข้าว หนังกลางแปลง) ฉากนวดแผนไทย ประคบสมุนไพร

```
Soothing, slow relaxation music for a Thai massage and a quiet evening by a canal. A soft khlui (Thai bamboo flute) melody floating over gentle khim (hammered dulcimer) arpeggios, very light ching finger cymbals, no drums. Tempo around 65 BPM. Peaceful, warm, a little sleepy, like a breeze through coconut palms. Even volume throughout with no intro, no build-up and no ending, so a section can be looped seamlessly. Instrumental only, no vocals, no speech, no nature sounds, no sound effects. Original melody.
```

### 6. `night` คืนขึ้นชก (เพลงวน)

ใช้ตอน: หน้าหาคู่ชก หน้าสายการแข่งทัวร์นาเมนต์ หน้าวางแผนก่อนขึ้นเวที

```
Tense build-up music for the night of a Muay Thai fight: choosing an opponent, studying the tournament bracket, last instructions before walking to the ring. Low, steady klong khaek drums like a heartbeat around 100 BPM, a distant pi chawa (Thai oboe) drone with slow bends, sparse ching finger cymbals, and a deep sustained bass note underneath. Anticipation, nerves, focus, something big is about to happen, but it never explodes. Even volume and steady rhythm throughout with no intro, no climax and no ending, so a section can be looped seamlessly. Instrumental only, no vocals, no speech, no crowd noise, no sound effects. Original melody.
```

### 7. `title` เพลงเปิดเกม (เพลงวน ไม่บังคับ ทำทีหลังได้)

ใช้ตอน: หน้าสร้างนักมวยตอนเริ่มเกมครั้งแรก และหน้าโหลดเกม

```
A proud, heroic main theme for a Muay Thai manager game. A strong, singable pentatonic melody on pi chawa (Thai oboe) and ranat ek (Thai xylophone), supported by full klong khaek drums, ching finger cymbals and warm low strings. Medium tempo around 105 BPM. Feels like the start of a long journey from a village camp to the championship: determined, honourable, exciting. Even energy throughout with no long intro and no ending, so a section can be looped seamlessly. Instrumental only, no vocals, no speech, no crowd noise, no sound effects. Original melody.
```

## ส่งกลับมา

- ส่งไฟล์เสียงกลับมาในแชต (MP3 หรือ WAV แบบไหนก็ได้ ไม่ต้องตัด ไม่ต้องปรับเสียง) บอกว่าไฟล์ไหนคือข้อไหน
- ไม่ต้องครบทุกข้อ ได้ข้อไหนก่อนส่งมาก่อนได้ ข้อ 1 (`win`) สำคัญที่สุดเพราะฉากชูมือตอนนี้ไม่มีดนตรี
- Claude ทำต่อ: ตัดช่วงที่วนเนียน ปรับความดังให้เท่ากัน (เบากว่าเสียงพากย์) ย่อขนาด ใส่ในเกมตามฉาก และเพิ่มในหน้าตั้งค่าเสียง
- เพลงชุดนี้ใส่ได้เฉพาะบนเว็บ (muay-manager.pages.dev) หน้าใน claude.ai เหลือที่ไม่ถึง 0.2 MB ใส่ได้อย่างมากข้อ 1 ข้อเดียว
- ลิขสิทธิ์: เพลงที่ Gemini สร้างให้ใช้ตามเงื่อนไขของบัญชี Gemini ของเจ้าของเกม Claude จะบันทึกที่มาใน `prototypes/fight3d/CREDITS.md` ตอนนำเข้า
