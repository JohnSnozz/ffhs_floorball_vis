# Floorball Visualization Dashboard - Codebase Documentation

## Project Overview

A web-based floorball shot data visualization and analysis dashboard. Users can import CSV files of shot data, which are stored in a SQLite database and visualized using D3.js with hexagonal binning on a floorball court representation.

**Tech Stack:**
- Frontend: Vanilla JavaScript (ES6), D3.js v7, d3-hexbin
- Database: SQL.js (SQLite running in browser)
- Backend: Bun HTTP server (file serving + API endpoints)
- Styling: Pure CSS

**Key Features:**
- CSV import with duplicate detection
- Game management
- Shot map visualization with success rate heatmaps
- xG (expected goals) histograms
- Player-specific filtering and analysis
- Database persistence to server
- Shot data corrections interface

---

## File Structure

```
ffhs_floorball_vis/
├── index.html              # Main HTML structure
├── styles.css              # All styling
├── app.js                  # Main application logic (4817 lines)
├── server.js               # Bun backend server
├── floorball_data.sqlite   # SQLite database file
├── js/
│   └── modules/
│       ├── utils.js        # Utility functions ✅
│       └── csvImport.js    # CSV import logic ✅
├── public/
│   └── images/
│       └── field.png       # Floorball court background
├── logs/                   # Debug logs (YYYY-MM-DD-debug.log)
└── docs/
    └── database_uml.md     # Database schema documentation
```

---

## Database Schema

### Tables

**1. games**
```sql
game_id INTEGER PRIMARY KEY AUTOINCREMENT
game_name TEXT NOT NULL
game_date TEXT NOT NULL
team1 TEXT NOT NULL
team2 TEXT NOT NULL
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

**2. shots**
```sql
shot_id INTEGER PRIMARY KEY AUTOINCREMENT
game_id INTEGER NOT NULL (FK → games.game_id)
date TEXT
team1 TEXT
team2 TEXT
time INTEGER                    -- Time in seconds
shooting_team TEXT
result TEXT                     -- Goal, Saved, Missed, Blocked, Possession -
type TEXT                       -- Direct, One-timer, Rebound, Turnover | Direct, etc.
xg REAL                         -- Expected goals (0-1)
xgot REAL                       -- Expected goals on target
shooter TEXT
passer TEXT
t1lw TEXT                       -- Team 1 Left Wing
t1c TEXT                        -- Team 1 Center
t1rw TEXT                       -- Team 1 Right Wing
t1ld TEXT                       -- Team 1 Left Defense
t1rd TEXT                       -- Team 1 Right Defense
t1g TEXT                        -- Team 1 Goalie
t1x TEXT                        -- Team 1 Extra player
t2lw TEXT                       -- Team 2 Left Wing
t2c TEXT                        -- Team 2 Center
t2rw TEXT                       -- Team 2 Right Wing
t2ld TEXT                       -- Team 2 Left Defense
t2rd TEXT                       -- Team 2 Right Defense
t2g TEXT                        -- Team 2 Goalie
t2x TEXT                        -- Team 2 Extra player
pp INTEGER                      -- Power play (0 or 1)
sh INTEGER                      -- Short handed (0 or 1)
distance REAL                   -- Shot distance in meters
angle REAL                      -- Shot angle in degrees
x_m REAL                        -- X coordinate in meters
y_m REAL                        -- Y coordinate in meters
x_graph REAL                    -- X coordinate for visualization (meters * 30)
y_graph REAL                    -- Y coordinate for visualization (meters * 30)
player_team1 INTEGER            -- Number of team1 players on field
player_team2 INTEGER            -- Number of team2 players on field
```

**3. shot_corrections**
```sql
shot_id INTEGER PRIMARY KEY (FK → shots.shot_id)
-- Contains same fields as shots table for corrections
-- Fields in this table override the original shot data
is_turnover INTEGER DEFAULT 0   -- Special flag for turnover shots
```

**4. shots_view (VIEW)**
- Combines shots and shot_corrections tables
- Uses COALESCE to show corrected data when available
- Handles special "Turnover | [Type]" formatting
- This is the primary view used for all data retrieval

---

## Application Architecture

### Main Class: FloorballApp

Located in `app.js`, this is a monolithic class (being modularized) containing all application logic.

**Key Properties:**
```javascript
this.db                         // SQL.js database instance
this.currentData                // Currently loaded CSV data
this.currentGameData            // Current game's shot data (unfiltered)
this.currentGameId              // Selected game ID ('all' or numeric)
this.currentTeamFilteredData    // Filtered by result/type (NOT by shooter)
this.selectedShooter            // Currently selected shooter name
this.team1FullData              // Background data for team1 histogram
this.team2FullData              // Background data for team2 histogram
```

**Lifecycle:**
1. `constructor()` - Initialize properties
2. `initializeApp()` - Main initialization
3. `initializeDatabase()` - Load/create SQLite database
4. `migrateDatabase()` - Apply schema migrations
5. `setupEventListeners()` - Bind UI events
6. `loadGamesList()` - Populate game dropdown

---

## Filter System Architecture

### Filter Types

The application has THREE types of filters that work together:

1. **Result Filters** (4 buttons)
   - Goal, Saved, Missed, Blocked
   - CSS class: `result-filter`
   - Data attribute: `data-value="Goal"` etc.

2. **Type Filters** (4 buttons)
   - Direct, One-timer, Rebound, Turnover
   - CSS class: `type-filter`
   - Data attribute: `data-value="Direct"` etc.
   - **Special:** Turnover can combine with Direct/One-timer ("Turnover | Direct")

3. **Shooter Filter** (multi-select dropdown)
   - ID: `filter-shooter`
   - Options: "All Shooters" or individual player names
   - Supports multiple selections

### Filter Flow Logic

**Important:** Filters are applied in a specific order and manner:

```javascript
applyFilters() {
    // 1. Get current filter selections
    selectedResults = ['Goal', 'Saved', ...] or []
    selectedTypes = ['Direct', 'One-timer', ...] or []
    selectedShooters = ['Player Name', ...] or []

    // 2. Start with unfiltered game data
    let teamFilteredData = this.currentGameData

    // 3. Apply RESULT filters
    if (selectedResults.length > 0) {
        teamFilteredData = filter by result
    }

    // 4. Apply TYPE filters with special Turnover logic
    if (selectedTypes.length > 0) {
        // Complex logic for Turnover combinations
        // If Turnover + Direct selected: includes "Direct" AND "Turnover | Direct"
        // If only Turnover selected: includes "Turnover | Direct" AND "Turnover | One-timer"
        teamFilteredData = filter by type
    }

    // 5. Store this for later use (histograms, opponent shots)
    this.currentTeamFilteredData = teamFilteredData

    // 6. Apply SHOOTER filter
    let filteredData = teamFilteredData
    if (selectedShooters.length > 0) {
        filteredData = filter by shooter
    }

    // 7. Store shooter selection state
    this.selectedShooter = (selectedShooters.length === 1) ? selectedShooters[0] : null

    // 8. Calculate opponent shots when player is defending
    if (this.selectedShooter) {
        onFieldData = opponent shots when this.selectedShooter is on field
    }

    // 9. Create visualizations
    await this.createCharts(filteredData, onFieldData)
}
```

### Critical Filter Behavior

**For Histograms (xG histograms on right side):**

1. **When NO shooter selected:**
   - Upper histogram: Team1 shots (filtered by result/type)
   - Lower histogram: Team2/opponents shots (filtered by result/type)

2. **When ONE shooter selected:**
   - Upper histogram: Selected shooter's shots (filtered by result/type)
   - Lower histogram: Opponent shots when this shooter is on field (filtered by result/type)
   - **White outline:** Shows ALL team shots (unfiltered) for context

3. **Special case - "All Games" mode:**
   - Team name is ALWAYS taken from `this.currentGameData` (unfiltered)
   - This prevents team order from changing when filters are applied
   - See line 3646-3650 in app.js

**For Shot Map (hexbin visualization):**

- Always shows filtered data
- Upper half: Offensive shots (shooter's shots or team shots)
- Lower half: Defensive shots (opponent shots when player on field)
- Filters apply to BOTH halves

### Filter Persistence

**When changing games:**
- Result and Type filters: PERSIST (stay selected)
- Shooter filter: PERSIST if shooter exists in new game, otherwise deselected
- See `populateFilters()` method at line 1108-1127

**Implementation:**
```javascript
populateFilters(data) {
    // Save current shooter selection
    const previouslySelected = Array.from(shooterSelect.selectedOptions)
        .map(opt => opt.value);

    // Rebuild dropdown with new game's shooters

    // Restore selection if shooter exists in new game
    shooters.forEach(shooter => {
        if (previouslySelected.includes(shooter)) {
            option.selected = true;
        }
    });
}
```

---

## Coordinate System

### Input: Polar Coordinates
- **Distance:** Meters from goal line
- **Angle:** Degrees from goal center

### Conversion to Cartesian
```javascript
calculateCoordinates(distance, angle) {
    const angleRad = angle * (Math.PI / 180);

    // Convert polar to cartesian
    const y_m = Math.sin(angleRad) * distance + 3.5;
    const x_m_old = 10 - Math.cos(angleRad) * distance;

    // Flip horizontally at 10m line
    const x_m = 20 - x_m_old;

    // Scale for visualization (30 pixels per meter)
    const x_graph = x_m * 30;
    const y_graph = y_m * 30;

    return { x_m, y_m, x_graph, y_graph };
}
```

**Field Dimensions:**
- 40m × 20m (2:1 aspect ratio)
- Visualization: 1200px × 600px (scaled 30x)
- Goal centered at (0, 3.5m)

---

## Data Flow

### 1. CSV Import Flow

```
User selects CSV file
    ↓
handleFileSelect() - reads file
    ↓
parseCSV() - parses text to structured data
    ↓
validateCSVStructure() - checks required columns
    ↓
showCSVPreview() - displays first 10 rows
    ↓
User clicks Import
    ↓
importData() - processes import
    ├─ Check for existing game
    ├─ Generate hashes for duplicate detection
    ├─ Insert new shots only
    ├─ Calculate coordinates
    └─ Save database to server
```

### 2. Visualization Flow

```
User selects game
    ↓
loadGameData(gameId)
    ├─ Load shots from database (shots_view)
    ├─ Store in this.currentGameData
    ├─ Call populateFilters()
    └─ Call applyFilters()
        ↓
applyFilters()
    ├─ Apply result filters
    ├─ Apply type filters
    ├─ Store in this.currentTeamFilteredData
    ├─ Apply shooter filter
    ├─ Calculate onFieldData (opponent shots)
    └─ Call createCharts(filteredData, onFieldData)
        ↓
createCharts()
    ├─ createShotMap() - hexbin visualization
    └─ createXGHistograms() - histograms
```

### 3. Histogram Display Logic

```
createXGHistograms(svg, data, ...)
    ↓
Determine data sources:
    If selectedShooter:
        team1Shots = shooter's shots (from filtered data)
        team1FullShots = ALL team shots (from currentGameData - for white outline)
        team2Shots = opponent shots when shooter on field (from currentTeamFilteredData)
        team2FullShots = ALL opponent shots (from currentGameData - for white outline)
    Else if currentGameId === 'all':
        Get team name from currentGameData (important!)
        team1Shots = team shots (from filtered data)
        team2Shots = opponent shots (from filtered data)
    Else (single game):
        team1Shots = team1 shots (from filtered data)
        team2Shots = team2 shots (from filtered data)
    ↓
Store background data:
    this.team1FullData = team1FullShots (for white outline)
    this.team2FullData = team2FullShots (for white outline)
    ↓
Draw histograms:
    drawXGHistogram(group, shots, ..., teamClass)
        ├─ Create bins by xG value (0-0.6 in 0.05 increments)
        ├─ Stack bars by result type (Goal, Saved, Missed, Blocked)
        ├─ If background data exists: draw white outline
        └─ Add average xG line
```

---

## Key Algorithms

### 1. Duplicate Detection

Uses a hash-based approach to prevent importing the same shot twice:

```javascript
generateShotHash(shotData) {
    // Normalize all values (trim, lowercase, standardize numbers)
    const parts = [
        date, team1, team2, time, shooting_team, result, type,
        xg, xgot, shooter, passer, distance, angle, pp, sh
    ];

    // Create hash string
    return parts.join('|').toLowerCase().replace(/\s+/g, '');
}

// During import:
existingHashes = Set(all existing shots' hashes)
for each CSV row:
    if existingHashes.has(hash):
        skip (duplicate)
    else:
        insert shot
```

### 2. Hexbin Aggregation

Uses d3-hexbin to group nearby shots into hexagons:

```javascript
const hexbin = d3.hexbin()
    .x(d => d.x_graph)
    .y(d => d.y_graph)
    .radius(hexRadius)
    .extent([[0, 0], [width, height]]);

const bins = hexbin(shotData);

bins.forEach(bin => {
    const goals = bin.filter(d => d.result === 'Goal').length;
    const total = bin.length;
    const successRate = goals / total;

    // Color by success rate
    const color = colorScale(successRate);
});
```

### 3. On-Field Filtering

For defensive analysis, finds shots where a player was on the field:

```javascript
const playerOnField = d.t1lw === playerName ||
                      d.t1c === playerName ||
                      d.t1rw === playerName ||
                      d.t1ld === playerName ||
                      d.t1rd === playerName ||
                      d.t1g === playerName ||
                      d.t1x === playerName;

const isOpponentShot = d.shooting_team !== team1Name;

onFieldData = shots.filter(d => isOpponentShot && playerOnField);
```

---

## Important Code Locations

### Filter Logic
- **applyFilters()**: Line 1129-1206
- **populateFilters()**: Line 1108-1127
- **setupFilterToggleButtons()**: Line 557-574

### Histogram Logic
- **createXGHistograms()**: Line 3599-3730
- **drawXGHistogram()**: Line 3779-4096
- **Background outline drawing**: Line 3878-4008
- **Team name selection for "All Games"**: Line 3646-3650

### Shot Map
- **createShotMap()**: Line 1619-1950
- **createHexbinHeatmap()**: Line 2897-3134
- **createSplitViewHexbins()**: Line 2201-2397

### Database
- **initializeDatabase()**: Line 63-204
- **migrateDatabase()**: Line 206-337
- **createOrUpdateViews()**: Line 354-413
- **saveDatabaseToFile()**: Line 415-428

### CSV Import
- **handleFileSelect()**: Line 604-679
- **parseCSV()**: Line 681-698
- **validateCSVStructure()**: Line 722-739
- **importData()**: Line 805-1029

### Corrections Tab
- **loadCorrectionsForGame()**: Line 4227-4395
- **renderCorrectionsTable()**: Line 4423-4640
- **saveCorrection()**: Line 4682-4764
- **deleteCorrection()**: Line 4765-4780

---

## Common Pitfalls & Gotchas

### 1. Filter Data Sources

**CRITICAL:** Different parts of the code use different data sources:

- `this.currentGameData` = Unfiltered, current game only
- `this.currentTeamFilteredData` = Filtered by result/type, NOT by shooter
- `filteredData` (local var) = Fully filtered (result + type + shooter)

**When to use which:**
- Histograms: Use `currentGameData` for background outlines
- Shot map: Use `filteredData` for main display
- Opponent shots: Use `currentTeamFilteredData` for filters but not shooter

### 2. Team Name in "All Games" Mode

**BUG THAT WAS FIXED:** When filters are applied in "All Games" mode, the team order in the filtered data can change (e.g., if opponent has more "Missed" shots than your team).

**Solution (line 3646):**
```javascript
// ALWAYS get team name from unfiltered data
const allTeamsUnfiltered = [...new Set(this.currentGameData.map(d => d.shooting_team))];
team1 = allTeamsUnfiltered[0];  // Consistent team1

// Then filter using this team name
team1Shots = data.filter(d => d.shooting_team === team1);
```

### 3. Turnover Type Handling

Turnover is special - it modifies other types:
- Database: type = "Direct"
- After correction with turnover: type = "Turnover | Direct"

**Filter logic must handle:**
```javascript
if (onlyTurnoverSelected) {
    allowedTypes = ['Turnover | Direct', 'Turnover | One-timer'];
}
if (directSelected && turnoverSelected) {
    allowedTypes.push('Direct', 'Turnover | Direct');
}
```

### 4. Histogram Background Timing

**BUG THAT WAS FIXED:** White outline wasn't showing because data was stored AFTER histograms were drawn.

**Solution (line 3694-3708):**
```javascript
// Store BEFORE drawing
if (this.selectedShooter) {
    this.team1FullData = team1FullShots.filter(...);
    this.team2FullData = team2FullShots.filter(...);
} else {
    // Clear when no shooter
    this.team1FullData = null;
    this.team2FullData = null;
}

// THEN draw
this.drawXGHistogram(team1HistGroup, ...);
this.drawXGHistogram(team2HistGroup, ...);
```

### 5. ES6 Module Context

When moving to modules, `this` context can be lost. Solution:

```javascript
// In module:
export function handleFileSelect(event, app) {
    // Pass 'app' instance explicitly
    app.db.exec(...);
}

// In main class:
handleFileSelect(event) {
    return csvHandleFile(event, this);  // Pass 'this' as app
}
```

---

## UI Components

### Dashboard Layout Grid

Uses a 15×10 grid for precise positioning:
- Columns: 15 (labeled 1-15)
- Rows: 10 (labeled A-J)
- Row J is half-height

**Element positions:**
- Shot map: A1-H1 (8 rows × 1 column)
- Histograms: Column 5 (upper at row B, lower at row G)
- Dev grid toggle: For alignment debugging

### Tab System

Three tabs:
1. **Import** (`#import-tab`) - CSV file import
2. **Dashboard** (`#dashboard-tab`) - Main visualization (default)
3. **Corrections** (`#corrections-tab`) - Shot data corrections

Controlled by:
- `.tab-button` elements with `data-tab` attribute
- `.tab-content` elements with matching IDs
- Active state toggled via `.active` class

### Filter Buttons

**Visual States:**
- Default: Gray background
- Active: Blue background (`.active` class)
- Multiple can be active simultaneously
- Clicking toggles state

**Special Cases:**
- "All Shooters" option in shooter dropdown
- Turnover button has class `.turnover-filter`

---

## API Endpoints (server.js)

### POST /api/save-database
Saves SQLite database to server filesystem.

**Request:**
```javascript
fetch('/api/save-database', {
    method: 'POST',
    body: dbArrayBuffer
})
```

**Response:**
```json
{ "success": true }
```

**Server Action:**
Writes to `./floorball_data.sqlite`

### POST /api/debug-log
Logs debug messages to daily log file.

**Request:**
```javascript
fetch('/api/debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        message: "Debug message",
        data: { key: "value" }
    })
})
```

**Server Action:**
Appends to `logs/YYYY-MM-DD-debug.log`

---

## Development Workflow

### Starting the Server
```bash
bun run dev      # or bun run start, bun run serve
# Runs on http://localhost:3000
```

### Making Changes

1. Edit code
2. Refresh browser (no build step needed)
3. Check browser console for errors
4. Check `logs/YYYY-MM-DD-debug.log` for server-side logs

### Testing CSV Import

1. Prepare CSV with columns: Date, Team 1, Team 2, Time, Shooting Team, Result, Type, xG, xGOT, Shooter, Passer, Distance, Angle, T1LW, T1C, T1RW, T1LD, T1RD, T1G, T1X, T2LW, T2C, T2RW, T2LD, T2RD, T2G, T2X, PP, SH, Player Team 1, Player Team 2
2. Go to Import tab
3. Select file
4. Verify preview
5. Enter/verify game name and date
6. Click Import

### Database Inspection

```javascript
// In browser console:
app.db.exec("SELECT * FROM games")
app.db.exec("SELECT COUNT(*) FROM shots")
app.db.exec("SELECT * FROM shots_view LIMIT 10")
```

---

## Performance Considerations

### Database Queries
- Uses SQLite views (`shots_view`) to merge corrections
- Queries are synchronous (SQL.js runs in main thread)
- Large datasets (>1000 shots) may cause brief UI freezes

### D3 Rendering
- Hexbin calculation is O(n log n)
- Re-rendering happens on every filter change
- Debouncing could be added for performance

### Memory
- Entire database loaded in browser memory
- Database exported to ArrayBuffer for persistence
- ~1MB database = ~1MB RAM

---

## Future Enhancements

### Planned Modularization
See MODULARIZATION_GUIDE.md for:
- database.js
- filters.js
- shotMap.js
- histograms.js
- charts.js
- corrections.js

### Potential Features
- Export visualizations as PNG/SVG
- Player comparison mode
- Season statistics
- Heat map animations over time
- Multi-game aggregations
- Advanced filtering (date ranges, score situations)

---

## Debugging Tips

### Common Issues

**1. Filters not working:**
- Check `this.currentTeamFilteredData` is being set
- Verify `applyFilters()` is being called
- Check console for filter state logs

**2. Histogram not showing:**
- Verify data has valid xG values (0-0.6)
- Check if `team1Shots` / `team2Shots` are empty
- Look for console errors in `drawXGHistogram()`

**3. White outline missing:**
- Check `this.team1FullData` / `this.team2FullData` are set BEFORE drawing
- Verify `this.selectedShooter` is set
- Check timing of data storage (line 3694)

**4. Import duplicates not detected:**
- Verify `generateShotHash()` produces consistent hashes
- Check console logs for hash comparison
- Ensure CSV format matches expected structure

### Debugging Tools

**Browser Console:**
```javascript
// Check current state
app.currentGameId
app.selectedShooter
app.currentGameData.length
app.currentTeamFilteredData?.length

// Check filters
document.querySelectorAll('.result-filter.active')
document.querySelectorAll('.type-filter.active')

// Check database
app.db.exec("SELECT COUNT(*) FROM shots")
```

**Dev Grid:**
Click "Toggle Dev Grid" button to show positioning overlay.

**Debug Logs:**
Check `logs/` folder for detailed server-side logs.

---

## Code Style & Conventions

### Naming
- Classes: PascalCase (`FloorballApp`)
- Functions/methods: camelCase (`createShotMap`)
- Constants: UPPER_SNAKE_CASE (none currently)
- CSS classes: kebab-case (`shot-map-chart`)

### Comments
- Minimal - code should be self-explanatory
- Critical sections have explanatory comments
- No emojis in code
- TODO comments removed when implemented

### Error Handling
```javascript
try {
    // Operation
} catch (error) {
    console.error('Context:', error);
    debugLog('Context ERROR', { error: error.message });
    this.showStatus('User message', 'error');
}
```

---

## Version History / Key Fixes

### Recent Fixes (2025)

1. **Filter persistence when changing games** (Line 1113-1125)
   - Shooter selection now persists if player exists in new game

2. **"All Games" team name consistency** (Line 3646)
   - Team name now taken from unfiltered data to prevent order changes

3. **Lower hexmap filter application** (Line 1231)
   - Opponent shots now properly filtered by result/type when player selected

4. **Histogram white outline visibility** (Line 3694-3708)
   - Background data stored before drawing histograms

5. **Lower histogram positioning** (Line 3704)
   - Moved down to align x-axis with field bottom

6. **Histogram legend removal** (Line 4034)
   - Lower histogram legend removed for cleaner UI

---

## Contact & Resources

### Documentation Files
- `CLAUDE.md` - Project overview and development commands
- `docs/database_uml.md` - Database schema details
- `MODULARIZATION_GUIDE.md` - Guide for code modularization
- `MODULARIZATION_SUMMARY.md` - Modularization overview
- `QUICK_START.md` - Quick integration guide
- `CODEBASE_DOCUMENTATION.md` - This file

### Git Repository
Code is version controlled. Check git log for detailed change history.

---

*Last Updated: 2025-01-01*
*For Claude Code AI Assistant - This document explains the entire codebase structure and logic*

---

## Spider Diagram Module (NEW)

### Purpose
Displays performance metrics between the two xG histograms, showing:
- Shot result percentages (Blocked, Missed, Saved, Goal)
- Shot count
- Advanced metrics (Corsi, xG +/-, xSOG +/-)

### Location
- **File**: `js/modules/spiderDiagram.js`
- **Position**: Between upper and lower histograms
- **Integration**: See `SPIDER_DIAGRAM_INTEGRATION.md`

### Metrics Calculated

#### 1. Shot Result Percentages
- **Blocked %**: `(blocked_shots / total_shots) × 100`
- **Missed %**: `(missed_shots / total_shots) × 100`
- **Saved %**: `(saved_shots / total_shots) × 100`
- **Goal %**: `(goal_shots / total_shots) × 100`

#### 2. Corsi
```
Corsi For (CF) = shots + blocks + misses (for team/player)
Corsi Against (CA) = shots + blocks + misses (against, when on field)
Corsi = CF - CA
```

#### 3. xG Plus-Minus
```
xG For = sum of xG for shots by team/player
xG Against = sum of xG for shots against (when player on field)
xG +/- = xG For - xG Against
```

#### 4. xSOG Plus-Minus
```
xSOG For = sum of xG for shots on goal (Saved + Goal) by team/player
xSOG Against = sum of xG for shots on goal against (when player on field)
xSOG +/- = xSOG For - xSOG Against
```

### Filter Behavior

**Affected by:**
- Shooter selection (player vs team)
- Game selection (specific game vs all games)
- Type filters (Direct, One-timer, etc.)

**NOT affected by:**
- Result filters (Goal, Saved, Missed, Blocked)

**Reasoning**: Result filters don't affect the spider diagram because the diagram itself shows the breakdown of all results.

### Display Modes

#### Mode 1: All Games + All Shooters
- **Blue shape**: Team metrics
- **White outline**: None (or could show league average if implemented)

#### Mode 2: All Games + Single Player
- **Blue shape**: Player metrics across all games
- **White outline**: Team metrics across all games

#### Mode 3: Single Game + All Shooters
- **Blue shape**: Team1 metrics for this game
- **White outline**: Team2 metrics for comparison

#### Mode 4: Single Game + Single Player
- **Blue shape**: Player metrics for this game
- **White outline**: Team metrics for this game

### D3 Implementation

Uses D3's radial coordinate system:

```javascript
// Radial line generator
const radarLine = d3.lineRadial()
    .angle((d, i) => angleScale(i))
    .radius(d => radialScale(d.value))
    .curve(d3.curveLinearClosed);

// Radial scale
const radialScale = d3.scaleLinear()
    .domain([0, 100])
    .range([0, radius]);

// Angle scale
const angleScale = d3.scaleLinear()
    .domain([0, numAxes])
    .range([0, 2 * Math.PI]);
```

### Value Normalization

Different metrics are normalized differently:

**Percentages** (0-100%):
- Already in correct range
- Maps directly to 0-100 for display

**Shot Count**:
- Normalized to max shot count in dataset
- `(value / max) × 100`

**Plus-Minus Metrics** (can be negative):
- Normalized so 0 = center (50)
- Positive values: 50-100
- Negative values: 0-50
- Formula: `((value / max) × 50) + 50`

### Color Scheme

Matches histogram colors for consistency:

- **Blocked**: `#E06B47` (Orange-red)
- **Missed**: `#E8B44F` (Yellow)
- **Saved**: `#5B8DBE` (Blue)
- **Goal**: `#7FB069` (Green)
- **Shot Count**: `#A0A0A8` (Gray)
- **Corsi**: `#9B7EBD` (Purple)
- **xG +/-**: `#E07BB0` (Pink)
- **xSOG +/-**: `#4ECDC4` (Teal)

### Integration with Existing Code

The spider diagram:
1. Receives the same filtered data as histograms
2. Calculates metrics independently
3. Updates automatically when filters change
4. Shows white outline for comparison (same as histograms)

**Key Integration Point**: Called in `createXGHistograms()` after both histograms are drawn, using the same data sources.

---

*Spider Diagram Module Added: 2025-01-01*

