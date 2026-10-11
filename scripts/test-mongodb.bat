@echo off
echo.
echo ========================================
echo   MongoDB Connection Test Helper
echo ========================================
echo.
echo Your Current IP: 154.198.115.45
echo.
echo Instructions:
echo 1. Go to: https://cloud.mongodb.com
echo 2. Click "Network Access" (left sidebar)
echo 3. Click "+ ADD IP ADDRESS"
echo 4. Add: 154.198.115.45 OR 0.0.0.0/0
echo 5. Wait 1-2 minutes
echo.
echo ========================================
echo.
echo Press any key to test connection...
pause > nul

node scripts/test-all-connections.js

echo.
echo ========================================
echo.
echo If connection still fails:
echo - Check if MongoDB Atlas cluster is active (not paused)
echo - Verify username/password in .env file
echo - Try creating a new cluster
echo.
pause
