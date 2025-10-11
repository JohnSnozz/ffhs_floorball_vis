# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a floorball shot data visualization and analysis dashboard. It's a web application that imports CSV shot data into a SQLite database and visualizes it using D3.js with hexagonal binning on a floorball court. Features include CSV import, duplicate detection, game management, shot map visualization with success rate heatmaps, and database persistence. The application runs in the browser using sql.js for SQLite operations, with a Bun backend for file serving and API endpoints.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
bun run dev
# or
bun run start
# or
bun run serve
```

All commands use the same Bun-based development server (`server.js`).

**IMPORTANT - Server Management:**
- DO NOT automatically start the Bun server
- The user prefers to start the server manually
- Only provide the commands if asked, but do not execute them
- If testing is needed, ask the user to start the server first

## Architecture Overview

### Application Structure

The application follows a single-file, class-based architecture:

- **FloorballApp** (app.js): Main application class containing all functionality including:
  - Database initialization and management (SQL.js)
  - CSV parsing and validation
  - Data import with duplicate detection
  - D3.js visualization with hexagonal binning
  - Tab navigation between Import and Dashboard views
  - Event handling and UI updates
  - Server communication for database persistence and logging
- **server.js**: Bun-based HTTP server with API endpoints and static file serving

### Key Architectural Patterns

1. **Monolithic Structure**: All application logic in single `app.js` file (1200+ lines)
2. **Client-side Database**: Uses sql.js to run SQLite entirely in browser
3. **Persistence Strategy**: Database file is saved to server via `/api/save-database` endpoint to `./floorball_data.sqlite`
4. **Visualization**: D3.js v7 with d3-hexbin for shot map with success rate heatmaps
5. **Coordinate System**: Converts polar coordinates (distance, angle) from CSV to cartesian (x, y) for visualization

### Database Schema

Two main tables with foreign key relationship:
- **games**: Stores game metadata (id, name, date, created_at)
- **shots**: Stores shot data with 31 fields including player positions, shot metrics, and game state
- Relationship: One game has many shots (shots.game_id → games.id)

See `docs/database_uml.md` for complete schema details.

### Development Server (server.js)

The Bun server provides:
- Static file serving from project root directory
- **POST /api/save-database**: Saves uploaded SQLite database to `./floorball_data.sqlite`
- **POST /api/debug-log**: Receives client debug logs and writes to `logs/YYYY-MM-DD-debug.log`
- CORS headers enabled for all endpoints
- Environment variable support via `.env` file

### Application Workflow

**Import Tab:**
1. User uploads CSV file via file selector
2. CSV is parsed and validated for required columns
3. Preview shows first 10 rows
4. User enters game name and date
5. System checks for existing game with same name/date
6. Import creates/uses game and inserts shots
7. Database is saved to server via `/api/save-database`

**Dashboard Tab:**
1. User selects a game from dropdown
2. Shot data is loaded from database
3. Shot map is rendered with D3.js:
   - Hexagonal binning groups nearby shots
   - Color represents success rate (goals/shots)
   - Size represents number of shots
   - Background shows floorball court image
4. Tooltip shows detailed stats on hover

## Code Style Requirements

**CRITICAL - NO LLM SIGNATURES:**
- NO EMOJIS in code, comments, or documentation
- Minimal comments - code should be self-explanatory
- Avoid verbose or overly enthusiastic language
- No excessive explanatory comments
- Keep functions small and focused

**Naming Conventions:**
- JavaScript: camelCase for variables/functions, PascalCase for classes
- CSS: kebab-case for files and class names

### Script Loading Order (in index.html)

1. D3.js v7
2. d3-hexbin plugin
3. SQL.js (CDN)
4. app.js (main application)

All script tags are in `<head>` with defer behavior.

## Working with the Codebase

### Adding New Features

When adding functionality:
- All code is currently in `app.js` as a monolithic FloorballApp class
- Add new methods to the FloorballApp class
- Consider refactoring if file becomes too large (currently 1200+ lines)
- CSS is in single `styles.css` file

### Database Operations

The FloorballApp class manages database directly:
- `this.db.exec()` for queries
- `this.db.run()` for inserts/updates
- Call `saveDatabaseToFile()` after modifications
- Database schema has `games` and `shots` tables with foreign key relationship

### Logging

Debug logging via `debugLog()` function:
- Sends logs to `/api/debug-log` endpoint
- Server writes to `logs/YYYY-MM-DD-debug.log`
- Also logs to browser console

## Important Notes

- This is a static web application with no build step
- Static files are served from project root directory
- The application loads existing database file on startup: `./floorball_data.sqlite`
- Shot map uses polar to cartesian coordinate conversion (distance + angle → x, y)
- Floorball court dimensions: 40m × 20m, scaled 15x for visualization
- Background image: `public/images/field.png`
- Hexagonal binning fallback: scatter plot if d3-hexbin unavailable
- Database schema: `games` table (game_id, game_name, game_date, team1, team2) and `shots` table (31 fields)
- Game matching is case-insensitive with trimmed whitespace
