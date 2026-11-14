#!/bin/sh
# Background music for the fight (assets/music/track-N.mp3, embedded by build.mjs as music-pack).
# One section of a source file, levelled to -18 LUFS, mono 40 kbit/s (it plays quietly under the commentary,
# and the page has a size limit). The loop's crossfade is done in src/audio.js, so only a tiny fade here.
# usage: tools/music-import.sh <source.mp3> <start seconds> <length seconds> <out.mp3>
set -e
ffmpeg -v error -y -ss "$2" -t "$3" -i "$1" -ac 1 -ar 44100 \
  -af "loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=0.03,areverse,afade=t=in:d=0.03,areverse" \
  -c:a libmp3lame -b:a 40k "$4"
