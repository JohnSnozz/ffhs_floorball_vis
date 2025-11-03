class PlayerMetrics {
    constructor(app) {
        this.app = app;
        this.currentData = null;
        this.selectedPlayer = null;
    }

    setData(gameData, selectedPlayer = null) {
        this.currentData = gameData;
        this.selectedPlayer = selectedPlayer;
        this.createMetricsChart();
    }

    calculatePlayerMetrics(player, data) {
        const playerShots = data.filter(shot => shot.shooter === player);

        if (playerShots.length === 0) {
            return null;
        }

        const goals = playerShots.filter(shot => shot.result === 'Goal').length;
        const totalShots = playerShots.length;
        const totalXG = d3.sum(playerShots, shot => parseFloat(shot.xg) || 0);
        const avgXG = totalXG / totalShots;
        const conversionRate = totalShots > 0 ? (goals / totalShots) * 100 : 0;
        const gax = goals - totalXG;

        const distances = playerShots.map(shot => parseFloat(shot.distance)).filter(d => !isNaN(d));
        const avgDistance = distances.length > 0 ? d3.mean(distances) : 0;

        const shotsOnGoal = playerShots.filter(shot => shot.result === 'Goal' || shot.result === 'Saved').length;
        const shotsOnGoalPct = totalShots > 0 ? (shotsOnGoal / totalShots) * 100 : 0;

        const blocked = playerShots.filter(shot => shot.result === 'Blocked').length;
        const blockedPct = totalShots > 0 ? (blocked / totalShots) * 100 : 0;

        const missed = playerShots.filter(shot => shot.result === 'Missed').length;
        const missedPct = totalShots > 0 ? (missed / totalShots) * 100 : 0;

        const saved = playerShots.filter(shot => shot.result === 'Saved').length;
        const savedPct = totalShots > 0 ? (saved / totalShots) * 100 : 0;

        const goalPct = totalShots > 0 ? (goals / totalShots) * 100 : 0;

        const assists = data.filter(shot => shot.passer === player && shot.result === 'Goal').length;
        const passShots = data.filter(shot => shot.passer === player);
        const assistXG = passShots.length > 0 ? d3.mean(passShots, shot => parseFloat(shot.xg) || 0) : 0;

        const points = goals + assists;

        const corsiFor = data.filter(shot => {
            const playerOnIce = shot.t1lw === player || shot.t1c === player || shot.t1rw === player ||
                               shot.t1ld === player || shot.t1rd === player;
            const team1 = shot.team1;
            return playerOnIce && shot.shooting_team === team1;
        }).length;

        const corsiAgainst = data.filter(shot => {
            const playerOnIce = shot.t1lw === player || shot.t1c === player || shot.t1rw === player ||
                               shot.t1ld === player || shot.t1rd === player;
            const team1 = shot.team1;
            return playerOnIce && shot.shooting_team !== team1;
        }).length;

        const corsi = corsiFor - corsiAgainst;

        const fenwickFor = data.filter(shot => {
            const playerOnIce = shot.t1lw === player || shot.t1c === player || shot.t1rw === player ||
                               shot.t1ld === player || shot.t1rd === player;
            const team1 = shot.team1;
            return playerOnIce && shot.shooting_team === team1 && shot.result !== 'Blocked';
        }).length;

        const fenwickAgainst = data.filter(shot => {
            const playerOnIce = shot.t1lw === player || shot.t1c === player || shot.t1rw === player ||
                               shot.t1ld === player || shot.t1rd === player;
            const team1 = shot.team1;
            return playerOnIce && shot.shooting_team !== team1 && shot.result !== 'Blocked';
        }).length;

        const fenwick = fenwickFor - fenwickAgainst;

        const shotQuality = shotsOnGoal > 0
            ? d3.mean(playerShots.filter(shot => shot.result === 'Goal' || shot.result === 'Saved'), shot => parseFloat(shot.xg) || 0)
            : 0;

        const goalsFor = data.filter(shot => {
            const playerOnIce = shot.t1lw === player || shot.t1c === player || shot.t1rw === player ||
                               shot.t1ld === player || shot.t1rd === player;
            const team1 = shot.team1;
            return playerOnIce && shot.shooting_team === team1 && shot.result === 'Goal';
        }).length;

        const goalsAgainst = data.filter(shot => {
            const playerOnIce = shot.t1lw === player || shot.t1c === player || shot.t1rw === player ||
                               shot.t1ld === player || shot.t1rd === player;
            const team1 = shot.team1;
            return playerOnIce && shot.shooting_team !== team1 && shot.result === 'Goal';
        }).length;

        const plusMinus = goalsFor - goalsAgainst;

        const shotAttempts = totalShots + blocked;
        const goalsPerShotAttempt = shotAttempts > 0 ? goals / shotAttempts : 0;

        const xgPerShotAttempt = shotAttempts > 0 ? totalXG / shotAttempts : 0;

        const shootingEfficiency = totalShots > 0 ? (goals - totalXG) / totalShots : 0;

        return {
            player,
            goals,
            totalShots,
            avgXG,
            conversionRate,
            gax,
            avgDistance,
            shotsOnGoalPct,
            blockedPct,
            missedPct,
            savedPct,
            goalPct,
            assists,
            points,
            assistXG,
            corsi,
            fenwick,
            shotQuality,
            plusMinus,
            goalsPerShotAttempt,
            xgPerShotAttempt,
            shootingEfficiency
        };
    }

    calculateTeamAverage(data) {
        const allPlayers = [...new Set(data.map(shot => shot.shooter))].filter(p => p);
        const playerMetrics = allPlayers.map(player => this.calculatePlayerMetrics(player, data)).filter(m => m);

        if (playerMetrics.length === 0) {
            return null;
        }

        return {
            avgXG: d3.mean(playerMetrics, m => m.avgXG),
            conversionRate: d3.mean(playerMetrics, m => m.conversionRate),
            gax: d3.mean(playerMetrics, m => m.gax),
            avgDistance: d3.mean(playerMetrics, m => m.avgDistance),
            shotsOnGoalPct: d3.mean(playerMetrics, m => m.shotsOnGoalPct),
            blockedPct: d3.mean(playerMetrics, m => m.blockedPct),
            missedPct: d3.mean(playerMetrics, m => m.missedPct),
            savedPct: d3.mean(playerMetrics, m => m.savedPct),
            goalPct: d3.mean(playerMetrics, m => m.goalPct),
            assists: d3.mean(playerMetrics, m => m.assists),
            goals: d3.mean(playerMetrics, m => m.goals),
            points: d3.mean(playerMetrics, m => m.points),
            assistXG: d3.mean(playerMetrics, m => m.assistXG),
            corsi: d3.mean(playerMetrics, m => m.corsi),
            fenwick: d3.mean(playerMetrics, m => m.fenwick),
            totalShots: d3.mean(playerMetrics, m => m.totalShots),
            shotQuality: d3.mean(playerMetrics, m => m.shotQuality),
            plusMinus: d3.mean(playerMetrics, m => m.plusMinus),
            goalsPerShotAttempt: d3.mean(playerMetrics, m => m.goalsPerShotAttempt),
            xgPerShotAttempt: d3.mean(playerMetrics, m => m.xgPerShotAttempt),
            shootingEfficiency: d3.mean(playerMetrics, m => m.shootingEfficiency)
        };
    }

    calculateRanking(player, metric, data, higherIsBetter) {
        const allPlayers = [...new Set(data.map(shot => shot.shooter))].filter(p => p);
        const playerMetrics = allPlayers.map(p => this.calculatePlayerMetrics(p, data)).filter(m => m);

        const sorted = higherIsBetter
            ? playerMetrics.sort((a, b) => b[metric] - a[metric])
            : playerMetrics.sort((a, b) => a[metric] - b[metric]);

        const rank = sorted.findIndex(m => m.player === player) + 1;
        const total = sorted.length;

        return { rank, total };
    }

    createMetricsChart() {
        const container = d3.select('.playermetrics');
        container.selectAll('*').remove();

        if (!this.currentData || this.currentData.length === 0) {
            return;
        }

        const teamAverage = this.calculateTeamAverage(this.currentData);

        if (!teamAverage) {
            container.append('div')
                .style('text-align', 'center')
                .style('color', '#A0A0A8')
                .style('padding', '20px')
                .text('No metrics available');
            return;
        }

        let playerMetrics = null;
        if (this.selectedPlayer) {
            playerMetrics = this.calculatePlayerMetrics(this.selectedPlayer, this.currentData);
        }

        // Title
        container.append('div')
            .style('text-align', 'right')
            .style('font-size', '11px')
            .style('color', '#A0A0A8')
            .style('font-weight', '600')
            .style('margin-bottom', '8px')
            .text('Player Performance Metrics');

        const containerRect = container.node().getBoundingClientRect();
        const margin = { top: 10, right: 45, bottom: 30, left: 100 };
        const width = containerRect.width - margin.left - margin.right;
        const height = containerRect.height - margin.top - margin.bottom - 30;

        const svg = container.append('svg')
            .attr('width', containerRect.width)
            .attr('height', height + margin.top + margin.bottom);

        const defs = svg.append('defs');

        defs.append('marker')
            .attr('id', 'arrow-start-pm')
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('refX', 0)
            .attr('refY', 4)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M 8 1 L 8 7 L 1 4 Z')
            .style('fill', '#A0A0A8');

        defs.append('marker')
            .attr('id', 'arrow-end-pm')
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('refX', 8)
            .attr('refY', 4)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M 0 1 L 0 7 L 7 4 Z')
            .style('fill', '#A0A0A8');

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const metrics = [
            { key: 'points', label: 'Points', format: d => Math.round(d), higherIsBetter: true },
            { key: 'goals', label: 'Goals', format: d => Math.round(d), higherIsBetter: true },
            { key: 'assists', label: 'Assists', format: d => Math.round(d), higherIsBetter: true },
            { key: 'plusMinus', label: '+/-', format: d => d > 0 ? '+' + Math.round(d) : Math.round(d), higherIsBetter: true },
            { key: 'avgXG', label: 'Avg xG/Shot', format: d => d.toFixed(3), higherIsBetter: true },
            { key: 'shotQuality', label: 'Shot Quality', format: d => d.toFixed(3), higherIsBetter: true },
            { key: 'conversionRate', label: 'Conversion %', format: d => d.toFixed(1) + '%', higherIsBetter: true },
            { key: 'gax', label: 'Goals Above xG', format: d => d > 0 ? '+' + d.toFixed(1) : d.toFixed(1), higherIsBetter: true },
            { key: 'shootingEfficiency', label: 'Shooting Efficiency', format: d => d > 0 ? '+' + d.toFixed(3) : d.toFixed(3), higherIsBetter: true },
            { key: 'shotsOnGoalPct', label: 'Shots on Goal %', format: d => d.toFixed(1) + '%', higherIsBetter: true },
            { key: 'totalShots', label: 'Shot Volume', format: d => Math.round(d), higherIsBetter: true },
            { key: 'goalsPerShotAttempt', label: 'Goals/Shot Attempt', format: d => d.toFixed(3), higherIsBetter: true },
            { key: 'xgPerShotAttempt', label: 'xG/Shot Attempt', format: d => d.toFixed(3), higherIsBetter: true },
            { key: 'assistXG', label: 'Avg Assist xG', format: d => d.toFixed(3), higherIsBetter: true },
            { key: 'avgDistance', label: 'Avg Distance', format: d => d.toFixed(1) + 'm', higherIsBetter: false },
            { key: 'corsi', label: 'Corsi +/-', format: d => d > 0 ? '+' + Math.round(d) : Math.round(d), higherIsBetter: true },
            { key: 'fenwick', label: 'Fenwick +/-', format: d => d > 0 ? '+' + Math.round(d) : Math.round(d), higherIsBetter: true },
            { key: 'blockedPct', label: 'Blocked %', format: d => d.toFixed(1) + '%', higherIsBetter: false },
            { key: 'missedPct', label: 'Missed %', format: d => d.toFixed(1) + '%', higherIsBetter: false },
            { key: 'savedPct', label: 'Saved %', format: d => d.toFixed(1) + '%', higherIsBetter: false },
            { key: 'goalPct', label: 'Goal %', format: d => d.toFixed(1) + '%', higherIsBetter: true }
        ];

        const rowHeight = height / metrics.length;

        metrics.forEach((metric, i) => {
            const y = i * rowHeight + rowHeight / 2;

            const teamValue = teamAverage[metric.key];

            // Get all player values for this metric
            const allPlayers = [...new Set(this.currentData.map(shot => shot.shooter))].filter(p => p);
            const allPlayerMetrics = allPlayers.map(p => this.calculatePlayerMetrics(p, this.currentData)).filter(m => m);
            const allValues = allPlayerMetrics.map(m => m[metric.key]);

            const minVal = d3.min(allValues);
            const maxVal = d3.max(allValues);
            const range = maxVal - minVal || 1;
            const padding = range * 0.1;

            const scale = d3.scaleLinear()
                .domain([minVal - padding, maxVal + padding])
                .range(metric.higherIsBetter ? [0, width] : [width, 0]);

            const rowGroup = g.append('g')
                .attr('class', 'metric-row');

            // Background line
            rowGroup.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', y)
                .attr('y2', y)
                .style('stroke', '#3D3D42')
                .style('stroke-width', 1);

            // Team average marker (vertical line)
            rowGroup.append('line')
                .attr('x1', scale(teamValue))
                .attr('x2', scale(teamValue))
                .attr('y1', y - 5)
                .attr('y2', y + 5)
                .style('stroke', '#A0A0A8')
                .style('stroke-width', 2);

            // Metric label (left)
            g.append('text')
                .attr('x', -10)
                .attr('y', y)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .style('font-size', '11px')
                .style('fill', '#E5E5E7')
                .text(metric.label);

            // Team average value (above marker) - only show when no player selected
            if (!playerMetrics) {
                g.append('text')
                    .attr('x', scale(teamValue))
                    .attr('y', y - 12)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('fill', '#A0A0A8')
                    .style('font-weight', '600')
                    .text(metric.format(teamValue));
            }

            if (playerMetrics) {
                const playerValue = playerMetrics[metric.key];

                const isBetter = metric.higherIsBetter
                    ? playerValue > teamValue
                    : playerValue < teamValue;

                const color = isBetter ? '#10B981' : '#7C3AED';

                // Connecting line between player and team
                rowGroup.append('line')
                    .attr('x1', scale(teamValue))
                    .attr('x2', scale(playerValue))
                    .attr('y1', y)
                    .attr('y2', y)
                    .style('stroke', color)
                    .style('stroke-width', 2);

                // Player circle
                rowGroup.append('circle')
                    .attr('cx', scale(playerValue))
                    .attr('cy', y)
                    .attr('r', 5)
                    .style('fill', color)
                    .style('stroke', '#fff')
                    .style('stroke-width', 1);

                // Player value (above circle)
                g.append('text')
                    .attr('x', scale(playerValue))
                    .attr('y', y - 12)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('fill', color)
                    .style('font-weight', '600')
                    .text(metric.format(playerValue));

                // Ranking (right side)
                const ranking = this.calculateRanking(this.selectedPlayer, metric.key, this.currentData, metric.higherIsBetter);
                const rankingSuffix = ranking.rank === 1 ? 'st' : ranking.rank === 2 ? 'nd' : ranking.rank === 3 ? 'rd' : 'th';

                g.append('text')
                    .attr('x', width + 10)
                    .attr('y', y)
                    .attr('text-anchor', 'start')
                    .attr('dominant-baseline', 'middle')
                    .style('font-size', '10px')
                    .style('fill', '#A0A0A8')
                    .text(`${ranking.rank}${rankingSuffix}/${ranking.total}`);
            }
        });

        const arrowY = height + 10;
        const arrowGroup = g.append('g');

        arrowGroup.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', arrowY)
            .attr('y2', arrowY)
            .style('stroke', '#A0A0A8')
            .style('stroke-width', 1)
            .attr('marker-start', 'url(#arrow-start-pm)')
            .attr('marker-end', 'url(#arrow-end-pm)');

        g.append('text')
            .attr('x', 5)
            .attr('y', arrowY + 15)
            .attr('text-anchor', 'start')
            .style('font-size', '10px')
            .style('fill', '#A0A0A8')
            .text('worse');

        g.append('text')
            .attr('x', width - 5)
            .attr('y', arrowY + 15)
            .attr('text-anchor', 'end')
            .style('font-size', '10px')
            .style('fill', '#A0A0A8')
            .text('better');
    }
}

window.PlayerMetrics = PlayerMetrics;
