#!/usr/bin/env bash
# Bake the wind-tunnel case for every aerodynamically distinct shape in the
# archive (one representative per family + the A310's different wing).
# Sibling variants share their representative's run in the UI, clearly
# labelled. Runs are sequential — each needs the whole GPU.
set -uo pipefail
cd "$(dirname "$0")/.."

# id  length-m  wing-area-m2   (from src/data — keep in sync)
RUNS=(
  "a220-300 38.7 112.3"
  "a330-900 63.66 372"
  "a350-900 66.8 442"
  "a380-800 72.72 845"
  "a300-600 54.08 260"
  "a310-300 46.66 219"
)

for spec in "${RUNS[@]}"; do
  set -- $spec
  id="$1"
  if [ -f "public/media/cfd/$id-hero.mp4" ]; then
    echo "== $id already baked, skipping"
    continue
  fi
  echo "== baking $id ($2 m, $3 m2)"
  if ! cfd/run_variant.sh "$1" "$2" "$3" 8 > "/tmp/cfd-$id.log" 2>&1; then
    echo "!! $id FAILED — see /tmp/cfd-$id.log"
  fi
done
echo "== bake complete"
ls -la public/media/cfd/
