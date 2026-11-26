@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:4180/
python -m http.server 4180 --bind 127.0.0.1
