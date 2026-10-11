#!/bin/bash
# build every figurine not yet built, then export all to the game
B=/workspace/oiioii-canvas/lake-room/runtime/blender-4.5.10-linux-x64/blender
G=/workspace/oiioii-canvas/red-room/public/game/cast
mkdir -p $G
cd "$(dirname "$0")"
ALL="audrey giant leland sarah donna james shelly norma bobby ben_horne lucy andy hawk josie pete gordon albert mike windom nadine"
for s in $ALL; do [ -f $s.blend ] || $B -b --python figurine.py -- --only=$s --render --quick > build-$s.log 2>&1; echo built $s; done
for s in cooper laura bob truman log_lady julee man_from_another_place $ALL; do $B -b $s.blend --python ../cast-mpfb/export_puppet.py -- --out=$G/$s.glb --decimate=0.25 > export-$s.log 2>&1; echo exported $s; done
echo ALLDONE
