#!/bin/bash

# Script to revert responsive changes
echo "Reverting responsive scaling changes..."

# Restore original base.css if backup exists
if [ -f "public/css/base.css.backup" ]; then
    echo "Restoring original base.css..."
    cp public/css/base.css.backup public/css/base.css
fi

# Remove responsive files
echo "Removing responsive files..."
rm -f public/css/responsive-scale.css
rm -f public/css/responsive-viewport.css
rm -f public/css/responsive-zoom.css
rm -f public/js/responsive-scale.js
rm -f public/js/responsive-patch.js
rm -f public/js/responsive-zoom.js
rm -f public/js/responsive-manager.js
rm -f test-responsive.html
rm -f test-zoom.html

echo "Done! You'll need to manually remove the script reference from index.html:"
echo "  - Look for: <script src=\"public/js/responsive-manager.js\" defer></script>"
echo "  - Remove that line to fully disable responsive scaling"