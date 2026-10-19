#!/bin/bash
# Вырезать кусок песни с плавным началом и концом: cut_audio.sh IN.mp3 OUT.mp3 START_SEC END_SEC
# Получится mp3 128 кбит/с. Время в OUT начинается с нуля (то есть START станет 0).
set -e
IN="$1"; OUT="$2"; S="$3"; E="$4"
D=$(python3 -c "print(round($E-$S,2))"); FO=$(python3 -c "print(max(0,round($E-$S-1.2,2)))")
mkdir -p "$(dirname "$OUT")"
ffmpeg -v error -y -ss "$S" -t "$D" -i "$IN" -af "afade=t=in:d=0.4,afade=t=out:st=$FO:d=1.2" -ac 2 -ar 44100 -b:a 128k "$OUT"
echo "OK $OUT ($D s)"
