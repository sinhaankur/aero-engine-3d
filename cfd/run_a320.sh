#!/usr/bin/env bash
# A320 virtual wind tunnel: export STL from our GLB, build + run FluidX3D,
# assemble the rendered frames into videos under public/media/cfd/.
#
# Requires: a FluidX3D checkout (default: sibling dir ../FluidX3D, override
# with FLUIDX3D_DIR), Blender.app, ffmpeg. FluidX3D is used under its
# research/education license — this repo only ships our case file, not
# FluidX3D itself.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
FX3D="${FLUIDX3D_DIR:-"$(dirname "$REPO")/FluidX3D"}"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"

# 1. aircraft GLB -> STL (in-flight config, gear removed)
mkdir -p "$FX3D/stl"
if [ ! -f "$FX3D/stl/a320.stl" ]; then
	"$BLENDER" --background --factory-startup --python "$REPO/cfd/export_stl.py" -- \
		"$REPO/public/models/a320.glb" "$FX3D/stl/a320.stl" --drop-gear
fi

# 2. install our case + enable the extensions it needs
cp "$REPO/cfd/setup_a320_windtunnel.cpp" "$FX3D/src/setup.cpp"
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

# 3. build + run (renders PNG frames to bin/export/{hero,side,top});
# X11 is only needed for INTERACTIVE_GRAPHICS, not offline GRAPHICS rendering
make -C "$FX3D" macOS -j"$(sysctl -n hw.ncpu)" LDFLAGS_X11= LDLIBS_X11=
rm -rf "$FX3D/bin/export"
(cd "$FX3D" && bin/FluidX3D) 2>&1 | tee "$FX3D/bin/a320_run.log"

# 4. frames -> videos + poster; skip the first 50 frames (spin-up transient),
# hero stays 1080p, the diagram-like side/top views compress fine at 720p
OUT="$REPO/public/media/cfd"
mkdir -p "$OUT"
TRIM="select='gte(n,50)',setpts=N/(30*TB)"
ffmpeg -y -framerate 30 -pattern_type glob -i "$FX3D/bin/export/hero/*.bmp" \
	-vf "$TRIM" -c:v libx264 -pix_fmt yuv420p -crf 28 -movflags +faststart "$OUT/a320-hero.mp4"
for view in side top; do
	ffmpeg -y -framerate 30 -pattern_type glob -i "$FX3D/bin/export/$view/*.bmp" \
		-vf "$TRIM,scale=1280:720" -c:v libx264 -pix_fmt yuv420p -crf 28 -movflags +faststart "$OUT/a320-$view.mp4"
done
ffmpeg -y -sseof -0.5 -i "$OUT/a320-hero.mp4" -frames:v 1 -q:v 3 "$OUT/a320-poster.jpg"
echo "Done: $OUT"
