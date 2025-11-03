# Development Guide

## For Claude Code: Development Instructions

**READ THIS FIRST when starting a new session or working on this project.**

---

## Core Principle: Modular Architecture

**CRITICAL RULE:** When adding new visualizations, features, or dashboard components:

### ✅ DO:
- Create a **new JavaScript file** in `public/js/`
- Follow the module pattern (see below)
- Keep functionality isolated and self-contained
- Export as `window.ClassName`
- Initialize in `app.js` initializeApp()

### ❌ DO NOT:
- Add large features directly to `app.js`
- Bloat `app.js` with new visualizations
- Mix concerns across modules
- Create functions without a class wrapper

---

## Module Pattern (MANDATORY)

All new features must follow this exact pattern:

```javascript
// public/js/myfeature.js

class MyFeature {
    constructor(app) {
        this.app = app;           // Access to main app
        this.myState = null;      // Module-specific state
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Bind to DOM elements
        const button = document.getElementById('my-button');
        if (button) {
            button.addEventListener('click', () => {
                this.doSomething();
            });
        }
    }

    doSomething() {
        // Feature logic
        const data = this.app.currentGameData;
        // Process and visualize
    }

    // More methods...
}

window.MyFeature = MyFeature;
```

### Add to index.html:
```html
<script src="public/js/myfeature.js" defer></script>
```

### Initialize in app.js:
```javascript
async initializeApp() {
    // ... existing modules ...
    this.myFeature = new MyFeature(this);
    console.log('My feature initialized');
}
```

---

## Common Development Tasks

### 1. Adding a New Visualization

**Example: Adding a Timeline Chart**

1. **Create** `public/js/timeline.js`:
```javascript
class Timeline {
    constructor(app) {
        this.app = app;
        this.svg = null;
    }

    createTimeline(data) {
        const container = d3.select('#timeline-chart');
        container.selectAll('*').remove();

        // D3 visualization code
        this.svg = container.append('svg')
            .attr('width', 800)
            .attr('height', 400);

        // Timeline rendering...
    }

    updateTimeline(filteredData) {
        // Update with new data
    }
}

window.Timeline = Timeline;
```

2. **Add HTML** in `index.html`:
```html
<div id="timeline-chart" class="chart timeline"></div>
```

3. **Add CSS** in `public/css/visualizations.css`:
```css
.timeline {
    width: 100%;
    height: 400px;
}
```

4. **Initialize** in `app.js`:
```javascript
async initializeApp() {
    // ... existing ...
    this.timeline = new Timeline(this);
}
```

5. **Call** from appropriate place:
```javascript
async createCharts(data) {
    // ... existing charts ...
    this.timeline.createTimeline(data);
}
```

6. **Add script** to `index.html`:
```html
<script src="public/js/timeline.js" defer></script>
```

---

### 2. Adding a New Filter

**Example: Adding a Zone Filter**

1. **Add HTML** in `index.html` (dashboard-sidebar section):
```html
<div class="filter-group">
    <label for="filter-zone">Zone:</label>
    <select id="filter-zone">
        <option value="">All Zones</option>
        <option value="slot">Slot</option>
        <option value="perimeter">Perimeter</option>
    </select>
</div>
```

2. **Extend** `public/js/dashboard-sidebar.js`:
```javascript
setupEventListeners() {
    // ... existing ...

    const zoneFilter = document.getElementById('filter-zone');
    if (zoneFilter) {
        zoneFilter.addEventListener('change', () => {
            this.applyFilters();
        });
    }
}

applyFilters() {
    // ... existing filter logic ...

    const selectedZone = document.getElementById('filter-zone').value;

    if (selectedZone) {
        filteredData = filteredData.filter(shot => {
            // Calculate zone based on x_m, y_m
            const zone = this.calculateZone(shot.x_m, shot.y_m);
            return zone === selectedZone;
        });
    }

    this.app.createCharts(filteredData);
}

calculateZone(x, y) {
    // Zone logic
    const distanceFromGoal = Math.sqrt(Math.pow(x - 10, 2) + Math.pow(y - 3.5, 2));
    return distanceFromGoal < 5 ? 'slot' : 'perimeter';
}
```

---

### 3. Adding Database Functionality

Always use `DatabaseManager` for all database operations.

**Example: Adding a new query**

**In** `public/js/database.js`:
```javascript
async getPlayerStats(playerName) {
    try {
        const result = this.db.exec(`
            SELECT
                COUNT(*) as total_shots,
                SUM(CASE WHEN result = 'Goal' THEN 1 ELSE 0 END) as goals,
                AVG(xg) as avg_xg
            FROM shots_view
            WHERE shooter = ?
        `, [playerName]);

        if (result.length > 0) {
            const [totalShots, goals, avgXG] = result[0].values[0];
            return { totalShots, goals, avgXG };
        }
        return null;
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return null;
    }
}
```

**Usage in module:**
```javascript
async loadPlayerStats(playerName) {
    const stats = await this.app.dbManager.getPlayerStats(playerName);
    this.displayStats(stats);
}
```

---

### 4. Adding CSS Styles

Organize CSS by purpose:

- **base.css** - Typography, colors, general layout
- **dashboard.css** - Dashboard layout, grid, containers
- **visualizations.css** - Chart containers, SVG styles
- **goalkeeper.css** - Goalkeeper-specific styles
- **import.css** - Import tab styles
- **corrections.css** - Corrections tab styles
- **dev-tools.css** - Development helpers

Add new styles to appropriate file or create new file if needed.

---

## Module Communication

### Accessing Other Modules

```javascript
// In any module with this.app
class MyModule {
    someMethod() {
        // Access shared data
        const data = this.app.currentGameData;
        const gameId = this.app.currentGameId;
        const shooter = this.app.selectedShooter;

        // Call other modules
        this.app.shotMap.toggleHeatmap(true);
        this.app.dashboardSidebar.applyFilters();

        // Database operations
        await this.app.dbManager.loadGameData(gameId);
    }
}
```

### Shared State (in app.js)

Available to all modules via `this.app`:

```javascript
this.currentGameData      // Array of shots for current game
this.currentGameId        // Currently selected game ID
this.selectedShooter      // Currently selected shooter
this.currentTeamFilteredData  // Data after result/type filters
```

**IMPORTANT:** Don't modify shared state directly from modules. Use methods in `app.js`.

---

## Development Workflow

### Starting Development Server

```bash
bun run dev
# Server runs on http://localhost:3000
```

### File Structure

```
public/
├── css/                    # All stylesheets
│   └── [module].css
├── js/                     # All JavaScript modules
│   └── [module].js
└── images/                 # Static assets
    └── field.png

app.js                      # Main orchestrator (keep lean!)
index.html                  # Main HTML (update when adding modules)
server.js                   # Bun backend (API endpoints)
```

### Adding a New Module Checklist

- [ ] Create `public/js/mymodule.js` with class pattern
- [ ] Add `window.MyModule = MyModule;` export
- [ ] Add `<script src="public/js/mymodule.js" defer></script>` to index.html
- [ ] Initialize in `app.js` initializeApp(): `this.myModule = new MyModule(this);`
- [ ] Add HTML elements if needed
- [ ] Add CSS styles if needed
- [ ] Test functionality
- [ ] Update this documentation if adding significant features

---

## Debugging

### Debug Logging

All modules have access to debug logging:

```javascript
// In csvimport.js or any module
debugLog('Feature initialized', { data: someData });
```

Logs are written to `dev/logs/YYYY-MM-DD-debug.log`

### Browser Console

```javascript
// Access app globally
window.floorballApp

// Access any module
window.floorballApp.shotMap
window.floorballApp.dbManager

// Check current data
window.floorballApp.currentGameData
```

---

## Common Pitfalls to Avoid

### ❌ Adding to app.js directly
```javascript
// DON'T DO THIS in app.js
createMyNewChart(data) {
    // 200 lines of visualization code
}
```

### ✅ Create a module instead
```javascript
// DO THIS - Create public/js/mynewchart.js
class MyNewChart {
    constructor(app) {
        this.app = app;
    }

    create(data) {
        // 200 lines of visualization code
    }
}
```

---

### ❌ Direct database access
```javascript
// DON'T DO THIS
const db = this.app.dbManager.db;
const result = db.exec('SELECT * FROM shots');
```

### ✅ Use DatabaseManager methods
```javascript
// DO THIS
const data = await this.app.dbManager.loadGameData(gameId);
```

---

### ❌ Modifying shared state
```javascript
// DON'T DO THIS
this.app.currentGameData = newData;
```

### ✅ Call app methods
```javascript
// DO THIS
await this.app.loadGameData(gameId);
```

---

## Testing Changes

1. Start development server: `bun run dev`
2. Open browser: `http://localhost:3000`
3. Check browser console for errors
4. Test functionality:
   - Import CSV
   - Select game
   - Apply filters
   - View visualizations
   - Test corrections
5. Check debug logs: `dev/logs/YYYY-MM-DD-debug.log`

---

## Git Workflow

Ignored directories (in .gitignore):
- `dev/` - Development files, logs, backups
- `*.sqlite` - Database files
- `node_modules/` - Dependencies
- `logs/` - Legacy log path

Committed files:
- All `public/` files
- `app.js`, `server.js`, `index.html`
- `docs/` - Documentation
- `exampledata/` - Sample CSV files

---

## Database Schema

See `docs/DATABASE.md` for complete schema.

Key tables:
- `games` - Game metadata
- `shots` - Shot data
- `shot_corrections` - Corrections to shot data
- `game_aliases` - Custom game display names
- `shots_view` - View combining shots + corrections

---

## Performance Considerations

### Large Datasets
- Filter data before visualization
- Use D3 `.enter()` pattern for efficient updates
- Debounce filter events
- Limit hexbin resolution for performance

### Database Queries
- Use `shots_view` (includes corrections)
- Index on `game_id` for fast filtering
- Batch operations when possible

### Memory Management
- Clear old SVGs before creating new ones: `container.selectAll('*').remove()`
- Remove event listeners in module cleanup (if implementing destroy methods)

---

## Resources

- **D3.js Documentation:** https://d3js.org/
- **SQL.js Documentation:** https://sql.js.org/
- **Bun Documentation:** https://bun.sh/docs

---

## Questions?

Check existing modules for patterns and examples:
- `public/js/shotmap.js` - Complex D3 visualization
- `public/js/dashboard-sidebar.js` - Filter management
- `public/js/csvimport.js` - File handling and parsing
- `public/js/database.js` - Database operations
