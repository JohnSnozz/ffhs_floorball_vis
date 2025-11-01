// Spider Diagram Module - Player/Team Performance Metrics Visualization
// Uses D3 radial scales and area generators

export function createSpiderDiagram(svg, playerData, teamData, width, height, position) {
    console.log('Creating spider diagram');
    console.log('Player data:', playerData ? playerData.length : 0, 'shots');
    console.log('Team data:', teamData ? teamData.length : 0, 'shots');

    // Clear any existing spider diagram
    svg.selectAll('.spider-diagram-group').remove();

    const group = svg.append('g')
        .attr('class', 'spider-diagram-group')
        .attr('transform', `translate(${position.x}, ${position.y})`);

    // Calculate metrics
    const playerMetrics = calculateMetrics(playerData);
    const teamMetrics = teamData ? calculateMetrics(teamData) : null;

    console.log('Player metrics:', playerMetrics);
    console.log('Team metrics:', teamMetrics);

    // Define spider diagram axes with colors matching histogram
    const axes = [
        {
            key: 'blockedPct',
            label: 'Blocked %',
            color: '#E06B47',  // Orange-red (same as histogram)
            max: 100
        },
        {
            key: 'missedPct',
            label: 'Missed %',
            color: '#E8B44F',  // Yellow (same as histogram)
            max: 100
        },
        {
            key: 'savedPct',
            label: 'Saved %',
            color: '#5B8DBE',  // Blue (same as histogram)
            max: 100
        },
        {
            key: 'goalPct',
            label: 'Goal %',
            color: '#7FB069',  // Green (same as histogram)
            max: 100
        },
        {
            key: 'shotCount',
            label: 'Shot Count',
            color: '#A0A0A8',  // Gray
            max: Math.max(playerMetrics.shotCount, teamMetrics?.shotCount || 0) || 100
        },
        {
            key: 'corsi',
            label: 'Corsi',
            color: '#9B7EBD',  // Purple
            max: null  // Will be calculated
        },
        {
            key: 'xGPlusMinus',
            label: 'xG +/-',
            color: '#E07BB0',  // Pink
            max: null  // Will be calculated
        },
        {
            key: 'xSOGPlusMinus',
            label: 'xSOG +/-',
            color: '#4ECDC4',  // Teal
            max: null  // Will be calculated
        }
    ];

    // Calculate max values for Corsi and xG metrics (can be negative)
    const corsiValues = [playerMetrics.corsi, teamMetrics?.corsi || 0].filter(v => v !== null);
    const xGValues = [playerMetrics.xGPlusMinus, teamMetrics?.xGPlusMinus || 0].filter(v => v !== null);
    const xSOGValues = [playerMetrics.xSOGPlusMinus, teamMetrics?.xSOGPlusMinus || 0].filter(v => v !== null);

    const corsiMax = Math.max(Math.abs(Math.min(...corsiValues, 0)), Math.abs(Math.max(...corsiValues, 0))) || 10;
    const xGMax = Math.max(Math.abs(Math.min(...xGValues, 0)), Math.abs(Math.max(...xGValues, 0))) || 5;
    const xSOGMax = Math.max(Math.abs(Math.min(...xSOGValues, 0)), Math.abs(Math.max(...xSOGValues, 0))) || 5;

    axes.find(a => a.key === 'corsi').max = corsiMax;
    axes.find(a => a.key === 'xGPlusMinus').max = xGMax;
    axes.find(a => a.key === 'xSOGPlusMinus').max = xSOGMax;

    // Spider diagram settings
    const radius = Math.min(width, height) / 2 - 40;
    const centerX = width / 2;
    const centerY = height / 2;
    const levels = 5;
    const numAxes = axes.length;

    // Create radial scale for each axis
    const radialScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, radius]);

    // Create angle scale
    const angleScale = d3.scaleLinear()
        .domain([0, numAxes])
        .range([0, 2 * Math.PI]);

    // Draw concentric circles (web) using D3 data join
    const levelData = d3.range(1, levels + 1);
    group.selectAll('.web-circle')
        .data(levelData)
        .enter()
        .append('circle')
        .attr('class', 'web-circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', d => radialScale((d / levels) * 100))
        .style('fill', 'none')
        .style('stroke', '#2A2D34')
        .style('stroke-width', 0.5)
        .style('stroke-dasharray', '2,2');

    // Draw axis lines using D3 data join
    group.selectAll('.axis-line')
        .data(axes)
        .enter()
        .append('line')
        .attr('class', 'axis-line')
        .attr('x1', centerX)
        .attr('y1', centerY)
        .attr('x2', (d, i) => centerX + Math.cos(angleScale(i) - Math.PI / 2) * radius)
        .attr('y2', (d, i) => centerY + Math.sin(angleScale(i) - Math.PI / 2) * radius)
        .style('stroke', '#2A2D34')
        .style('stroke-width', 1);

    // Create radial line generator
    const radarLine = d3.lineRadial()
        .angle((d, i) => angleScale(i))
        .radius(d => radialScale(d.value))
        .curve(d3.curveLinearClosed);

    // Prepare data for radial line
    const prepareRadarData = (metrics) => {
        return axes.map(axis => ({
            axis: axis.key,
            value: normalizeValue(metrics[axis.key], axis)
        }));
    };

    // Draw team background (white outline) if available
    if (teamMetrics) {
        const teamData = prepareRadarData(teamMetrics);

        group.append('path')
            .datum(teamData)
            .attr('class', 'radar-area-team')
            .attr('transform', `translate(${centerX}, ${centerY}) rotate(-90)`)
            .attr('d', radarLine)
            .style('fill', 'none')
            .style('stroke', '#FFFFFF')
            .style('stroke-width', 2)
            .style('opacity', 0.6);
    }

    // Draw player data (colored fill)
    const playerData = prepareRadarData(playerMetrics);

    group.append('path')
        .datum(playerData)
        .attr('class', 'radar-area-player')
        .attr('transform', `translate(${centerX}, ${centerY}) rotate(-90)`)
        .attr('d', radarLine)
        .style('fill', '#5B8DBE')
        .style('fill-opacity', 0.2)
        .style('stroke', '#5B8DBE')
        .style('stroke-width', 2);

    // Add dots at each point using D3 data join
    const dotData = axes.map((axis, i) => {
        const angle = angleScale(i) - Math.PI / 2;
        const value = normalizeValue(playerMetrics[axis.key], axis);
        const r = radialScale(value);
        return {
            x: centerX + Math.cos(angle) * r,
            y: centerY + Math.sin(angle) * r,
            color: axis.color
        };
    });

    group.selectAll('.radar-dot')
        .data(dotData)
        .enter()
        .append('circle')
        .attr('class', 'radar-dot')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 3)
        .style('fill', d => d.color)
        .style('stroke', '#FFFFFF')
        .style('stroke-width', 1);

    // Add labels with colored dots using D3 data join
    const labelRadius = radius + 25;

    const labelGroups = group.selectAll('.axis-label-group')
        .data(axes)
        .enter()
        .append('g')
        .attr('class', 'axis-label-group');

    // Add colored dots
    labelGroups.append('circle')
        .attr('cx', (d, i) => {
            const angle = angleScale(i) - Math.PI / 2;
            return centerX + Math.cos(angle) * labelRadius - 15;
        })
        .attr('cy', (d, i) => {
            const angle = angleScale(i) - Math.PI / 2;
            return centerY + Math.sin(angle) * labelRadius;
        })
        .attr('r', 4)
        .style('fill', d => d.color)
        .style('stroke', '#FFFFFF')
        .style('stroke-width', 1);

    // Add label text
    labelGroups.each(function(axis, i) {
        const angle = angleScale(i) - Math.PI / 2;
        const x = centerX + Math.cos(angle) * labelRadius;
        const y = centerY + Math.sin(angle) * labelRadius;

        const labelGroup = d3.select(this).append('text')
            .attr('x', x)
            .attr('y', y)
            .style('font-size', '10px')
            .style('fill', '#A0A0A8')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle');

        // Add metric value
        const value = playerMetrics[axis.key];
        const displayValue = axis.key.includes('Pct') ? `${value.toFixed(1)}%` :
                            axis.key === 'shotCount' ? value.toString() :
                            value.toFixed(1);

        labelGroup.append('tspan')
            .attr('x', x)
            .attr('dy', 0)
            .style('font-weight', 'bold')
            .text(axis.label);

        labelGroup.append('tspan')
            .attr('x', x)
            .attr('dy', 12)
            .style('font-size', '9px')
            .text(displayValue);
    });

    // Add title
    group.append('text')
        .attr('x', centerX)
        .attr('y', 10)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#E5E5E7')
        .style('text-anchor', 'middle')
        .text('Performance Metrics');
}

function calculateMetrics(data) {
    if (!data || data.length === 0) {
        return {
            blockedPct: 0,
            missedPct: 0,
            savedPct: 0,
            goalPct: 0,
            shotCount: 0,
            corsi: 0,
            xGPlusMinus: 0,
            xSOGPlusMinus: 0
        };
    }

    const total = data.length;
    const blocked = data.filter(d => d.result === 'Blocked').length;
    const missed = data.filter(d => d.result === 'Missed').length;
    const saved = data.filter(d => d.result === 'Saved').length;
    const goals = data.filter(d => d.result === 'Goal').length;

    // Get the team name (assuming first shot has team info)
    const teamName = data[0]?.team1 || data[0]?.shooting_team;

    // Calculate Corsi (shot attempts for - shot attempts against)
    // CF = shots for (by this team/player)
    // CA = shots against (by opponents when player on field)
    const shotsFor = data.filter(d => d.shooting_team === teamName).length;
    const shotsAgainst = data.filter(d => d.shooting_team !== teamName).length;
    const corsi = shotsFor - shotsAgainst;

    // Calculate xG +/- (xG for - xG against)
    const xGFor = data
        .filter(d => d.shooting_team === teamName)
        .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
    const xGAgainst = data
        .filter(d => d.shooting_team !== teamName)
        .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
    const xGPlusMinus = xGFor - xGAgainst;

    // Calculate xSOG +/- (expected shots on goal = saved + goal)
    const xSOGFor = data
        .filter(d => d.shooting_team === teamName && (d.result === 'Saved' || d.result === 'Goal'))
        .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
    const xSOGAgainst = data
        .filter(d => d.shooting_team !== teamName && (d.result === 'Saved' || d.result === 'Goal'))
        .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
    const xSOGPlusMinus = xSOGFor - xSOGAgainst;

    return {
        blockedPct: (blocked / total) * 100,
        missedPct: (missed / total) * 100,
        savedPct: (saved / total) * 100,
        goalPct: (goals / total) * 100,
        shotCount: total,
        corsi: corsi,
        xGPlusMinus: xGPlusMinus,
        xSOGPlusMinus: xSOGPlusMinus
    };
}

function normalizeValue(value, axis) {
    // For percentage and shot count, normalize to 0-100 scale
    if (axis.key.includes('Pct')) {
        return Math.min(value, 100);
    }

    if (axis.key === 'shotCount') {
        return (value / axis.max) * 100;
    }

    // For +/- metrics (can be negative), normalize to 0-100 scale
    // 0 maps to 50 (center), +max maps to 100, -max maps to 0
    const normalized = ((value / axis.max) * 50) + 50;
    return Math.max(0, Math.min(100, normalized));
}

export function updateSpiderDiagram(svg, playerData, teamData, width, height, position) {
    // Simply recreate the diagram
    createSpiderDiagram(svg, playerData, teamData, width, height, position);
}
