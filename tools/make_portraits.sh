#!/bin/sh
# Re-render the start-screen pictures of Austin and Bre (run after changing how they look).
cd "$(dirname "$0")/.."
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for k in austin bre; do
  "$CH" --headless=new --disable-gpu-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --default-background-color=00000000 \
    --window-size=300,400 --virtual-time-budget=4000 --screenshot="images/couple-$k.png" "http://localhost:8125/tools/portrait.html?kind=$k" 2>/dev/null
done
ls -la images/couple-*.png
