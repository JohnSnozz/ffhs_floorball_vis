# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a floorball shot data visualization and import system. It's a client-side web application that imports CSV shot data into a SQLite database, with support for duplicate detection, game management, and data export. The application runs entirely in the browser using sql.js for SQLite operations.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
bun run dev
# or
bun run start
# or
bun run serve
```

All commands use the same Bun-based development server (`dev-server.js`).

## Architecture Overview

### Application Structure

The application follows a modular, class-based architecture:

- **ShotDataImporter** (app.js): Main application coordinator, handles CSV upload and import workflow
- **DatabaseManager** (modules/database.js): SQLite database operations, table creation, and data persistence
- **UIManager** (modules/ui-handlers.js): DOM manipulation and user interface updates
- **CSVParser** (utils/csv-parser.js): CSV parsing and data transformation
- **DuplicateChecker** (utils/duplicate-checker.js): Duplicate shot detection logic
- **Logger** (utils/logger.js): Logging system that sends logs to backend
- **DownloadManager** (modules/download-manager.js): Database export functionality

### Key Architectural Patterns

1. **Module Separation**: Core logic in `modules/`, utility functions in `utils/`, main coordinator in `app.js`
2. **Client-side Database**: Uses sql.js to run SQLite entirely in browser
3. **Persistence Strategy**: Database file is saved to server via `/api/save-database` endpoint and also downloadable to user's machine
4. **Duplicate Detection**: Compares incoming CSV data against existing database entries by matching time, shooter, distance, and angle

### Database Schema

Two main tables with foreign key relationship:
- **games**: Stores game metadata (id, name, date, created_at)
- **shots**: Stores shot data with 31 fields including player positions, shot metrics, and game state
- Relationship: One game has many shots (shots.game_id → games.id)

See `docs/database_uml.md` for complete schema details.

### Development Server (dev-server.js)

The Bun server provides:
- Static file serving from `public/` directory
- **POST /api/save-database**: Saves uploaded SQLite database to `public/assets/shots_database.sqlite`
- **POST /api/log**: Receives client logs and writes to `logs/YYYY-MM-DD-app.log`
- CORS headers enabled for all endpoints

### Import Workflow

1. User uploads CSV file via drag-and-drop or file selector
2. CSV is parsed and previewed with basic statistics
3. User enters game name and date
4. System checks for existing game with same name/date
5. Duplicate detection runs comparing CSV shots against existing database shots
6. User confirms import (skipping duplicates)
7. New game is created (if needed) or existing game is used
8. Unique shots are inserted in batch
9. Database is saved both to server and offered as download

## Code Quality Standards (MANDATORY)

### File Organization Rules

**JavaScript Files:**
- Maximum 200 lines per file - split into logical modules if exceeded
- Single responsibility per file
- Naming: `kebab-case.js` with descriptive suffixes (-manager, -parser, -validator)
- Structure: `modules/` for core logic, `utils/` for pure functions, `app.js` as coordinator

**CSS Files:**
- Maximum 150 lines per file - create new files for distinct features
- Logical grouping: `main.css` for base styles, `components.css` for reusable UI, `[feature].css` for specific features
- No inline styles - all CSS must be in external files

### Code Style Requirements

**CRITICAL - NO LLM SIGNATURES:**
- NO EMOJIS in code, comments, or documentation (except in user-facing UI strings if absolutely necessary)
- Minimal comments - code should be self-explanatory
- Avoid verbose or overly enthusiastic language
- No excessive explanatory comments
- Keep functions small and focused
- Avoid unnecessary abstractions

**Naming Conventions:**
- JavaScript: camelCase for variables/functions, PascalCase for classes
- CSS: kebab-case for files and class names
- File names: descriptive and specific (not generic like styles.css or helpers.js)

### Script Loading Order (in index.html)

1. External libraries (sql.js)
2. Core modules (database.js)
3. Utilities (csv-parser.js, logger.js, duplicate-checker.js)
4. Feature modules (download-manager.js, ui-handlers.js)
5. Main application (app.js)

All script tags should be before closing `</body>` tag.

## Working with the Codebase

### Adding New Features

When adding functionality, follow these patterns:
- Create new module files if adding 5+ related functions or distinct responsibility
- Place pure utility functions in `utils/` directory
- Place business logic and stateful classes in `modules/` directory
- Update main coordinator in `app.js` to integrate new modules
- Add new CSS files for distinct UI features (not in existing files)

### Database Operations

- Always use DatabaseManager class methods (never direct SQL in app.js)
- Use batch operations for multiple inserts (`insertShotsInBatch`)
- Call `saveDatabase()` after any data modifications
- Check for existing games before creating new ones using `checkGameExists()`

### Logging

Use the Logger utility for tracking operations:
- `Logger.import()` for import operations
- `Logger.database()` for database operations
- `Logger.error()` for error tracking

Logs are sent to server and saved to daily log files in `logs/` directory.

## Important Notes

- This is a static web application with no build step
- All paths in HTML are relative to `public/` directory
- The application loads an existing database file on startup if available (`public/assets/shots_database.sqlite`)
- Duplicate detection uses a composite key of: time + shooter + distance + angle
- Game matching is case-insensitive with trimmed whitespace
