@echo off
echo Starting Mailpit with persistent database storage...

:: Change to the directory of this batch file
cd /d "%~dp0"

:: Start Mailpit (stores emails in mailpit.db)
.\mailpit.exe --database .\mailpit.db

pause
