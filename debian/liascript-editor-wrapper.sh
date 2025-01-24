#!/bin/bash

COURSE_BASE_PATH="$HOME/.local/share/learning-portal/courses"

# Ensure the required directories exist
mkdir -p "$COURSE_BASE_PATH"
mkdir -p "$HOME/.local/share/liascript-editor"

# Check if a path argument was provided
if [ -z "$1" ]; then
    echo "Error: Please provide a path to the course"
    exit 1
fi

# Process the path
COURSE_PATH="$1"
if [[ "$COURSE_PATH" == "$COURSE_BASE_PATH/"* ]]; then
    # Remove the prefix if it's an absolute path
    COURSE_PATH="${COURSE_PATH#$COURSE_BASE_PATH/}"
elif [[ "$COURSE_PATH" == /* ]]; then
    echo "Error: Absolute paths must be under $COURSE_BASE_PATH"
    exit 1
fi

# Ensure the systemd user service is started
systemctl --user start liascript-editor.service

# Wait for the service to be fully started
sleep 2

# Launch Chromium in app mode with custom profile
chromium \
    --app="https://localhost:9000/?/tutor/${COURSE_PATH}" \
    --user-data-dir="$HOME/.local/share/liascript-editor" \
    --no-first-run
