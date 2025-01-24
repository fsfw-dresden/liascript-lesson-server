#!/bin/bash

# Exit on error
set -e

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "Please don't run as root"
    exit 1
fi

echo "Installing build dependencies..."
sudo apt-get update
sudo apt-get install -y debhelper nodejs npm

echo "Building Debian package..."
dpkg-buildpackage -us -uc -b

echo "Package built successfully!"
echo "You can find the .deb file in the parent directory"
echo "To install it, run: sudo dpkg -i ../liascript-editor_*.deb"
