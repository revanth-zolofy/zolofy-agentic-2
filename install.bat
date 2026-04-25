@echo off
setlocal enabledelayedexpansion
set "NODE_PATH=C:\Users\Capt Syki\scoop\apps\nodejs-lts\current"
set "PATH=!NODE_PATH!;!NODE_PATH!\node_modules\.bin;%PATH%"
cd /d "D:\zolofy-agentic"
"!NODE_PATH!\node.exe" "!NODE_PATH!\node_modules\npm\bin\npm-cli.js" install "@anthropic-ai/sdk" convex jose "@upstash/redis"
