#!/bin/bash
# hoja de contacto: cada clip, 3 fotogramas recortados a vertical
D=$1; OUT=$2; T=$(mktemp -d)
for f in $D/*.mp4; do b=$(basename $f .mp4); d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $f)
 for p in 0.15 0.5 0.85; do ffmpeg -v error -y -ss $(python3 -c "print($d*$p)") -i $f -frames:v 1 -vf "scale=-2:320,crop=180:320,drawtext=text='$b':x=3:y=3:fontsize=18:fontcolor=yellow:box=1:boxcolor=black" $T/${b}_$p.png; done; done
ffmpeg -v error -y -pattern_type glob -i "$T/*.png" -vf "tile=12x$(( ($(ls $T | wc -l)+11)/12 ))" -frames:v 1 $OUT; rm -rf $T
