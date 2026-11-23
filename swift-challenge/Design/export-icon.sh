#!/bin/bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
output_dir="${1:?Pass a directory for rendered proofs}"
mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd)"
xcode_dir="$(xcode-select -p)"
ictool="$xcode_dir/../Applications/Icon Composer.app/Contents/Executables/ictool"
for appearance in Default Dark ClearLight ClearDark TintedLight TintedDark; do
    if [[ "$appearance" == Default || "$appearance" == Dark ]]; then
        sizes=(16 32 64 128 1024)
    else
        sizes=(64 256)
    fi
    for size in "${sizes[@]}"; do
        render_command=("$ictool" "$project_dir/RobotRally/AppIcon.icon" --export-image
            --output-file "$output_dir/$appearance-$size.png" --platform macOS
            --rendition "$appearance" --width "$size" --height "$size" --scale 1)
        if [[ "$appearance" == Tinted* ]]; then
            render_command+=(--tint-color 0.57 --tint-strength 0.5)
        fi
        "${render_command[@]}" > /dev/null
    done
done
xcrun swift "$project_dir/Design/render-proof.swift" "$output_dir"
printf 'Exported icon appearances and proof sheet to %s\n' "$output_dir"
