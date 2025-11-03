class XGScatterPlot {
    constructor(app) {
        this.app = app;
        this.currentData = null;
        this.selectedShooter = null;
        this.typeFilters = [];
        this.turnoverState = 'off';
    }

    setFilters(selectedShooter = null, typeFilters = [], turnoverState = 'off') {
        this.selectedShooter = selectedShooter;
        this.typeFilters = typeFilters;
        this.turnoverState = turnoverState;
    }

    createScatterPlot(data) {
        if (!data || data.length === 0) {
            return;
        }

        this.currentData = data;

        d3.selectAll('.xgscatter-tooltip').remove();

        const container = d3.select('.xgscatter');
        container.selectAll('*').remove();

        const filteredData = this.filterData(data);

        const playerStats = this.aggregatePlayerStats(filteredData);

        if (playerStats.length === 0) {
            container.append('div')
                .style('text-align', 'center')
                .style('color', '#A0A0A8')
                .style('padding', '20px')
                .text('No data available');
            return;
        }

        const margin = {top: 20, right: 20, bottom: 40, left: 50};
        const width = 300 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', 300)
            .attr('height', 300);

        const defs = svg.append('defs');

        const underperformingGradient = defs.append('linearGradient')
            .attr('id', 'underperforming-gradient')
            .attr('x1', '50%')
            .attr('y1', '50%')
            .attr('x2', '100%')
            .attr('y2', '100%');

        underperformingGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#1A1A1D')
            .attr('stop-opacity', 0);

        underperformingGradient.append('stop')
            .attr('offset', '50%')
            .attr('stop-color', '#7C3AED')
            .attr('stop-opacity', 0.1);

        underperformingGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#7C3AED')
            .attr('stop-opacity', 0.25);

        const overperformingGradient = defs.append('linearGradient')
            .attr('id', 'overperforming-gradient')
            .attr('x1', '50%')
            .attr('y1', '50%')
            .attr('x2', '0%')
            .attr('y2', '0%');

        overperformingGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#1A1A1D')
            .attr('stop-opacity', 0);

        overperformingGradient.append('stop')
            .attr('offset', '50%')
            .attr('stop-color', '#10B981')
            .attr('stop-opacity', 0.1);

        overperformingGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#10B981')
            .attr('stop-opacity', 0.25);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const maxXG = d3.max(playerStats, d => d.totalXG) || 1;
        const maxGoals = d3.max(playerStats, d => d.totalGoals) || 1;
        const maxValue = Math.max(maxXG, maxGoals) + 1;

        const xScale = d3.scalePow()
            .exponent(0.7)
            .domain([0, maxValue])
            .range([0, width]);

        const yScale = d3.scalePow()
            .exponent(0.7)
            .domain([0, maxValue])
            .range([height, 0]);

        g.append('polygon')
            .attr('points', `0,${height} ${width},0 ${width},${height}`)
            .attr('fill', 'url(#underperforming-gradient)')
            .style('pointer-events', 'none');

        g.append('polygon')
            .attr('points', `0,0 0,${height} ${width},0`)
            .attr('fill', 'url(#overperforming-gradient)')
            .style('pointer-events', 'none');

        g.append('line')
            .attr('x1', xScale(0))
            .attr('y1', yScale(0))
            .attr('x2', xScale(maxValue))
            .attr('y2', yScale(maxValue))
            .attr('stroke', 'rgba(255, 255, 255, 0.2)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4,4');

        const xAxis = d3.axisBottom(xScale)
            .ticks(5);

        const yAxis = d3.axisLeft(yScale)
            .ticks(5);

        const xAxisGroup = g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        const yAxisGroup = g.append('g')
            .attr('class', 'axis')
            .call(yAxis);

        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 35)
            .attr('text-anchor', 'middle')
            .style('fill', '#A0A0A8')
            .style('font-size', '11px')
            .text('Total xG');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -35)
            .attr('text-anchor', 'middle')
            .style('fill', '#A0A0A8')
            .style('font-size', '11px')
            .text('Total Goals');

        g.append('text')
            .attr('x', 10)
            .attr('y', 15)
            .attr('text-anchor', 'start')
            .style('fill', '#fff')
            .style('font-size', '10px')
            .style('opacity', 0.5)
            .text('better');

        g.append('text')
            .attr('x', width - 10)
            .attr('y', height - 5)
            .attr('text-anchor', 'end')
            .style('fill', '#fff')
            .style('font-size', '10px')
            .style('opacity', 0.5)
            .text('worse');

        const tooltip = d3.select('body').append('div')
            .attr('class', 'xgscatter-tooltip')
            .style('position', 'absolute')
            .style('opacity', 0)
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', '#E5E5E7')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', 10000)
            .style('border', '1px solid #3D3D42');

        const hexagonPoints = (cx, cy, size) => {
            const points = [];
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                const x = cx + size * Math.cos(angle);
                const y = cy + size * Math.sin(angle);
                points.push(`${x},${y}`);
            }
            return points.join(' ');
        };

        g.selectAll('.dot')
            .data(playerStats)
            .enter()
            .append('polygon')
            .attr('class', 'dot')
            .attr('points', d => {
                const size = (this.selectedShooter && d.shooter === this.selectedShooter) ? 7 : 5;
                return hexagonPoints(xScale(d.totalXG), yScale(d.totalGoals), size);
            })
            .attr('fill', d => {
                if (this.selectedShooter && d.shooter === this.selectedShooter) {
                    return '#FFD700';
                }
                return '#08C9B5';
            })
            .attr('stroke', d => {
                if (this.selectedShooter && d.shooter === this.selectedShooter) {
                    return '#fff';
                }
                return 'none';
            })
            .attr('stroke-width', d => {
                if (this.selectedShooter && d.shooter === this.selectedShooter) {
                    return 2;
                }
                return 0.5;
            })
            .style('opacity', d => {
                if (this.selectedShooter) {
                    if (d.shooter === this.selectedShooter) {
                        return 1;
                    }
                    return 0.15;
                }
                if (d.totalGoals === 0) {
                    return 0.3;
                }
                return 0.7;
            })
            .on('mouseover', (event, d) => {
                const cx = xScale(d.totalXG);
                const cy = yScale(d.totalGoals);

                d3.select(event.currentTarget)
                    .attr('points', hexagonPoints(cx, cy, 7))
                    .style('opacity', 1);

                tooltip.transition()
                    .duration(200)
                    .style('opacity', 1);

                const avgXG = d.attempts > 0 ? (d.totalXG / d.attempts).toFixed(3) : '0.000';

                tooltip.html(`
                    <strong>${d.shooter}</strong><br/>
                    xG: ${d.totalXG.toFixed(2)} | Goals: ${d.totalGoals}<br/>
                    Attempts: ${d.attempts}<br/>
                    Avg xG: ${avgXG}
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', (event, d) => {
                const isSelected = this.selectedShooter && d.shooter === this.selectedShooter;
                const cx = xScale(d.totalXG);
                const cy = yScale(d.totalGoals);

                d3.select(event.currentTarget)
                    .attr('points', hexagonPoints(cx, cy, 5))
                    .style('opacity', isSelected ? 1 : (d.totalGoals === 0 ? 0.3 : 0.7));

                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            })
            .on('mouseleave', (event, d) => {
                tooltip.style('opacity', 0);
            });
    }

    filterData(data) {
        if (this.typeFilters.length === 0 && this.turnoverState === 'off') {
            return data;
        }

        return data.filter(shot => {
            if (!shot.type) return false;

            const isTurnoverShot = shot.type.includes('Turnover');
            const isReboundShot = shot.type === 'Rebound';
            const isDirectShot = shot.type === 'Direct' || shot.type === 'Turnover | Direct';
            const isOneTimerShot = shot.type === 'One-timer' || shot.type === 'Turnover | One-timer';

            const isDirectActive = this.typeFilters.includes('Direct');
            const isOneTimerActive = this.typeFilters.includes('One-timer');
            const isReboundActive = this.typeFilters.includes('Rebound');

            let matchesTypeFilter = false;
            if (isReboundActive && isReboundShot) {
                matchesTypeFilter = true;
            }
            if (isDirectActive && isDirectShot) {
                matchesTypeFilter = true;
            }
            if (isOneTimerActive && isOneTimerShot) {
                matchesTypeFilter = true;
            }

            if (this.turnoverState === 'only') {
                if (this.typeFilters.length === 0) {
                    return isTurnoverShot;
                } else {
                    return isTurnoverShot || matchesTypeFilter;
                }
            } else if (this.turnoverState === 'exclude') {
                if (isTurnoverShot) {
                    return false;
                }

                if (this.typeFilters.length === 0) {
                    return !isReboundShot;
                }

                if (isReboundActive && !isDirectActive && !isOneTimerActive) {
                    return true;
                }

                return matchesTypeFilter;
            } else {
                if (this.typeFilters.length === 0) {
                    return true;
                } else {
                    return matchesTypeFilter;
                }
            }
        });
    }

    aggregatePlayerStats(data) {
        const playerMap = new Map();

        data.forEach(shot => {
            const shooter = shot.shooter;
            if (!shooter || shooter.trim() === '') return;

            if (!playerMap.has(shooter)) {
                playerMap.set(shooter, {
                    shooter: shooter,
                    totalXG: 0,
                    totalGoals: 0,
                    attempts: 0
                });
            }

            const stats = playerMap.get(shooter);
            const xg = parseFloat(shot.xg) || 0;
            stats.totalXG += xg;
            stats.attempts += 1;

            if (shot.result === 'Goal') {
                stats.totalGoals += 1;
            }
        });

        return Array.from(playerMap.values());
    }

    destroy() {
        d3.selectAll('.xgscatter-tooltip').remove();
    }
}

window.XGScatterPlot = XGScatterPlot;
