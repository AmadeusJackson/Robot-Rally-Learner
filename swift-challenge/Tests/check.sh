#!/bin/bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
check_dir="$(mktemp -d "${TMPDIR:-/tmp}/robot-rally-check.XXXXXX")"
trap 'rm -rf "$check_dir"' EXIT
# Keep the production views and replace only the executable entry point.
python3 - "$project_dir/RobotRally/RobotRallyApp.swift" "$check_dir/RobotRallyApp.swift" <<'PY'
from pathlib import Path
import sys
source = Path(sys.argv[1]).read_text()
assert source.count('@main') == 1
Path(sys.argv[2]).write_text(source.replace('@main', '', 1))
PY
cp "$project_dir/RobotRally/Rover.png" "$check_dir/Rover.png"
xcrun swiftc -parse-as-library \
    "$project_dir/Tests/ControllerChecks.swift" "$check_dir/RobotRallyApp.swift" \
    "$project_dir/RobotRally/RallyController.swift" "$project_dir/RobotRally/RallyScene.swift" \
    "$project_dir/RobotRally/Lesson.swift" "$project_dir/RobotRally/LessonExperiment.swift" \
    -o "$check_dir/ControllerChecks"
"$check_dir/ControllerChecks"
