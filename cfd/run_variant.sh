#!/usr/bin/env bash
# Generic virtual wind tunnel: run the FluidX3D case for ANY variant in the
# archive. Exports the variant's GLB to STL, substitutes its real length /
# wing area / angle of attack into the case file, builds, runs, and encodes
# videos into public/media/cfd/<id>-{hero,side,top}.mp4.
#
#   usage: cfd/run_variant.sh <variant-id> <length-m> <wing-area-m2> [aoa-deg]
#   e.g. : cfd/run_variant.sh b737-800 39.47 124.6 8
#
# Requires: a FluidX3D checkout (default sibling ../FluidX3D, override with
# FLUIDX3D_DIR), Blender.app, ffmpeg. FluidX3D is used under its research/
# education license — this repo ships only our case file, not FluidX3D.
set -euo pipefail

ID="${1:?variant id, e.g. b737-800}"
LEN="${2:?length in metres, e.g. 39.47}"
AREA="${3:?wing area in m2, e.g. 124.6}"
AOA="${4:-8}"

# C++ float literals need a decimal point: 372f is a compile error, 372.0f isn't
case "$LEN"  in *.*) ;; *) LEN="${LEN}.0"  ;; esac
case "$AREA" in *.*) ;; *) AREA="${AREA}.0" ;; esac

REPO="$(cd "$(dirname "$0")/.." && pwd)"
FX3D="${FLUIDX3D_DIR:-"$(dirname "$REPO")/FluidX3D"}"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
GLB="$REPO/public/models/$ID.glb"
[ -f "$GLB" ] || { echo "no model at $GLB"; exit 1; }

# 1. aircraft GLB -> STL (in-flight config, gear removed)
mkdir -p "$FX3D/stl"
if [ ! -f "$FX3D/stl/$ID.stl" ]; then
	"$BLENDER" --background --factory-startup --python "$REPO/cfd/export_stl.py" -- \
		"$GLB" "$FX3D/stl/$ID.stl" --drop-gear
fi

# 2. install our case with this variant's numbers + enable needed extensions
sed \
	-e "s|si_length = 37.57f|si_length = ${LEN}f|" \
	-e "s|si_S = 122.6f|si_S = ${AREA}f|" \
	-e "s|aoa = 8.0f|aoa = ${AOA}.0f|" \
	-e "s|stl/a320.stl|stl/${ID}.stl|" \
	"$REPO/cfd/setup_a320_windtunnel.cpp" > "$FX3D/src/setup.cpp"
sed -i '' \
	-e 's|^#define BENCHMARK|//#define BENCHMARK|' \
	-e 's|^//#define VOLUME_FORCE|#define VOLUME_FORCE|' \
	-e 's|^//#define FORCE_FIELD|#define FORCE_FIELD|' \
	-e 's|^//#define EQUILIBRIUM_BOUNDARIES|#define EQUILIBRIUM_BOUNDARIES|' \
	-e 's|^//#define SUBGRID|#define SUBGRID|' \
	-e 's|^//#define GRAPHICS |#define GRAPHICS |' \
	-e 's|^#define SURFACE|//#define SURFACE|' \
	-e 's|^#define TEMPERATURE|//#define TEMPERATURE|' \
	-e 's|^#define MOVING_BOUNDARIES|//#define MOVING_BOUNDARIES|' \
	-e 's|^#define PARTICLES|//#define PARTICLES|' \
	-e 's|^#define INTERACTIVE_GRAPHICS|//#define INTERACTIVE_GRAPHICS|' \
	"$FX3D/src/defines.hpp"

# 3. build + run (renders frames to bin/export/{hero,side,top})
make -C "$FX3D" macOS -j"$(sysctl -n hw.ncpu)" LDFLAGS_X11= LDLIBS_X11=
rm -rf "$FX3D/bin/export"
(cd "$FX3D" && bin/FluidX3D) 2>&1 | tee "$FX3D/bin/${ID}_run.log"

# 4. frames -> videos + poster (skip the 50-frame spin-up transient)
OUT="$REPO/public/media/cfd"
mkdir -p "$OUT"
TRIM="select='gte(n,50)',setpts=N/(30*TB)"
ffmpeg -y -framerate 30 -pattern_type glob -i "$FX3D/bin/export/hero/*.bmp" \
	-vf "$TRIM" -c:v libx264 -pix_fmt yuv420p -crf 28 -movflags +faststart "$OUT/$ID-hero.mp4"
for view in side top; do
	ffmpeg -y -framerate 30 -pattern_type glob -i "$FX3D/bin/export/$view/*.bmp" \
		-vf "$TRIM,scale=1280:720" -c:v libx264 -pix_fmt yuv420p -crf 28 -movflags +faststart "$OUT/$ID-$view.mp4"
done
ffmpeg -y -sseof -0.5 -i "$OUT/$ID-hero.mp4" -frames:v 1 -q:v 3 "$OUT/$ID-poster.jpg"
echo "Done: $OUT/$ID-{hero,side,top}.mp4"
