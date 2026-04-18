@echo off
REM ============================================================
REM GeoSmart - Complete Database Setup for Windows
REM EDIT LINE 9: put your PostgreSQL password
REM Then double-click this file OR run it in VS Code terminal
REM ============================================================

set PGPASSWORD=postgres

echo.
echo  ========================================
echo   GeoSmart Database Setup
echo  ========================================
echo.

echo [Step 1] Dropping old database if exists...
psql -U postgres -c "DROP DATABASE IF EXISTS geosmart;"

echo [Step 2] Creating database...
psql -U postgres -c "CREATE DATABASE geosmart;"
if errorlevel 1 (
    echo.
    echo  ERROR: Cannot connect to PostgreSQL!
    echo  Make sure PostgreSQL is running and the
    echo  password on line 9 of this file is correct.
    echo.
    pause
    exit /b 1
)

echo [Step 3] Enabling PostGIS...
psql -U postgres -d geosmart -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -d geosmart -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"

echo [Step 4] Running 01_schema.sql...
psql -U postgres -d geosmart -f "database\migrations\01_schema.sql"
if errorlevel 1 ( echo ERROR in 01_schema.sql & pause & exit /b 1 )

echo [Step 5] Running 02_stored_procedures.sql...
psql -U postgres -d geosmart -f "database\functions\02_stored_procedures.sql"
if errorlevel 1 ( echo ERROR in 02_stored_procedures.sql & pause & exit /b 1 )

echo [Step 6] Running 03_spatial_tables.sql...
psql -U postgres -d geosmart -f "database\migrations\03_spatial_tables.sql"
if errorlevel 1 ( echo ERROR in 03_spatial_tables.sql & pause & exit /b 1 )

echo [Step 7] Running 04_triggers.sql...
psql -U postgres -d geosmart -f "database\triggers\04_triggers.sql"
if errorlevel 1 ( echo ERROR in 04_triggers.sql & pause & exit /b 1 )

echo [Step 8] Running 05_seed_data.sql...
psql -U postgres -d geosmart -f "database\seeds\05_seed_data.sql"
if errorlevel 1 ( echo ERROR in 05_seed_data.sql & pause & exit /b 1 )

echo.
echo  ========================================
echo   SUCCESS! Verifying data...
echo  ========================================
psql -U postgres -d geosmart -c "SELECT (SELECT COUNT(*) FROM business) AS businesses, (SELECT COUNT(*) FROM zone) AS zones, (SELECT COUNT(*) FROM road) AS roads;"
echo.
echo  Database is ready!
echo  Next steps:
echo    1. cd backend
echo    2. copy .env.example .env   (then edit the password)
echo    3. npm install
echo    4. npm run dev
echo.
pause
