# Floorball Visualization Dashboard - Architecture

## Project Overview

This is a floorball shot data visualization and analysis dashboard built with vanilla JavaScript, D3.js, and SQL.js for client-side database operations.

**Last Updated:** November 2025
**App.js Line Count:** 797 lines (reduced from 5,529 lines - 85.6% reduction)

---

## Project Structure

```
ffhs_floorball_vis/
├── index.html              # Main dashboard HTML
├── app.js                  # Main orchestrator (797 lines)
├── server.js               # Bun backend server
├── package.json            # Dependencies
├── floorball_data.sqlite   # SQLite database
│
├── public/                 # Frontend assets
│   ├── css/                # Stylesheets (7 files)
│   │   ├── base.css
│   │   ├── dashboard.css
│   │   ├── visualizations.css
│   │   ├── goalkeeper.css
│   │   ├── import.css
│   │   ├── corrections.css
│   │   └── dev-tools.css
│   │
│   ├── js/                 # JavaScript modules (10 files)
│   │   ├── database.js           # DatabaseManager class
│   │   ├── dashboard-sidebar.js  # DashboardSidebar class
│   │   ├── shothistogram.js      # ShotHistogram class
│   │   ├── performancespider.js  # PerformanceSpider class
│   │   ├── goalkeeperstats.js    # GoalkeeperStats wrapper
│   │   ├── gkhistogram.js        # GoalkeeperHistogram class
│   │   ├── shotmap.js            # ShotMap class
│   │   ├── corrections.js        # Corrections class
│   │   ├── csvimport.js          # CSVImport class
│   │   └── dev-grid.js           # Dev grid overlay
│   │
│   └── images/             # Static images
│       ├── field.png
│       └── field_inverted.png
│
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md     # This file
│   ├── DEVELOPMENT.md      # Development guide
│   └── DATABASE.md         # Database schema
│
├── exampledata/            # CSV test data
│
└── dev/ (gitignored)       # Development files
    ├── logs/               # Debug logs
    ├── refactor-backup/    # Old code versions
    ├── screenshots/        # Project screenshots
    ├── projektidee/        # Planning documents
    └── example_vis/        # Visualization examples
```

---

## Architecture Pattern

### Modular Class-Based Design

All functionality is separated into **independent modules** that are initialized by the main `app.js` orchestrator.

**Pattern:**
```javascript
// Each module is a class with constructor(app)
class ModuleName {
    constructor(app) {
        this.app = app;  // Access to main app
        this.setupEventListeners();
    }

    // Module methods...
}

window.ModuleName = ModuleName;
```

**Initialization in app.js:**
```javascript
async initializeApp() {
    this.dbManager = new DatabaseManager();
    this.dashboardSidebar = new DashboardSidebar(this);
    this.shotHistogram = new ShotHistogram(this);
    this.performanceSpider = new PerformanceSpider(this);
    this.goalkeeperStats = new GoalkeeperStats(this);
    this.shotMap = new ShotMap(this);
    this.corrections = new Corrections(this);
    this.csvImport = new CSVImport(this);
}
```

---

## Module Responsibilities

### 1. **app.js** (797 lines) - Main Orchestrator
**Role:** Coordinates all modules, manages app state, handles tab navigation

**Key Responsibilities:**
- Initialize all modules
- Manage shared state (`currentGameData`, `currentGameId`, `selectedShooter`)
- Handle tab navigation
- Load games list
- Coordinate chart creation
- Game alias management
- Utility: `calculateCoordinates()`, `showStatus()`

**Important:** `app.js` should remain lean. New features should be separate modules.

---

### 2. **public/js/database.js** - DatabaseManager
**Role:** All database operations and persistence

**Key Methods:**
- `initialize()` - Load SQL.js and initialize DB
- `migrateDatabase()` - Schema updates
- `createOrUpdateViews()` - Creates `shots_view` (shots + corrections)
- `saveDatabaseToFile()` - Upload DB to server
- `loadGamesList()` - Fetch all games
- `loadGameData(gameId)` - Load shots for game
- `loadCorrectionsForGame(gameId)` - Load corrections data
- `saveCorrection()`, `deleteCorrection()` - Correction operations
- `saveGameAlias()`, `loadGameAlias()` - Game alias operations

**Database Schema:** See `docs/DATABASE.md`

---

### 3. **public/js/dashboard-sidebar.js** - DashboardSidebar
**Role:** Dashboard filters and controls

**Key Methods:**
- `setupGameSelector()` - Game dropdown
- `setupFilterToggleButtons()` - Result/Type/Turnover filters
- `setupVisualizationControls()` - Show/Hide heatmap and shot dots
- `populateFilters(data)` - Fill shooter dropdown
- `applyFilters()` - Apply all filters and trigger chart updates

**HTML Elements:**
- `#selected-game` - Game selector
- `#filter-shooter` - Shooter multi-select
- `.result-filter`, `.type-filter` - Toggle buttons
- `#toggle-shot-dots`, `#toggle-heatmap` - Viz controls

---

### 4. **public/js/shotmap.js** - ShotMap
**Role:** Main shot map visualization with hexbin heatmaps

**Size:** 68KB, 22 functions

**Key Methods:**
- `createShotMap(data, onFieldData)` - Main orchestrator
- `createHexbinHeatmap()` - D3 hexbin heatmap
- `createSplitViewHexbins()` - Player vs Team comparison
- `drawFloorballCourt()` - Court lines and zones
- `toggleShotDots()`, `toggleHeatmap()` - Show/hide layers
- `highlightHexbinsByXGRange()` - Highlight from histogram hover

**Visualizations:**
- Hexagonal binning with color-coded success rates
- Player vs Team split view
- Shot scatter points overlay
- Field background image: `public/images/field.png`

---

### 5. **public/js/shothistogram.js** - ShotHistogram
**Role:** xG histograms for offensive/defensive performance

**Key Methods:**
- `createXGHistograms(data, fieldWidth, fieldHeight, margin)` - Both histograms
- `drawXGHistogram()` - Individual histogram rendering
- `updateXGHistogramsWithPlayer()` - Player overlay on team data
- `addPlayerOverlay()`, `clearPlayerOverlay()` - Player bars

**HTML Elements:**
- `#shothistogram-for` - Offensive xG
- `#shothistogram-against` - Defensive xG

**Integration:** Interacts with `performanceSpider` and `shotMap` for coordinated views

---

### 6. **public/js/performancespider.js** - PerformanceSpider
**Role:** Radar chart for multi-dimensional performance metrics

**Key Methods:**
- `createSpiderDiagram()` - D3 radar chart
- `calculateSpiderMetrics()` - Compute 8 metrics
- `normalizeSpiderValue()` - 0-100 normalization

**Metrics:**
1. Blocked %
2. Missed %
3. Saved %
4. Goal %
5. Corsi
6. Fenwick
7. xG Differential
8. xSOG Differential

---

### 7. **public/js/goalkeeperstats.js** - GoalkeeperStats
**Role:** Wrapper to update goalkeeper visualizations

**Key Methods:**
- `updateGoalkeeperHistogram()` - Load all games data and pass to gkhistogram.js

**Integration:** Works with `gkhistogram.js` (external implementation)

---

### 8. **public/js/gkhistogram.js** - GoalkeeperHistogram
**Role:** Goalkeeper-specific histogram and dumbbell chart

**Key Methods:**
- `setData(currentGameData, allGamesData)` - Receive data
- `getGoalkeeperShots()` - Filter shots for goalkeepers
- `updateHistogram()` - Render goalkeeper performance
- `updateGoalkeeperList()` - Populate GK dropdown

**HTML Elements:**
- `#goalkeeper-select` - GK selector
- `#goalkeeper-histogram` - Histogram visualization
- `#goalkeeper-dumbbell` - Dumbbell chart

---

### 9. **public/js/corrections.js** - Corrections
**Role:** Shot data corrections interface

**Size:** 574 lines

**Key Methods:**
- `loadCorrectionsGamesList()` - Populate game dropdown
- `loadCorrectionsForGame(gameId)` - Load shots with corrections
- `renderCorrectionsTable()` - Generate editable table
- `saveCorrection()`, `deleteCorrection()` - CRUD operations
- `sortCorrectionsTable()`, `applyCorrectionsFilters()` - Table interactions

**HTML Elements:**
- `#corrections-game-select` - Game selector
- `#corrections-table-container` - Corrections table
- `#game-alias-input`, `#save-alias-btn` - Game alias

---

### 10. **public/js/csvimport.js** - CSVImport
**Role:** CSV file import with duplicate detection

**Size:** 473 lines

**Key Methods:**
- `handleFileSelect()` - File upload
- `parseCSV()`, `parseCSVLine()` - CSV parsing
- `validateCSVStructure()` - Header validation
- `showCSVPreview()` - Preview table
- `generateShotHash()` - Duplicate detection
- `importData()` - Import with duplicate checking

**HTML Elements:**
- `#csv-file` - File input
- `#game-name`, `#game-date` - Game metadata
- `#import-btn` - Import button
- `#csv-preview` - Preview container

---

## Data Flow

### 1. App Initialization
```
User loads page
  → DOM Content Loaded
  → new FloorballApp()
  → initializeApp()
    → DatabaseManager.initialize() - Load SQL.js, load/create DB
    → Initialize all modules (each gets `this` as app reference)
    → setupTabs() - Tab navigation
    → loadGamesList() - Populate game dropdowns
```

### 2. Game Selection
```
User selects game
  → DashboardSidebar.setupGameSelector() event
  → app.loadGameData(gameId)
    → dbManager.loadGameData(gameId) - Query shots_view
    → Store in app.currentGameData
    → dashboardSidebar.populateFilters(data) - Fill shooter dropdown
    → goalkeeperStats.updateGoalkeeperHistogram() - Update GK viz
    → dashboardSidebar.applyFilters() - Apply current filters
```

### 3. Filter Application
```
User changes filters
  → DashboardSidebar.applyFilters()
    → Read all filter states (results, types, shooters)
    → Filter app.currentGameData
    → app.createCharts(filteredData, teamFilteredData)
      → shotMap.createShotMap()
      → shotHistogram.createXGHistograms()
      → performanceSpider.createSpiderDiagram()
```

### 4. CSV Import
```
User uploads CSV
  → CSVImport.handleFileSelect()
    → parseCSV() - Parse file
    → validateCSVStructure() - Check headers
    → showCSVPreview() - Display preview
  → User clicks import
  → CSVImport.importData()
    → generateShotHash() for each shot - Duplicate detection
    → Insert into database (game + shots)
    → dbManager.saveDatabaseToFile() - Persist to server
    → app.loadGamesList() - Refresh game list
```

### 5. Corrections
```
User opens Corrections tab
  → Corrections.loadCorrectionsForGame(gameId)
    → dbManager.loadCorrectionsForGame(gameId)
    → renderCorrectionsTable() - Editable table
  → User edits shot data
  → Corrections.saveCorrection(shotId)
    → dbManager.saveCorrection() - INSERT/UPDATE shot_corrections
    → dbManager.saveDatabaseToFile() - Persist
```

---

## Key Technologies

- **Frontend:** Vanilla JavaScript (ES6 classes)
- **Visualization:** D3.js v7, d3-hexbin
- **Database:** SQL.js (SQLite in browser)
- **Backend:** Bun server (file serving + API endpoints)
- **Styling:** Modular CSS (7 files)

---

## Important Principles

### 1. Module Independence
Each module should be self-contained with its own event listeners and state.

### 2. Communication via App Instance
Modules communicate through `this.app`:
```javascript
// Access other modules
this.app.shotMap.toggleHeatmap(true);

// Access shared state
const data = this.app.currentGameData;

// Access database
this.app.dbManager.saveCorrection(...);
```

### 3. Keep app.js Lean
`app.js` is the orchestrator. New features = new modules in `public/js/`.

### 4. Module Pattern
All modules follow the same pattern:
```javascript
class ModuleName {
    constructor(app) {
        this.app = app;
        // Module-specific state
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Bind to DOM elements
    }

    // Public methods
}

window.ModuleName = ModuleName;
```

---

## Adding New Features

**CRITICAL RULE:** Always create a new module file for new features. Never add large features directly to `app.js`.

See `docs/DEVELOPMENT.md` for detailed guidelines.
