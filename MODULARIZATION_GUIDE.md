# Floorball App Modularization Guide

## Current Status

The app.js file has been partially modularized. Two modules have been created:

1. **js/modules/utils.js** - Utility functions (coordinate calculation, hash generation, logging)
2. **js/modules/csvImport.js** - CSV import functionality (parsing, validation, importing)

## Completed Modules

### 1. utils.js
Contains:
- `calculateCoordinates(distance, angle)` - Convert polar to cartesian coordinates
- `generateShotHash(shotData)` - Create unique hash for shot deduplication
- `debugLog(message, data)` - Send debug logs to server

### 2. csvImport.js
Contains:
- `handleFileSelect(event, app)` - Handle CSV file selection
- `parseCSV(text)` - Parse CSV text into structured data
- `validateCSVStructure(csvData)` - Validate required CSV columns
- `showCSVPreview(csvData)` - Display CSV preview in UI
- `generateShotHash(shotData)` - Generate shot hash for duplicate detection
- `importData(app)` - Import CSV data into database

## Next Steps for Complete Modularization

### Recommended Module Structure

1. **js/modules/database.js** (Lines 63-437)
   - `initializeDatabase()`
   - `migrateDatabase()`
   - `createOrUpdateViews()`
   - `saveDatabaseToFile()`
   - `uploadDatabaseToServer()`
   - `checkDatabaseState()`

2. **js/modules/filters.js** (Lines 1107-1206)
   - `populateFilters(data)`
   - `applyFilters()`
   - `setupFilterToggleButtons()`

3. **js/modules/shotMap.js** (Lines 1619-3320)
   - `createShotMap(data, onFieldData)`
   - `createHexbinHeatmap()`
   - `createSplitViewHexbins()`
   - `prepareShotMapData()`
   - `toggleShotDots()`
   - `toggleHeatmap()`
   - `highlightHexbinsByXGRange()`
   - `resetHexbinHighlighting()`

4. **js/modules/histograms.js** (Lines 3387-4096)
   - `createXGHistograms()`
   - `drawXGHistogram()`
   - `updateXGHistogramsWithPlayer()`
   - `addPlayerOverlay()`
   - `clearPlayerOverlay()`
   - `calculateSharedYMax()`

5. **js/modules/charts.js** (Lines 1410-1618)
   - `createShotResultsChart()`
   - `createTeamShotsChart()`
   - `createXGTimelineChart()`
   - `createShotTypesChart()`

6. **js/modules/corrections.js** (Lines 4173-4780)
   - `getAllPlayers()`
   - `loadCorrectionsGamesList()`
   - `loadCorrectionsForGame()`
   - `createPlayerDropdown()`
   - `createTeamDropdown()`
   - `renderCorrectionsTable()`
   - `sortCorrectionsTable()`
   - `applyCorrectionsFilters()`
   - `saveCorrection()`
   - `deleteCorrection()`

## How to Use Existing Modules

### 1. Update index.html

Change the script tag from:
```html
<script src="app.js" defer></script>
```

To:
```html
<script type="module" src="app.js"></script>
```

### 2. Update app.js

Add imports at the top:
```javascript
import { calculateCoordinates, debugLog } from './js/modules/utils.js';
import { handleFileSelect, importData } from './js/modules/csvImport.js';
```

### 3. Replace Methods in FloorballApp Class

In the FloorballApp class, replace the methods with delegations:

```javascript
class FloorballApp {
    // ... existing code ...

    calculateCoordinates(distance, angle) {
        return calculateCoordinates(distance, angle);
    }

    handleFileSelect(event) {
        handleFileSelect(event, this);
    }

    async importData() {
        await importData(this);
    }

    // ... rest of class ...
}
```

## Benefits of This Approach

1. **Gradual Migration** - Migrate one module at a time
2. **Easy Testing** - Test each module independently
3. **Maintainability** - Smaller files are easier to understand
4. **Reusability** - Modules can be reused in other projects
5. **Safety** - Maintains exact functionality while improving structure

## Migration Checklist

- [x] Create utils.js module
- [x] Create csvImport.js module
- [ ] Create database.js module
- [ ] Create filters.js module
- [ ] Create shotMap.js module
- [ ] Create histograms.js module
- [ ] Create charts.js module
- [ ] Create corrections.js module
- [ ] Update app.js with all imports
- [ ] Update index.html to use ES6 modules
- [ ] Test all functionality thoroughly

## Important Notes

- Always keep a backup of app.js before making changes
- Test each module integration before moving to the next
- The `app` parameter passed to module functions gives access to the database and other app state
- Module functions should be pure when possible (no side effects)
- Keep console.log statements during migration for debugging

## Testing Strategy

After each module is integrated:

1. Test the specific functionality (e.g., CSV import)
2. Check browser console for errors
3. Verify database operations work correctly
4. Test edge cases (empty data, errors, etc.)
5. Ensure UI updates correctly

## Troubleshooting

If you encounter issues:

1. Check browser console for import errors
2. Verify file paths are correct (case-sensitive)
3. Ensure all functions are properly exported
4. Check that `this` context is preserved (use arrow functions or bind)
5. Verify ES6 module support in your server (correct MIME types)
