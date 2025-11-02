# Spider Diagram Integration Guide

## Overview

The spider diagram module (`js/modules/spiderDiagram.js`) has been created to display performance metrics between the two histograms.

## Integration Steps

### Step 1: Add Import to app.js

At the top of `app.js` (where other imports would be), add:

```javascript
import { createSpiderDiagram } from './js/modules/spiderDiagram.js';
```

### Step 2: Call Spider Diagram in createXGHistograms

In the `createXGHistograms` method (around line 3722, after both histograms are drawn), add:

```javascript
// After line 3722 (after this.drawXGHistogram for team2):

// Create spider diagram between histograms
const spiderWidth = histogramWidth;
const spiderHeight = histogramHeight * 1.5; // Space between histograms
const spiderY = margin.top + histogramHeight + 40; // Below upper histogram

// Prepare data for spider diagram
let spiderPlayerData = null;
let spiderTeamData = null;

if (this.selectedShooter) {
    // Player is selected: show player vs team
    spiderPlayerData = team1Shots; // Player's shots
    spiderTeamData = team1FullShots; // Full team shots
} else if (this.currentGameId === 'all') {
    // All games: show team vs all data
    spiderPlayerData = team1Shots; // Team shots
    spiderTeamData = null; // No comparison needed
} else {
    // Single game: show team1 vs team2
    spiderPlayerData = team1Shots; // Team 1
    spiderTeamData = team2Shots; // Team 2 for comparison
}

createSpiderDiagram(
    svg,
    spiderPlayerData,
    spiderTeamData,
    spiderWidth,
    spiderHeight,
    { x: histogramX, y: spiderY }
);
```

### Step 3: Remove Old Legend

In the `drawXGHistogram` method (around line 4034), the legend for the upper histogram has already been removed. The spider diagram now shows the colored dots as the legend.

### Step 4: Data Flow

The spider diagram automatically responds to filters because it receives the same filtered data:

**Filters that DO affect spider diagram:**
- Shooter selection (single player vs team)
- Game selection (specific game vs all games)
- Type filters (Direct, One-timer, etc.) - via the filtered data passed in

**Filters that DO NOT affect spider diagram:**
- Result filters (Goal, Saved, Missed, Blocked) - As specified, these are shown in the diagram itself

**Data Sources:**
- `team1Shots`: Filtered data for main display
- `team1FullShots`: Unfiltered team data for white outline (when player selected)
- `team2Shots`: Opponent/team2 data

### Step 5: Positioning

The spider diagram is positioned:
- **X**: Same as histograms (`histogramX`)
- **Y**: Below upper histogram (`margin.top + histogramHeight + 40`)
- **Width**: Same as histograms (`histogramWidth`)
- **Height**: Space between histograms (~1.5x histogram height)

This fits it perfectly in the space that previously had only the legend.

## Metrics Explained

The spider diagram calculates and displays:

1. **Blocked %** - Percentage of shots that were blocked
2. **Missed %** - Percentage of shots that missed
3. **Saved %** - Percentage of shots that were saved
4. **Goal %** - Percentage of shots that resulted in goals
5. **Shot Count** - Total number of shots
6. **Corsi** - Shot attempts for minus shot attempts against (CF - CA)
7. **xG +/-** - Expected goals for minus expected goals against
8. **xSOG +/-** - Expected shots on goal for minus against

## Testing

After integration, test:

1. **All Games + All Shooters**: Should show team metrics
2. **All Games + Single Player**: Should show player (blue) vs team (white outline)
3. **Single Game + All Shooters**: Should show team1 vs team2
4. **Single Game + Single Player**: Should show player vs team for that game
5. **Result filters**: Should NOT affect spider diagram data
6. **Type filters**: SHOULD affect spider diagram data

## Troubleshooting

**Spider diagram not showing:**
- Check console for errors
- Verify import statement is correct
- Ensure D3 is loaded before module

**Wrong data displayed:**
- Check that correct data is being passed (team1Shots, team1FullShots, etc.)
- Verify filter logic in applyFilters() is setting currentTeamFilteredData correctly

**Positioning issues:**
- Adjust spiderY calculation
- Check spiderHeight to ensure it fits between histograms
- Verify margin.top and histogramHeight values

## Visual Design

The spider diagram uses:
- **Colors**: Match histogram colors (blocked=orange, missed=yellow, saved=blue, goal=green)
- **White outline**: Shows team/comparison data (same as histograms)
- **Blue fill**: Player/selected data
- **Colored dots**: Indicate each metric and serve as legend

This creates visual consistency with the rest of the dashboard.
