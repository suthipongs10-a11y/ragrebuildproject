# Makes the fight sound effects in assets/sfx/ from free CC0 packs on OpenGameArt (see CREDITS.md for the packs, their
# authors and links). Each chosen recording is cut to the moment of impact, levelled and saved as a small mono MP3,
# grouped by what it is used for. Usage: python3 -I tools/sfx-import.py <folder with the unpacked packs>     (needs ffmpeg)
#   punch/x/...  hits37/x/...  towel/x/...  swishes/x/...  bamboo/x/...  blocks/x/...  crowd/...  applause/...
import os, re, subprocess, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sfx')
P = 'punch/x/qubodupPunch/qubodupPunch%02d.flac'; H = 'hits37/x/hits/hit%02d.mp3.flac'; T = 'towel/x/wet_towel_on_floor/wet_towel_on_floor-%02d.flac'
S = 'swishes/x/swishes/swish-%d.wav'; B = 'bamboo/x/swosh-%02d.flac'; K = 'blocks/x/impact.%d.ogg'
# set: [(source, start, max length)]. Chosen by measurement (tools: length, brightness, low-end share, attack time):
# punch: quick and mid-weight; thud: deep body blows; slap: shin on skin (wet towel on stone); crack: bright, for elbows;
# block: cardboard knocks for gloves and arms; fall: a body on the canvas; whoosh: a stick swung past the mic.
SETS = {
    'punch': [(P % i, 0, .3) for i in (1, 4, 5)] + [(H % i, 0, .3) for i in (10, 11, 17, 23)],
    'thud': [(P % i, 0, .3) for i in (2, 3)] + [(H % i, 0, .35) for i in (22, 26, 28)],
    'slap': [(T % i, 0, .3) for i in (3, 5, 6, 7, 8, 10)],
    'crack': [(H % i, 0, .3) for i in (12, 14, 18)] + [(K % i, 0, .25) for i in (2, 6)],
    'block': [(K % i, 0, .25) for i in (4, 5, 8, 9, 10)],
    'fall': [(T % i, 0, .4) for i in (1, 9)] + [(H % i, 0, .45) for i in (21, 24)],
    'whoosh': [(B % i, 0, .4) for i in (1, 3, 9, 13)] + [(S % i, 0, .2) for i in (10, 11, 12, 13)],
    'applause': [('applause/applause-clapping-church-crowd-immersive.wav', 26, 7)],
    'roar': [('crowd/crowd_shouting_0.ogg', 4, 5)],
}
LOOPS = {'applause', 'roar'}  # long beds: cut a stretch, fade both ends

def main():
    root = sys.argv[1]; os.makedirs(OUT, exist_ok=True); total = 0
    for f in os.listdir(OUT):
        if f.endswith('.mp3'): os.remove(os.path.join(OUT, f))
    for name, items in SETS.items():
        for n, (src, start, length) in enumerate(items):
            out = os.path.join(OUT, '%s-%d.mp3' % (name, n))
            if name in LOOPS:
                af = 'afade=t=in:d=0.6,afade=t=out:st=%g:d=1.2' % (length - 1.2)
                args = ['-ss', str(start), '-t', str(length)]
            else: # start just before the blow, end when it has died away, peak at -1 dB
                af = 'silenceremove=start_periods=1:start_threshold=-30dB:start_silence=0.004,atrim=0:%g,afade=t=out:st=%g:d=0.05' % (length, length - .05)
                args = []
            tmp = out + '.wav'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', *args, '-i', os.path.join(root, src), '-af', af, '-ac', '1', '-ar', '22050', tmp], check=True)
            # level: blows peak at -1 dB, the long crowd beds sit lower so they stay underneath
            det = subprocess.run(['ffmpeg', '-i', tmp, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
            peak = float(re.search(r'max_volume: (-?[0-9.]+) dB', det).group(1)); goal = -9 if name in LOOPS else -1
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', 'volume=%gdB' % (goal - peak), '-c:a', 'libmp3lame', '-b:a', '48k', out], check=True)
            os.remove(tmp)
            total += os.path.getsize(out)
        print('%-9s %d' % (name, len(items)))
    print(round(total / 1024), 'KB in', os.path.normpath(OUT))

main()
