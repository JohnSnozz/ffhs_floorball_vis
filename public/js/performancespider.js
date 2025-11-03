class PerformanceSpider {
    constructor(app) {
        this.app = app;
    }

    createSpiderDiagram(svg, playerData, teamData, allData, allDataForScale, width, height, position) {
        svg.selectAll('.spider-diagram-group').remove();

        console.log('Spider Diagram Debug:', {
            width,
            height,
            position,
            svgNode: svg.node()
        });

        const group = svg.append('g')
            .attr('class', 'spider-diagram-group')
            .attr('transform', `translate(${position.x}, ${position.y})`);

        const playerMetrics = this.calculateSpiderMetrics(
            playerData?.shots || playerData,
            playerData?.allShots || allData
        );
        const teamMetrics = teamData ? this.calculateSpiderMetrics(
            teamData?.shots || teamData,
            teamData?.allShots || allData
        ) : null;

        if (teamMetrics) {
            teamMetrics.corsi = teamMetrics.corsi / 3;
            teamMetrics.fenwick = teamMetrics.fenwick / 3;
            teamMetrics.xGPlusMinus = teamMetrics.xGPlusMinus / 3;
            teamMetrics.xSOGPlusMinus = teamMetrics.xSOGPlusMinus / 3;
        }
        const scaleMetrics = this.calculateSpiderMetrics(allDataForScale, allDataForScale);

        console.log('=== SPIDER DIAGRAM DEBUG ===');
        console.log('Player metrics:', playerMetrics);
        if (teamMetrics) {
            console.log('Team metrics:', teamMetrics);
            console.log('Comparison:');
            console.log(`  Corsi: Player ${playerMetrics.corsi.toFixed(1)} vs Team ${teamMetrics.corsi.toFixed(1)}`);
            console.log(`  Fenwick: Player ${playerMetrics.fenwick.toFixed(1)} vs Team ${teamMetrics.fenwick.toFixed(1)}`);
            console.log(`  xG +/-: Player ${playerMetrics.xGPlusMinus.toFixed(1)} vs Team ${teamMetrics.xGPlusMinus.toFixed(1)}`);
            console.log(`  xSOG +/-: Player ${playerMetrics.xSOGPlusMinus.toFixed(1)} vs Team ${teamMetrics.xSOGPlusMinus.toFixed(1)}`);
        }

        const axes = [
            { key: 'blockedPct', label: 'Blocked %', color: '#E06B47' },
            { key: 'missedPct', label: 'Missed %', color: '#E8B44F' },
            { key: 'savedPct', label: 'Saved %', color: '#5B8DBE' },
            { key: 'goalPct', label: 'Goal %', color: '#7FB069' },
            { key: 'corsi', label: 'Corsi', color: '#9B7EBD' },
            { key: 'fenwick', label: 'Fenwick', color: '#A0A0A8' },
            { key: 'xGPlusMinus', label: 'xG +/-', color: '#E07BB0' },
            { key: 'xSOGPlusMinus', label: 'xSOG +/-', color: '#4ECDC4' }
        ];

        const allTeams = [...new Set(allDataForScale.map(d => d.shooting_team))].filter(t => t);

        axes.forEach(axis => {
            const allValues = allTeams.map(team => {
                const teamShots = allDataForScale.filter(d => d.shooting_team === team);
                const metrics = this.calculateSpiderMetrics(teamShots, allDataForScale);
                return metrics[axis.key];
            }).filter(v => v !== undefined && v !== null && !isNaN(v));

            if (allValues.length === 0) {
                axis.min = 0;
                axis.max = 100;
                return;
            }

            const dataMin = Math.min(...allValues);
            const dataMax = Math.max(...allValues);

            if (axis.key.includes('Pct')) {
                const buffer = 10;
                axis.min = Math.max(0, dataMin - buffer);
                axis.max = Math.min(100, dataMax + buffer);
            } else {
                const absMax = Math.max(Math.abs(dataMin), Math.abs(dataMax)) * 1.2;
                axis.min = -absMax;
                axis.max = absMax;
                console.log(`${axis.label}: min=${axis.min.toFixed(1)}, max=${axis.max.toFixed(1)}, dataMin=${dataMin.toFixed(1)}, dataMax=${dataMax.toFixed(1)}`);
            }
        });

        const radius = 80;
        const centerX = 0;
        const centerY = 0;
        const levels = 5;
        const numAxes = 8;
        const angleSlice = (2 * Math.PI) / numAxes;

        const radialScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);

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

        axes.forEach((axis, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            group.append('line')
                .attr('class', 'axis-line')
                .attr('x1', centerX)
                .attr('y1', centerY)
                .attr('x2', centerX + Math.cos(angle) * radius)
                .attr('y2', centerY + Math.sin(angle) * radius)
                .style('stroke', '#2A2D34')
                .style('stroke-width', 1);
        });

        const drawRadarArea = (metrics, className, fillColor, strokeColor, fillOpacity) => {
            const points = axes.map((axis, i) => {
                const angle = angleSlice * i - Math.PI / 2;
                const value = this.normalizeSpiderValue(metrics[axis.key], axis);
                const r = radialScale(value);
                return {
                    x: centerX + Math.cos(angle) * r,
                    y: centerY + Math.sin(angle) * r
                };
            });

            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join('') + 'Z';

            group.append('path')
                .attr('class', className)
                .attr('d', pathData)
                .style('fill', fillColor)
                .style('fill-opacity', fillOpacity)
                .style('stroke', strokeColor)
                .style('stroke-width', 2);
        };

        if (teamMetrics) {
            drawRadarArea(teamMetrics, 'radar-area-team', 'none', '#FFFFFF', 0);
        }

        drawRadarArea(playerMetrics, 'radar-area-player', '#5B8DBE', '#5B8DBE', 0.2);

        const labelRadius = radius + 25;
        axes.forEach((axis, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            const x = centerX + Math.cos(angle) * labelRadius;
            const y = centerY + Math.sin(angle) * labelRadius;

            const value = playerMetrics[axis.key];
            const displayValue = axis.key.includes('Pct') ? `${value.toFixed(1)}%` : value.toFixed(1);

            const labelColor = axis.key.includes('Pct') ? axis.color : '#A0A0A8';

            const labelGroup = group.append('text')
                .attr('x', x)
                .attr('y', y)
                .style('font-size', '10px')
                .style('fill', labelColor)
                .style('text-anchor', 'middle')
                .style('dominant-baseline', 'middle');

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

        group.append('text')
            .attr('x', centerX)
            .attr('y', -radius - 40)
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .style('text-anchor', 'middle')
            .text('Performance Metrics');
    }

    calculateSpiderMetrics(data, allData) {
        if (!data || data.length === 0) {
            return {
                blockedPct: 0, missedPct: 0, savedPct: 0, goalPct: 0,
                corsi: 0, fenwick: 0, xGPlusMinus: 0, xSOGPlusMinus: 0
            };
        }

        const total = data.length;
        const blocked = data.filter(d => d.result === 'Blocked').length;
        const missed = data.filter(d => d.result === 'Missed').length;
        const saved = data.filter(d => d.result === 'Saved').length;
        const goals = data.filter(d => d.result === 'Goal').length;

        const teamName = data[0]?.team1 || data[0]?.shooting_team;

        const dataForCorsi = allData || data;
        const shotsFor = dataForCorsi.filter(d => d.shooting_team === teamName).length;
        const shotsAgainst = dataForCorsi.filter(d => d.shooting_team !== teamName).length;
        const corsi = shotsFor - shotsAgainst;

        console.log(`calculateSpiderMetrics for ${teamName}: data=${data.length}, allData=${dataForCorsi.length}, shotsFor=${shotsFor}, shotsAgainst=${shotsAgainst}, corsi=${corsi}`);

        const fenwickFor = dataForCorsi.filter(d =>
            d.shooting_team === teamName && d.result !== 'Blocked'
        ).length;
        const fenwickAgainst = dataForCorsi.filter(d =>
            d.shooting_team !== teamName && d.result !== 'Blocked'
        ).length;
        const fenwick = fenwickFor - fenwickAgainst;

        const xGFor = dataForCorsi
            .filter(d => d.shooting_team === teamName)
            .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
        const xGAgainst = dataForCorsi
            .filter(d => d.shooting_team !== teamName)
            .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
        const xGPlusMinus = xGFor - xGAgainst;

        const xSOGFor = dataForCorsi
            .filter(d => d.shooting_team === teamName && (d.result === 'Saved' || d.result === 'Goal'))
            .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
        const xSOGAgainst = dataForCorsi
            .filter(d => d.shooting_team !== teamName && (d.result === 'Saved' || d.result === 'Goal'))
            .reduce((sum, d) => sum + (parseFloat(d.xg) || 0), 0);
        const xSOGPlusMinus = xSOGFor - xSOGAgainst;

        return {
            blockedPct: (blocked / total) * 100,
            missedPct: (missed / total) * 100,
            savedPct: (saved / total) * 100,
            goalPct: (goals / total) * 100,
            corsi: corsi,
            fenwick: fenwick,
            xGPlusMinus: xGPlusMinus,
            xSOGPlusMinus: xSOGPlusMinus
        };
    }

    normalizeSpiderValue(value, axis) {
        const range = axis.max - axis.min;
        if (range === 0) return 50;

        if (axis.key === 'blockedPct' || axis.key === 'missedPct' || axis.key === 'savedPct') {
            const normalized = ((axis.max - value) / range) * 100;
            return Math.max(0, Math.min(100, normalized));
        } else {
            const normalized = ((value - axis.min) / range) * 100;
            return Math.max(0, Math.min(100, normalized));
        }
    }
}

window.PerformanceSpider = PerformanceSpider;
