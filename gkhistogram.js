class GoalkeeperHistogram {
    constructor() {
        this.currentGameData = null;
        this.allGamesData = null;
        this.selectedGoalkeeper = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const gkSelect = document.getElementById('goalkeeper-select');
        if (gkSelect) {
            gkSelect.addEventListener('change', (e) => {
                this.selectedGoalkeeper = e.target.value || null;
                this.updateHistogram();
            });
        }
    }

    setData(currentGameData, allGamesData) {
        this.currentGameData = currentGameData;
        this.allGamesData = allGamesData;
        this.updateGoalkeeperList();
        this.updateHistogram();
    }

    getGoalkeeperShots(data, goalkeeper = null) {
        if (!data || data.length === 0) return [];

        const team1Name = data[0]?.team1;
        if (!team1Name) return [];

        return data.filter(shot => {
            const isTeam2Shooting = shot.shooting_team !== team1Name;
            if (!isTeam2Shooting) return false;

            const resultIsRelevant = shot.result === 'Saved' || shot.result === 'Goal';
            if (!resultIsRelevant) return false;

            if (shot.t1x !== null && shot.t1x !== undefined && shot.t1x !== '') {
                return false;
            }

            let shotGoalkeeper = shot.t1g;

            if (shot.pp === 1 || shot.pp === '1') {
                if (!shotGoalkeeper || shotGoalkeeper === '') {
                    const regularGK = this.getRegularGoalkeeper(data, team1Name);
                    shotGoalkeeper = regularGK;
                }
            }

            if (!shotGoalkeeper || shotGoalkeeper === '') {
                return false;
            }

            if (goalkeeper) {
                return shotGoalkeeper === goalkeeper;
            }

            return true;
        });
    }

    getRegularGoalkeeper(data, team1Name) {
        const gkCounts = {};

        data.forEach(shot => {
            if (shot.shooting_team === team1Name && shot.t1g && shot.t1g !== '') {
                gkCounts[shot.t1g] = (gkCounts[shot.t1g] || 0) + 1;
            }
        });

        let maxCount = 0;
        let regularGK = null;

        for (const [gk, count] of Object.entries(gkCounts)) {
            if (count > maxCount) {
                maxCount = count;
                regularGK = gk;
            }
        }

        return regularGK;
    }

    getAllGoalkeepers(data) {
        if (!data || data.length === 0) return [];

        const team1Name = data[0]?.team1;
        if (!team1Name) return [];

        const goalkeeperGames = {};

        data.forEach(shot => {
            if (shot.t1g && shot.t1g !== '') {
                if (!goalkeeperGames[shot.t1g]) {
                    goalkeeperGames[shot.t1g] = new Set();
                }
                goalkeeperGames[shot.t1g].add(shot.game_id);
            }
        });

        const regularGK = this.getRegularGoalkeeper(data, team1Name);
        if (regularGK) {
            if (!goalkeeperGames[regularGK]) {
                goalkeeperGames[regularGK] = new Set();
            }
            const uniqueGames = [...new Set(data.map(s => s.game_id))];
            uniqueGames.forEach(gameId => goalkeeperGames[regularGK].add(gameId));
        }

        return Object.entries(goalkeeperGames)
            .map(([gk, gameIds]) => ({
                name: gk,
                games: gameIds.size
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    updateGoalkeeperList() {
        const gkSelect = document.getElementById('goalkeeper-select');
        if (!gkSelect) return;

        const goalkeepers = this.getAllGoalkeepers(this.allGamesData || this.currentGameData || []);

        gkSelect.innerHTML = '<option value="">All Goalkeepers</option>';

        goalkeepers.forEach(gk => {
            const option = document.createElement('option');
            option.value = gk.name;
            option.textContent = `${gk.name} (${gk.games} ${gk.games === 1 ? 'game' : 'games'})`;
            gkSelect.appendChild(option);
        });
    }

    getShotTypeCategory(shot) {
        const type = shot.type || '';
        const isDirectTurnover = type.includes('Direct') && type.includes('Turnover');
        const isOneTimerTurnover = type.includes('One-timer') && type.includes('Turnover');

        if (isDirectTurnover) return 'Direct Turnover';
        if (isOneTimerTurnover) return 'One-timer Turnover';
        if (type.includes('Direct')) return 'Direct';
        if (type.includes('One-timer')) return 'One-timer';
        if (type.includes('Rebound')) return 'Rebound';

        return 'Other';
    }

    updateHistogram() {
        const container = document.getElementById('goalkeeper-histogram');
        if (!container) return;

        container.innerHTML = '';

        if (!this.currentGameData || this.currentGameData.length === 0) {
            return;
        }

        const selectedGKShots = this.getGoalkeeperShots(this.currentGameData, this.selectedGoalkeeper);
        const allGKShots = this.getGoalkeeperShots(this.allGamesData || this.currentGameData);

        if (selectedGKShots.length === 0 && allGKShots.length === 0) {
            return;
        }

        this.drawHistogram(container, selectedGKShots, allGKShots);
        this.drawDumbbellChart(selectedGKShots, allGKShots);
    }

    drawHistogram(container, selectedShots, backgroundShots) {
        const margin = { top: 30, right: 20, bottom: 50, left: 40 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = container.clientHeight - margin.top - margin.bottom;

        let tooltip = d3.select('body').select('.gk-histogram-tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select('body')
                .append('div')
                .attr('class', 'gk-histogram-tooltip tooltip');
        }

        tooltip
            .style('position', 'absolute')
            .style('opacity', 0)
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', '#fff')
            .style('border', '1px solid rgba(255, 255, 255, 0.2)')
            .style('border-radius', '0px')
            .style('padding', '10px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '10000')
            .style('white-space', 'pre-line')
            .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.5)')
            .style('line-height', '1.4');

        const svg = d3.select(container)
            .append('svg')
            .attr('width', container.clientWidth)
            .attr('height', container.clientHeight);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const validSelectedShots = selectedShots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        const validBackgroundShots = backgroundShots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        const totalShots = validSelectedShots.length;
        const savedShots = validSelectedShots.filter(s => s.result === 'Saved').length;
        const savePct = totalShots > 0 ? ((savedShots / totalShots) * 100).toFixed(1) : 0;

        g.append('text')
            .attr('x', width)
            .attr('y', -10)
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .text(`${totalShots} Shots on Goal | ${savedShots} saved (${savePct}%)`);

        const binWidth = 0.05;
        const thresholds = d3.range(0, 0.6 + binWidth, binWidth);

        const shotTypes = ['Direct', 'One-timer', 'Direct Turnover', 'One-timer Turnover', 'Rebound'];

        const goalColors = {
            'Direct': '#7C3AED',
            'One-timer': '#8B5CF6',
            'Direct Turnover': '#A78BFA',
            'One-timer Turnover': '#C4B5FD',
            'Rebound': '#DDD6FE'
        };

        const savedColors = {
            'Direct': '#059669',
            'One-timer': '#10B981',
            'Direct Turnover': '#34D399',
            'One-timer Turnover': '#6EE7B7',
            'Rebound': '#A7F3D0'
        };

        const binnedData = this.binShotsByXG(validSelectedShots, thresholds, shotTypes, goalColors, savedColors);
        const backgroundBinnedData = this.binShotsByXG(validBackgroundShots, thresholds, shotTypes, goalColors, savedColors);

        const x = d3.scaleLinear()
            .domain([0, 0.6])
            .range([0, width]);

        const maxY = d3.max(binnedData, d => d.total) || 10;

        const y = d3.scaleLinear()
            .domain([0, maxY])
            .nice()
            .range([height, 0]);

        const barGroup = g.append('g').attr('class', 'selected-bars');

        binnedData.forEach(bin => {
            const binGroup = barGroup.append('g')
                .attr('class', 'bin-group')
                .attr('transform', `translate(${x(bin.x0)}, 0)`);

            const tooltipText = this.generateTooltipText(bin);

            bin.stacks.forEach((stack) => {
                if (stack.count > 0) {
                    binGroup.append('rect')
                        .attr('class', 'stack-segment')
                        .attr('x', 0)
                        .attr('width', Math.max(0, x(bin.x1) - x(bin.x0) - 1))
                        .attr('y', y(stack.y1))
                        .attr('height', y(stack.y0) - y(stack.y1))
                        .style('fill', stack.color)
                        .style('stroke', '#fff')
                        .style('stroke-width', 0.5)
                        .style('opacity', 0.8)
                        .style('cursor', 'pointer')
                        .on('mouseover', function(event) {
                            binGroup.selectAll('.stack-segment')
                                .style('opacity', 0.95);

                            tooltip.transition()
                                .duration(200)
                                .style('opacity', .9);

                            tooltip
                                .text(tooltipText)
                                .style('left', (event.pageX + 10) + 'px')
                                .style('top', (event.pageY - 10) + 'px');
                        })
                        .on('mousemove', function(event) {
                            tooltip
                                .style('left', (event.pageX + 10) + 'px')
                                .style('top', (event.pageY - 10) + 'px');
                        })
                        .on('mouseout', function() {
                            binGroup.selectAll('.stack-segment')
                                .style('opacity', 0.8);

                            tooltip.transition()
                                .duration(500)
                                .style('opacity', 0);
                        });
                }
            });
        });

        const isFiltered = this.selectedGoalkeeper ||
                          (validSelectedShots.length < validBackgroundShots.length);

        if (validBackgroundShots.length > 0 && isFiltered) {
            const bgBarGroup = g.append('g').attr('class', 'background-bars');

            const backgroundMaxBin = d3.max(backgroundBinnedData, d => d.total) || 1;
            const currentMaxBin = maxY;
            const scaleFactor = currentMaxBin / backgroundMaxBin;

            const scaledBackgroundData = backgroundBinnedData.map(bin => ({
                ...bin,
                scaledTotal: bin.total * scaleFactor
            }));

            const lineGenerator = d3.line()
                .x(d => d.x)
                .y(d => d.y);

            const pathData = [];
            pathData.push({ x: x(0), y: height });

            scaledBackgroundData.forEach((bin, i) => {
                const binX = x(bin.x0);
                const binWidth = x(bin.x1) - x(bin.x0);
                const binY = y(bin.scaledTotal);

                if (i === 0 || bin.scaledTotal !== scaledBackgroundData[i-1].scaledTotal) {
                    pathData.push({ x: binX, y: binY });
                }

                pathData.push({ x: binX + binWidth, y: binY });

                if (i === scaledBackgroundData.length - 1) {
                    pathData.push({ x: binX + binWidth, y: height });
                } else if (scaledBackgroundData[i + 1].scaledTotal !== bin.scaledTotal) {
                    pathData.push({ x: binX + binWidth, y: y(scaledBackgroundData[i + 1].scaledTotal) });
                }
            });

            bgBarGroup.append('path')
                .attr('class', 'background-histogram-outline')
                .attr('d', lineGenerator(pathData))
                .style('fill', 'none')
                .style('stroke', '#FBBF24')
                .style('stroke-width', 2)
                .style('opacity', 1)
                .style('pointer-events', 'none');
        }

        g.append('g')
            .attr('transform', `translate(0, ${height})`)
            .call(d3.axisBottom(x)
                .tickValues([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
                .tickFormat(d => d.toFixed(1)))
            .selectAll('text')
            .style('fill', '#A0A0A8');

        g.append('g')
            .call(d3.axisLeft(y).ticks(5))
            .selectAll('text')
            .style('fill', '#A0A0A8');

        g.selectAll('.domain, .tick line')
            .style('stroke', '#3D3D42');

        g.append('text')
            .attr('transform', `translate(${width / 2}, ${height + 40})`)
            .style('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#A0A0A8')
            .text('xG Value');
    }

    binShotsByXG(shots, thresholds, shotTypes, goalColors, savedColors) {
        return thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = shots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });

            const stacks = [];
            let y0 = 0;

            const typeCounts = {};

            shotTypes.forEach(type => {
                const typeShotsGoal = binShots.filter(s =>
                    this.getShotTypeCategory(s) === type && s.result === 'Goal'
                );
                const typeShotsSaved = binShots.filter(s =>
                    this.getShotTypeCategory(s) === type && s.result === 'Saved'
                );

                typeCounts[type] = {
                    goals: typeShotsGoal.length,
                    saved: typeShotsSaved.length
                };

                if (typeShotsGoal.length > 0) {
                    stacks.push({
                        type: type,
                        result: 'Goal',
                        count: typeShotsGoal.length,
                        y0: y0,
                        y1: y0 + typeShotsGoal.length,
                        color: goalColors[type]
                    });
                    y0 += typeShotsGoal.length;
                }
            });

            shotTypes.forEach(type => {
                const typeShotsSaved = binShots.filter(s =>
                    this.getShotTypeCategory(s) === type && s.result === 'Saved'
                );

                if (typeShotsSaved.length > 0) {
                    stacks.push({
                        type: type,
                        result: 'Saved',
                        count: typeShotsSaved.length,
                        y0: y0,
                        y1: y0 + typeShotsSaved.length,
                        color: savedColors[type]
                    });
                    y0 += typeShotsSaved.length;
                }
            });

            return {
                x0: threshold,
                x1: thresholds[i + 1],
                total: binShots.length,
                shots: binShots,
                stacks: stacks,
                typeCounts: typeCounts
            };
        });
    }

    generateTooltipText(bin) {
        if (!bin.typeCounts) {
            return `xG: ${bin.x0.toFixed(2)}-${bin.x1.toFixed(2)}\nTotal: ${bin.total} shots`;
        }

        const lines = [`xG: ${bin.x0.toFixed(2)}-${bin.x1.toFixed(2)}`, `Total: ${bin.total} shots`, ''];

        let totalGoals = 0;
        let totalSaved = 0;

        const shotTypes = ['Direct', 'One-timer', 'Direct Turnover', 'One-timer Turnover', 'Rebound'];

        lines.push('Goals:');
        shotTypes.forEach(type => {
            if (bin.typeCounts[type] && bin.typeCounts[type].goals > 0) {
                lines.push(`  ${type}: ${bin.typeCounts[type].goals}`);
                totalGoals += bin.typeCounts[type].goals;
            }
        });
        if (totalGoals === 0) {
            lines.push('  None');
        }
        lines.push(`  Total: ${totalGoals}`);
        lines.push('');

        lines.push('Saved:');
        shotTypes.forEach(type => {
            if (bin.typeCounts[type] && bin.typeCounts[type].saved > 0) {
                lines.push(`  ${type}: ${bin.typeCounts[type].saved}`);
                totalSaved += bin.typeCounts[type].saved;
            }
        });
        if (totalSaved === 0) {
            lines.push('  None');
        }
        lines.push(`  Total: ${totalSaved}`);

        return lines.join('\n');
    }

    drawDumbbellChart(selectedShots, allShots) {
        const container = document.getElementById('goalkeeper-dumbbell');
        if (!container) return;

        container.innerHTML = '';

        if (selectedShots.length === 0 && allShots.length === 0) return;

        const margin = { top: 10, right: 40, bottom: 40, left: 100 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = container.clientHeight - margin.top - margin.bottom;

        let dumbbellTooltip = d3.select('body').select('.dumbbell-tooltip');
        if (dumbbellTooltip.empty()) {
            dumbbellTooltip = d3.select('body')
                .append('div')
                .attr('class', 'dumbbell-tooltip tooltip');
        }

        dumbbellTooltip
            .style('position', 'absolute')
            .style('opacity', 0)
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', '#fff')
            .style('padding', '10px')
            .style('border-radius', '0px')
            .style('border', '1px solid rgba(255, 255, 255, 0.2)')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '10000')
            .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.5)')
            .style('line-height', '1.4');

        const svg = d3.select(container)
            .append('svg')
            .attr('width', container.clientWidth)
            .attr('height', container.clientHeight);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const selectedStats = this.calculateStats(selectedShots);
        const allStats = this.calculateStats(allShots);

        const perGameRanges = this.calculatePerGameRanges(allShots);

        const metrics = [
            { label: 'Avg. xG', savedKey: 'avgSavedXG', goalKey: 'avgGoalXG', rangeKey: 'xg' },
            { label: 'Avg. Dist', savedKey: 'avgSavedDistance', goalKey: 'avgGoalDistance', rangeKey: 'distance' }
        ];

        const rowHeight = height / metrics.length;

        const isFiltered = this.selectedGoalkeeper || (selectedShots.length < allShots.length);

        const updateTooltip = () => {
            const html = `
                <div style="margin-bottom: 8px; font-weight: bold; padding-bottom: 3px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <span style="display: inline-block; width: 90px;"></span>
                    <span style="display: inline-block; width: 60px; text-align: right;">Selected</span>
                    <span style="display: inline-block; width: 60px; text-align: right;">Reference</span>
                </div>
                <div style="margin-bottom: 3px;">
                    <span style="display: inline-block; width: 90px; color: #10B981;">xG Saved:</span>
                    <span style="display: inline-block; width: 60px; text-align: right; color: #fff;">${selectedStats.avgSavedXG.toFixed(3)}</span>
                    <span style="display: inline-block; width: 60px; text-align: right; color: #fff;">${allStats.avgSavedXG.toFixed(3)}</span>
                </div>
                <div style="margin-bottom: 5px;">
                    <span style="display: inline-block; width: 90px; color: #7C3AED;">xG Goal:</span>
                    <span style="display: inline-block; width: 60px; text-align: right; color: #fff;">${selectedStats.avgGoalXG.toFixed(3)}</span>
                    <span style="display: inline-block; width: 60px; text-align: right; color: #fff;">${allStats.avgGoalXG.toFixed(3)}</span>
                </div>
                <div style="margin-bottom: 3px;">
                    <span style="display: inline-block; width: 90px; color: #10B981;">Dist Saved:</span>
                    <span style="display: inline-block; width: 60px; text-align: right; color: #fff;">${selectedStats.avgSavedDistance.toFixed(1)}m</span>
                    <span style="display: inline-block; width: 60px; text-align: right; color: #fff;">${allStats.avgSavedDistance.toFixed(1)}m</span>
                </div>
                <div>
                    <span style="display: inline-block; width: 90px; color: #7C3AED;">Dist Goal:</span>
                    <span style="display: inline-block; width: 60px; text-align: right; color: #fff;">${selectedStats.avgGoalDistance.toFixed(1)}m</span>
                    <span style="display: inline-block; width: 60px; text-align: right; color: #fff;">${allStats.avgGoalDistance.toFixed(1)}m</span>
                </div>
            `;
            dumbbellTooltip.html(html);
        };

        const arrowY = height + 1;
        const textY = height + 15;
        const arrowGroup = g.append('g')
            .attr('class', 'scale-indicator');

        arrowGroup.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', arrowY)
            .attr('y2', arrowY)
            .style('stroke', '#A0A0A8')
            .style('stroke-width', 1)
            .attr('marker-start', 'url(#arrow-start)')
            .attr('marker-end', 'url(#arrow-end)');

        const defs = svg.append('defs');

        defs.append('marker')
            .attr('id', 'arrow-start')
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('refX', 0)
            .attr('refY', 4)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M 8 1 L 8 7 L 1 4 Z')
            .style('fill', '#A0A0A8');

        defs.append('marker')
            .attr('id', 'arrow-end')
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('refX', 8)
            .attr('refY', 4)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M 0 1 L 0 7 L 7 4 Z')
            .style('fill', '#A0A0A8');

        arrowGroup.append('text')
            .attr('x', 2)
            .attr('y', textY)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '11px')
            .style('fill', '#A0A0A8')
            .text('worse');

        arrowGroup.append('text')
            .attr('x', width - 2)
            .attr('y', textY)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '11px')
            .style('fill', '#A0A0A8')
            .text('better');

        metrics.forEach((metric, i) => {
            const y = i * rowHeight + rowHeight / 2;

            const range = perGameRanges[metric.rangeKey];
            let minVal = range.min;
            let maxVal = range.max;

            const rangeSize = maxVal - minVal;
            const padding = rangeSize * 0.1;
            minVal = Math.max(0, minVal - padding);
            maxVal = maxVal + padding;

            const scale = d3.scaleLinear()
                .domain([minVal, maxVal])
                .range(metric.rangeKey === 'distance' ? [width, 0] : [0, width]);

            const rowGroup = g.append('g')
                .attr('class', 'dumbbell-row')
                .style('cursor', 'pointer')
                .on('mouseenter', function(event) {
                    updateTooltip();
                    dumbbellTooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                    dumbbellTooltip
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                })
                .on('mousemove', function(event) {
                    dumbbellTooltip
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                })
                .on('mouseleave', () => {
                    dumbbellTooltip.transition()
                        .duration(200)
                        .style('opacity', 0);
                });

            rowGroup.append('rect')
                .attr('x', -margin.left)
                .attr('y', -rowHeight / 2)
                .attr('width', margin.left + width + margin.right)
                .attr('height', rowHeight)
                .style('fill', 'transparent');

            rowGroup.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', y)
                .attr('y2', y)
                .style('stroke', '#3D3D42')
                .style('stroke-width', 1);

            rowGroup.append('text')
                .attr('x', -10)
                .attr('y', y)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .style('font-size', '11px')
                .style('fill', '#A0A0A8')
                .text(metric.label);

            const allSavedVal = allStats[metric.savedKey];
            const allGoalVal = allStats[metric.goalKey];
            const selectedSavedVal = selectedStats[metric.savedKey];
            const selectedGoalVal = selectedStats[metric.goalKey];

            if (isFiltered && !isNaN(allSavedVal) && !isNaN(allGoalVal)) {
                rowGroup.append('line')
                    .attr('x1', scale(allSavedVal))
                    .attr('x2', scale(allGoalVal))
                    .attr('y1', y)
                    .attr('y2', y)
                    .style('stroke', '#FBBF24')
                    .style('stroke-width', 1)
                    .style('stroke-dasharray', '4,2')
                    .style('opacity', 0.5);
            }

            if (!isNaN(selectedSavedVal) && !isNaN(selectedGoalVal)) {
                rowGroup.append('line')
                    .attr('x1', scale(selectedSavedVal))
                    .attr('x2', scale(selectedGoalVal))
                    .attr('y1', y)
                    .attr('y2', y)
                    .style('stroke', '#A0A0A8')
                    .style('stroke-width', 3);

                const savedCircle = rowGroup.append('circle')
                    .attr('cx', scale(selectedSavedVal))
                    .attr('cy', y)
                    .attr('r', 6)
                    .style('fill', '#10B981')
                    .style('cursor', 'pointer');

                savedCircle.append('title')
                    .text(`Saved: ${selectedSavedVal.toFixed(3)}`);

                // Add value label above saved circle
                const savedValueText = metric.rangeKey === 'distance'
                    ? selectedSavedVal.toFixed(1)
                    : selectedSavedVal.toFixed(1);

                rowGroup.append('text')
                    .attr('x', scale(selectedSavedVal))
                    .attr('y', y - 10)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('fill', '#A0A0A8')
                    .text(savedValueText);

                const goalCircle = rowGroup.append('circle')
                    .attr('cx', scale(selectedGoalVal))
                    .attr('cy', y)
                    .attr('r', 6)
                    .style('fill', '#7C3AED')
                    .style('cursor', 'pointer');

                goalCircle.append('title')
                    .text(`Goal: ${selectedGoalVal.toFixed(3)}`);

                // Add value label above goal circle
                const goalValueText = metric.rangeKey === 'distance'
                    ? selectedGoalVal.toFixed(1)
                    : selectedGoalVal.toFixed(1);

                rowGroup.append('text')
                    .attr('x', scale(selectedGoalVal))
                    .attr('y', y - 10)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('fill', '#A0A0A8')
                    .text(goalValueText);
            }

            if (isFiltered && !isNaN(allSavedVal) && !isNaN(allGoalVal)) {
                const refCircleSaved = rowGroup.append('circle')
                    .attr('cx', scale(allSavedVal))
                    .attr('cy', y)
                    .attr('r', 5)
                    .style('fill', 'none')
                    .style('stroke', '#FBBF24')
                    .style('stroke-width', 2)
                    .style('opacity', 1)
                    .style('cursor', 'pointer');

                refCircleSaved.append('title')
                    .text(`Reference Saved: ${allSavedVal.toFixed(2)}`);

                const refCircleGoal = rowGroup.append('circle')
                    .attr('cx', scale(allGoalVal))
                    .attr('cy', y)
                    .attr('r', 5)
                    .style('fill', 'none')
                    .style('stroke', '#FBBF24')
                    .style('stroke-width', 2)
                    .style('opacity', 1)
                    .style('cursor', 'pointer');

                refCircleGoal.append('title')
                    .text(`Reference Goal: ${allGoalVal.toFixed(2)}`);
            }
        });
    }

    calculateStats(shots) {
        if (shots.length === 0) {
            return {
                avgSavedXG: NaN,
                avgGoalXG: NaN,
                avgSavedDistance: NaN,
                avgGoalDistance: NaN
            };
        }

        const savedShots = shots.filter(s => s.result === 'Saved');
        const goalShots = shots.filter(s => s.result === 'Goal');

        const avgSavedXG = savedShots.length > 0
            ? d3.mean(savedShots, d => parseFloat(d.xg))
            : NaN;

        const avgGoalXG = goalShots.length > 0
            ? d3.mean(goalShots, d => parseFloat(d.xg))
            : NaN;

        const avgSavedDistance = savedShots.length > 0
            ? d3.mean(savedShots, d => parseFloat(d.distance))
            : NaN;

        const avgGoalDistance = goalShots.length > 0
            ? d3.mean(goalShots, d => parseFloat(d.distance))
            : NaN;

        return {
            avgSavedXG,
            avgGoalXG,
            avgSavedDistance,
            avgGoalDistance
        };
    }

    calculatePerGameRanges(allShots) {
        if (!allShots || allShots.length === 0) {
            return {
                xg: { min: 0, max: 0.6 },
                distance: { min: 0, max: 25 }
            };
        }

        const gameIds = [...new Set(allShots.map(s => s.game_id))];

        const perGameStats = gameIds.map(gameId => {
            const gameShots = allShots.filter(s => s.game_id === gameId);
            return this.calculateStats(gameShots);
        });

        const xgValues = [];
        const distanceValues = [];

        perGameStats.forEach(stats => {
            if (!isNaN(stats.avgSavedXG)) xgValues.push(stats.avgSavedXG);
            if (!isNaN(stats.avgGoalXG)) xgValues.push(stats.avgGoalXG);
            if (!isNaN(stats.avgSavedDistance)) distanceValues.push(stats.avgSavedDistance);
            if (!isNaN(stats.avgGoalDistance)) distanceValues.push(stats.avgGoalDistance);
        });

        return {
            xg: {
                min: xgValues.length > 0 ? d3.min(xgValues) : 0,
                max: xgValues.length > 0 ? d3.max(xgValues) : 0.6
            },
            distance: {
                min: distanceValues.length > 0 ? d3.min(distanceValues) : 0,
                max: distanceValues.length > 0 ? d3.max(distanceValues) : 25
            }
        };
    }
}

const goalkeeperHistogram = new GoalkeeperHistogram();
