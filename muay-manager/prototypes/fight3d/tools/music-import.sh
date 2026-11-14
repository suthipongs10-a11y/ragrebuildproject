#!/bin/sh
# Background music for the fight (assets/music/track-N.mp3, embedded by build.mjs as music-pack).
# One section of a source file, levelled to -18 LUFS, mono 40 kbit/s (it plays quietly under the commentary,
# and the page has a size limit). The loop's crossfade is done in src/audio.js, so only a tiny fade here.
# usage: tools/music-import.sh <source.mp3> <start seconds> <length seconds> <out.mp3>
set -e
ffmpeg -v error -y -ss "$2" -t "$3" -i "$1" -ac 1 -ar 44100 \
  -af "loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=0.03,areverse,afade=t=in:d=0.03,areverse" \
  -c:a libmp3lame -b:a 40k "$4"

# Crowd (assets/sfx, CC-BY 4.0 "Free Crowd Cheering Sounds" by Gregor Quendel, see CREDITS.md), mono 40 kbit/s:
#   cheer-1: "10 - Ambience" 16-26 s at -20 LUFS, the bed under the fight (looped with a crossfade in src/audio.js)
#   swell-1: "06 - Soft cheering - II" 2.5-9.5 s, swell-2: "04 - Strong cheering - II - Short" 4-11 s, the crowd rising
#   ffmpeg -ss <start> -t <len> -i <track> -ac 1 -ar 44100 -af "loudnorm=I=<-20|-18|-17>:TP=-3:LRA=11,afade=t=in:d=<fade>,areverse,afade=t=in:d=0.6,areverse" -c:a libmp3lame -b:a 40k <out>
