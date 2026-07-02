@echo off
cd /d "%~dp0"
set /p msg="Was hast du geaendert? "
git add .
git commit -m "%msg%"
git push
echo.
echo Fertig! Aenderungen hochgeladen.
pause
