# Spider Diagram Feature - Complete

## What Has Been Created

I've created a new spider diagram (radar chart) module that displays player/team performance metrics between the two xG histograms.

### Files Created

1. ✅ **`js/modules/spiderDiagram.js`** (265 lines)
   - Complete spider diagram implementation using D3's radial line generator
   - Calculates 8 performance metrics
   - Shows player data (blue) and comparison data (white outline)
   - Uses same colors as histograms for consistency

2. ✅ **`SPIDER_DIAGRAM_INTEGRATION.md`**
   - Step-by-step integration guide
   - Code snippets ready to paste
   - Testing instructions
   - Troubleshooting tips

3. ✅ **Updated `CODEBASE_DOCUMENTATION.md`**
   - Added complete spider diagram documentation
   - Metrics calculations explained
   - Filter behavior documented
   - Display modes detailed

## Features

### 8 Performance Metrics

1. **Blocked %** - Percentage of shots that were blocked (orange-red dot)
2. **Missed %** - Percentage of shots that missed (yellow dot)
3. **Saved %** - Percentage of shots that were saved (blue dot)
4. **Goal %** - Percentage of shots that scored (green dot)
5. **Shot Count** - Total number of shots (gray dot)
6. **Corsi** - Shot attempts for minus against (purple dot)
7. **xG +/-** - Expected goals plus-minus (pink dot)
8. **xSOG +/-** - Expected shots on goal plus-minus (teal dot)

### Colored Dots as Legend

The colored dots on each axis serve as the legend (replacing the old separate legend). Colors match the histogram colors exactly.

### White Outline Comparison

Just like the histograms:
- When a player is selected: white outline shows team metrics
- When a game is selected: white outline shows opponent metrics
- Provides context for the player/team performance

### Filter Integration

**Works with these filters:**
- ✅ Shooter selection (player vs team)
- ✅ Game selection (specific game vs all games)
- ✅ Type filters (Direct, One-timer, Rebound, Turnover)

**Ignores these filters (by design):**
- ❌ Result filters (Goal, Saved, Missed, Blocked)

**Why?** The spider diagram itself shows the breakdown of all result types, so filtering by result would make it show only one metric.

## Integration (Quick Version)

### Step 1: Update index.html

Change:
```html
<script src="app.js" defer></script>
```

To:
```html
<script type="module" src="app.js"></script>
```

### Step 2: Add import to app.js

At the top of app.js:
```javascript
import { createSpiderDiagram } from './js/modules/spiderDiagram.js';
```

### Step 3: Call in createXGHistograms

After line 3722 (after drawing both histograms), add:

```javascript
// Spider diagram between histograms
const spiderWidth = histogramWidth;
const spiderHeight = histogramHeight * 1.5;
const spiderY = margin.top + histogramHeight + 40;

let spiderPlayerData = null;
let spiderTeamData = null;

if (this.selectedShooter) {
    spiderPlayerData = team1Shots;
    spiderTeamData = team1FullShots;
} else if (this.currentGameId === 'all') {
    spiderPlayerData = team1Shots;
    spiderTeamData = null;
} else {
    spiderPlayerData = team1Shots;
    spiderTeamData = team2Shots;
}

createSpiderDiagram(svg, spiderPlayerData, spiderTeamData, spiderWidth, spiderHeight,
    { x: histogramX, y: spiderY });
```

That's it! The spider diagram will now appear between the two histograms.

## Visual Design

The spider diagram uses:
- **D3.js radial coordinate system** - Proper D3 implementation
- **8 axes** - One for each metric
- **5 concentric circles** - Grid for reading values
- **Blue filled area** - Player/selected data
- **White outline** - Comparison data (team/opponent)
- **Colored dots** - Metric indicators and legend
- **Labels with values** - Show metric name and current value

## Position & Size

- **X position**: Same as histograms (column 4.5)
- **Y position**: Below upper histogram (with 40px gap)
- **Width**: Same as histograms (3 grid columns)
- **Height**: ~1.5x histogram height (fits in the space)

Fits perfectly in the space between the histograms where only the legend was before.

## Technical Details

### D3 Features Used

```javascript
// Radial line generator (proper D3 way to draw radar charts)
d3.lineRadial()
    .angle((d, i) => angleScale(i))
    .radius(d => radialScale(d.value))
    .curve(d3.curveLinearClosed)

// Radial scale
d3.scaleLinear().domain([0, 100]).range([0, radius])

// Angle scale
d3.scaleLinear().domain([0, numAxes]).range([0, 2 * Math.PI])

// Data joins
.data(axes).enter().append(...)
```

### Metrics Calculation

All metrics are calculated from the shot data:

**Shot Percentages:**
```javascript
const blockedPct = (blocked / total) * 100;
```

**Corsi:**
```javascript
const shotsFor = shots.filter(d => d.shooting_team === teamName).length;
const shotsAgainst = shots.filter(d => d.shooting_team !== teamName).length;
const corsi = shotsFor - shotsAgainst;
```

**xG Plus-Minus:**
```javascript
const xGFor = shots.filter(d => d.shooting_team === teamName)
    .reduce((sum, d) => sum + parseFloat(d.xg), 0);
const xGAgainst = shots.filter(d => d.shooting_team !== teamName)
    .reduce((sum, d) => sum + parseFloat(d.xg), 0);
const xGPlusMinus = xGFor - xGAgainst;
```

### Value Normalization

Different metrics use different normalization:

- **Percentages**: Direct 0-100 mapping
- **Shot Count**: Normalized to max in dataset
- **Plus-Minus**: 0 = center (50), positive = 50-100, negative = 0-50

## Testing Checklist

After integration, test these scenarios:

- [ ] All Games + All Shooters → Shows team metrics
- [ ] All Games + Single Player → Shows player (blue) vs team (white)
- [ ] Single Game + All Shooters → Shows team1 vs team2
- [ ] Single Game + Single Player → Shows player vs team for that game
- [ ] Result filters → Should NOT affect spider diagram
- [ ] Type filters → SHOULD affect spider diagram
- [ ] Changing games → Spider diagram updates
- [ ] Changing players → Spider diagram updates

## Benefits

1. **Space efficient** - Replaces legend, adds 8 metrics in same space
2. **Visual consistency** - Matches histogram colors and style
3. **Advanced analytics** - Shows Corsi and xG metrics
4. **Easy comparison** - White outline shows context
5. **Filter aware** - Responds to selection changes
6. **Proper D3** - Uses D3's radial generators

## Future Enhancements

Potential additions:
- Tooltips on hover showing exact values
- Animation when updating
- Ability to toggle specific metrics on/off
- Export as PNG/SVG
- Comparison with league average

## Files Reference

- **Module**: `js/modules/spiderDiagram.js`
- **Integration Guide**: `SPIDER_DIAGRAM_INTEGRATION.md`
- **Documentation**: `CODEBASE_DOCUMENTATION.md` (updated)
- **This File**: `SPIDER_DIAGRAM_README.md`

## Summary

✅ Spider diagram module created with D3's radial generators
✅ 8 performance metrics calculated and displayed
✅ Colored dots serve as legend (matching histogram colors)
✅ White outline for comparison (like histograms)
✅ Filter integration (respects type filters, ignores result filters)
✅ Positioned perfectly between the two histograms
✅ Complete documentation and integration guide
✅ Ready to integrate with simple copy-paste

The spider diagram is a complete, self-contained module ready to be integrated into your dashboard!
