# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL INSTRUCTIONS - READ FIRST

### Project Architecture: Modular Design

**⚠️ MOST IMPORTANT RULE:**

When adding new features, visualizations, or dashboard components:
- **ALWAYS create a new module file** in `public/js/`
- **NEVER add large features directly to `app.js`**
- Keep `app.js` as a lean orchestrator (currently 797 lines)

**app.js should only contain:**
- Module initialization
- Shared state management
- Tab navigation
- High-level orchestration
- Small utility functions

See `docs/DEVELOPMENT.md` for detailed guidelines on adding features.

---

## Quick Reference

### Development Server
```bash
bun run dev    # Starts on http://localhost:3000
```

**IMPORTANT:**
- DO NOT automatically start the server
- User prefers to start manually
- Only provide commands if asked

### Project Structure
```
public/
├── css/                # 7 CSS files
├── js/                 # 10 JavaScript modules
└── images/             # field.png, field_inverted.png

app.js                  # Main orchestrator (797 lines)
server.js               # Bun backend
index.html              # Main HTML
docs/                   # Full documentation
  ├── ARCHITECTURE.md   # Complete architecture overview
  ├── DEVELOPMENT.md    # Development guidelines
  └── DATABASE.md       # Database schema
```

### Current Modules (10)

1. **database.js** - DatabaseManager class (all DB operations)
2. **dashboard-sidebar.js** - DashboardSidebar class (filters, controls)
3. **shothistogram.js** - ShotHistogram class (xG histograms)
4. **performancespider.js** - PerformanceSpider class (radar chart)
5. **goalkeeperstats.js** - GoalkeeperStats class (wrapper)
6. **gkhistogram.js** - GoalkeeperHistogram class (GK viz)
7. **shotmap.js** - ShotMap class (hexbin visualization)
8. **corrections.js** - Corrections class (data corrections)
9. **csvimport.js** - CSVImport class (CSV import)
10. **dev-grid.js** - Dev grid overlay

---

## Module Pattern (MANDATORY for new features)

```javascript
// public/js/myfeature.js
class MyFeature {
    constructor(app) {
        this.app = app;           // Access to main app
        this.myState = null;      // Module-specific state
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Bind DOM elements
    }

    // Feature methods...
}

window.MyFeature = MyFeature;
```

**Integration:**
1. Add script to `index.html`: `<script src="public/js/myfeature.js" defer></script>`
2. Initialize in `app.js`: `this.myFeature = new MyFeature(this);`

---

## Complete Documentation

**For detailed information, see:**

- **`docs/ARCHITECTURE.md`** - Complete system architecture, data flow, all modules
- **`docs/DEVELOPMENT.md`** - Step-by-step development guide, examples, patterns
- **`docs/DATABASE.md`** - Database schema, tables, relationships

---

## Key Technologies

- **Frontend:** Vanilla JavaScript (ES6 classes)
- **Visualization:** D3.js v7, d3-hexbin
- **Database:** SQL.js (SQLite in browser)
- **Backend:** Bun server
- **Styling:** Modular CSS (7 files in `public/css/`)

---

## Database Operations

**Always use DatabaseManager:**

```javascript
// In any module
const data = await this.app.dbManager.loadGameData(gameId);
await this.app.dbManager.saveCorrection(shotId, field, value);
```

**Key Tables:**
- `games` - Game metadata
- `shots` - Shot data (31 fields)
- `shot_corrections` - Corrections
- `game_aliases` - Display names
- `shots_view` - View combining shots + corrections

---

## Server Endpoints

**Backend API:**
- `POST /api/save-database` - Save SQLite database to `./floorball_data.sqlite`
- `POST /api/debug-log` - Write logs to `dev/logs/YYYY-MM-DD-debug.log`

---

## Development Workflow

### Adding a New Visualization

1. Create `public/js/myviz.js` with class pattern
2. Add HTML container in `index.html`
3. Add styles in `public/css/visualizations.css`
4. Add script tag to `index.html`
5. Initialize in `app.js` → `initializeApp()`
6. Call from `app.js` → `createCharts()`

**See `docs/DEVELOPMENT.md` for complete examples.**

---

## Code Style Requirements

**NO LLM SIGNATURES:**
- NO EMOJIS in code, comments, or documentation
- Minimal comments - code should be self-explanatory
- Avoid verbose or overly enthusiastic language
- Keep functions small and focused

**Naming Conventions:**
- JavaScript: camelCase for variables/functions, PascalCase for classes
- CSS: kebab-case for files and class names

---

## Important Notes

- Static web app, no build step
- Database persists to `./floorball_data.sqlite`
- Field image: `public/images/field.png` (600x1200px)
- Court dimensions: 40m × 20m, scaled 30x for visualization
- Coordinate conversion: polar (distance, angle) → cartesian (x, y)
- All logs: `dev/logs/` (gitignored)
- Script loading: D3.js → d3-hexbin → SQL.js → modules → app.js

---

## Debugging

```javascript
// Browser console
window.floorballApp                    // Access main app
window.floorballApp.currentGameData    // Current data
window.floorballApp.shotMap            // Access any module

// Debug logs
debugLog('Message', { data: value });  // Writes to dev/logs/
```

---

## Common Mistakes to Avoid

❌ **DON'T:**
- Add large features to `app.js`
- Access database directly: `this.app.dbManager.db.exec(...)`
- Modify shared state: `this.app.currentGameData = ...`
- Mix module concerns

✅ **DO:**
- Create new module files for features
- Use DatabaseManager methods
- Call app methods for state changes
- Keep modules independent

---

## Quick Examples

### Access Shared Data
```javascript
const data = this.app.currentGameData;
const gameId = this.app.currentGameId;
const shooter = this.app.selectedShooter;
```

### Call Other Modules
```javascript
this.app.shotMap.toggleHeatmap(true);
this.app.dashboardSidebar.applyFilters();
```

### Database Operations
```javascript
await this.app.dbManager.loadGameData(gameId);
await this.app.dbManager.saveCorrection(shotId, field, value);
```

---

## For More Information

**Full details in documentation:**
- Architecture overview: `docs/ARCHITECTURE.md`
- Development guide: `docs/DEVELOPMENT.md`
- Database schema: `docs/DATABASE.md`

**When in doubt:** Follow existing module patterns in `public/js/`
