class ShotMap {
    constructor(app) {
        this.app = app;
        this.shotMapSvg = null;
        this.shotMapG = null;
        this.dotsLayer = null;
        this.heatmapLayer = null;
        this.showDots = false;
        this.showHeatmap = true;
    }

    async createShotMap(data, onFieldData = null) {
        console.log('Creating shot map...');
        await debugLog('Creating shot map', { dataLength: data.length, hasOnFieldData: !!onFieldData });

        if (!window.hexbinTracking) {
            window.hexbinTracking = {
                allShooters: null,
                selectedShooter: null,
                comparisons: []
            };
        }

        if (!window.hexbinDebugData) {
            window.hexbinDebugData = {};
        }

        const container = d3.select('#shot-map-chart');
        container.selectAll('*').remove();

        const filteredData = data.filter(shot => {
            const result = shot.result || '';
            return !result.toLowerCase().includes('possession');
        });

        const filteredOnFieldData = onFieldData ? onFieldData.filter(shot => {
            const result = shot.result || '';
            return !result.toLowerCase().includes('possession');
        }) : null;

        console.log(`Filtered shots: ${filteredData.length} (excluded ${data.length - filteredData.length} possession shots)`);
        if (filteredOnFieldData) {
            console.log(`Filtered on-field shots: ${filteredOnFieldData.length}`);
        }
        await debugLog('Shot map filter', {
            total: data.length,
            filtered: filteredData.length,
            excluded: data.length - filteredData.length,
            onFieldTotal: onFieldData ? onFieldData.length : 0
        });

        const dashboardMain = document.querySelector('.dashboard-main');
        const dashboardRect = dashboardMain.getBoundingClientRect();

        const verticalPadding = 20;
        const horizontalPadding = 0;
        const availableHeight = dashboardRect.height - (verticalPadding * 2);

        const aspectRatio = 2;

        const fieldHeight = availableHeight;
        const fieldWidth = fieldHeight / aspectRatio;

        const totalSVGWidth = fieldWidth + (horizontalPadding * 2);
        const totalSVGHeight = fieldHeight + (verticalPadding * 2);

        console.log('SVG Dimensions:', {
            dashboardWidth: dashboardRect.width,
            dashboardHeight: dashboardRect.height,
            fieldWidth,
            fieldHeight,
            totalSVGWidth,
            totalSVGHeight
        });

        const margin = {top: verticalPadding, right: horizontalPadding, bottom: verticalPadding, left: horizontalPadding};

        const svg = container
            .append('svg')
            .attr('width', totalSVGWidth)
            .attr('height', totalSVGHeight)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('pointer-events', 'auto')
            .style('max-width', 'none');

        const fieldContainer = document.querySelector('.field-container');
        const chartSection = document.querySelector('.chart-section');
        const analyticsContainer = document.querySelector('.analytics-container');
        const middleStats = document.querySelector('.middle-stats');
        const goalkeeperSection = document.querySelector('.goalkeeper-stats-section');

        if (fieldContainer) {
            fieldContainer.style.width = `${totalSVGWidth}px`;
            fieldContainer.style.maxWidth = `${totalSVGWidth}px`;
            console.log(`Set .field-container width to ${totalSVGWidth}px`);
        }

        if (chartSection) {
            chartSection.style.width = `${totalSVGWidth}px`;
            chartSection.style.maxWidth = `${totalSVGWidth}px`;
        }

        if (fieldContainer && analyticsContainer && middleStats && goalkeeperSection) {
            const analyticsWidth = 300;
            const middleStatsWidth = 300;
            const goalkeeperWidth = 300;

            const totalContainerWidth = totalSVGWidth + analyticsWidth + middleStatsWidth + goalkeeperWidth;
            const availableSpace = dashboardRect.width - totalContainerWidth;
            const gap = availableSpace / 5;

            const fieldLeft = gap;
            const analyticsLeft = fieldLeft + totalSVGWidth + gap;
            const middleStatsLeft = analyticsLeft + analyticsWidth + gap;
            const goalkeeperLeft = middleStatsLeft + middleStatsWidth + gap;

            fieldContainer.style.left = `${fieldLeft}px`;

            analyticsContainer.style.left = `${analyticsLeft}px`;
            analyticsContainer.style.right = 'auto';

            middleStats.style.left = `${middleStatsLeft}px`;
            middleStats.style.right = 'auto';

            goalkeeperSection.style.left = `${goalkeeperLeft}px`;
            goalkeeperSection.style.right = 'auto';

            console.log('Container positions with equal gaps:', {
                gap: gap,
                fieldLeft: fieldLeft,
                analyticsLeft: analyticsLeft,
                middleStatsLeft: middleStatsLeft,
                goalkeeperLeft: goalkeeperLeft
            });
        }

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        this.shotMapSvg = svg;
        this.shotMapG = g;

        svg.append('defs')
            .append('clipPath')
            .attr('id', 'field-clip')
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', fieldWidth)
            .attr('height', fieldHeight);

        g.append('image')
            .attr('href', 'public/images/field.png')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', fieldWidth)
            .attr('height', fieldHeight)
            .style('opacity', 0.9);

        const scaleX = fieldWidth / 600;
        const scaleY = fieldHeight / 1200;

        const shotsWithCoords = filteredData.filter(shot => {
            const x = parseFloat(shot.x_graph);
            const y = parseFloat(shot.y_graph);
            return !isNaN(x) && !isNaN(y) && x >= 0 && y >= 0;
        }).map(shot => {
            const team1 = shot.team1;
            const shootingTeam = shot.shooting_team;
            const isTeam1 = shootingTeam === team1;

            let visualX, visualY;

            if (isTeam1) {
                visualX = parseFloat(shot.x_graph) * scaleX;
                visualY = parseFloat(shot.y_graph) * scaleY;
            } else {
                visualX = (600 - parseFloat(shot.x_graph)) * scaleX;
                visualY = (1200 - parseFloat(shot.y_graph)) * scaleY;
            }

            return {
                ...shot,
                visualX: visualX,
                visualY: visualY,
                isTeam1: isTeam1
            };
        });

        console.log(`Shots with valid coordinates: ${shotsWithCoords.length}`);
        await debugLog('Shots with coordinates', {
            count: shotsWithCoords.length,
            sampleShot: shotsWithCoords[0] ? {
                team1: shotsWithCoords[0].team1,
                shooting_team: shotsWithCoords[0].shooting_team,
                x_graph: shotsWithCoords[0].x_graph,
                y_graph: shotsWithCoords[0].y_graph,
                visualX: shotsWithCoords[0].visualX,
                visualY: shotsWithCoords[0].visualY,
                isTeam1: shotsWithCoords[0].isTeam1
            } : null
        });

        if (shotsWithCoords.length === 0) {
            g.append('text')
                .attr('x', fieldWidth / 2)
                .attr('y', fieldHeight / 2)
                .attr('text-anchor', 'middle')
                .style('fill', '#666')
                .style('font-size', '16px')
                .text('No shot location data available');
            return;
        }

        let onFieldShotsWithCoords = null;
        if (filteredOnFieldData) {
            onFieldShotsWithCoords = filteredOnFieldData.filter(shot => {
                const x = parseFloat(shot.x_graph);
                const y = parseFloat(shot.y_graph);
                return !isNaN(x) && !isNaN(y) && x >= 0 && y >= 0;
            }).map(shot => {
                const team1 = shot.team1;
                const shootingTeam = shot.shooting_team;
                const isTeam1 = shootingTeam === team1;

                let visualX, visualY;

                if (isTeam1) {
                    visualX = parseFloat(shot.x_graph) * scaleX;
                    visualY = parseFloat(shot.y_graph) * scaleY;
                } else {
                    visualX = (600 - parseFloat(shot.x_graph)) * scaleX;
                    visualY = (1200 - parseFloat(shot.y_graph)) * scaleY;
                }

                return {
                    ...shot,
                    visualX: visualX,
                    visualY: visualY,
                    isTeam1: isTeam1
                };
            });
            console.log(`On-field shots with coords: ${onFieldShotsWithCoords.length}`);
        }

        const heatmapGroup = g.append('g')
            .attr('class', 'heatmap-layer');

        if (onFieldShotsWithCoords) {
            const upperGroup = heatmapGroup.append('g')
                .attr('class', 'heatmap-upper')
                .attr('clip-path', 'url(#upper-clip-path)');

            const lowerGroup = heatmapGroup.append('g')
                .attr('class', 'heatmap-lower')
                .attr('clip-path', 'url(#lower-clip-path)');

            svg.select('defs').append('clipPath')
                .attr('id', 'upper-clip-path')
                .append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', fieldWidth)
                .attr('height', fieldHeight / 2);

            svg.select('defs').append('clipPath')
                .attr('id', 'lower-clip-path')
                .append('rect')
                .attr('x', 0)
                .attr('y', fieldHeight / 2)
                .attr('width', fieldWidth)
                .attr('height', fieldHeight / 2);

            console.log(`Creating split hexbins:`);
            console.log(`- Upper (shooter's shots): ${shotsWithCoords.length}`);
            console.log(`- Lower (on-field shots): ${onFieldShotsWithCoords.length}`);

            if (shotsWithCoords.length > 0) {
                console.log('Drawing shooter hexbins in upper half...');
                this.createHexbinHeatmap(upperGroup, shotsWithCoords, fieldWidth, fieldHeight);
            }
            if (onFieldShotsWithCoords.length > 0) {
                console.log('Drawing on-field hexbins in lower half...');
                this.createHexbinHeatmap(lowerGroup, onFieldShotsWithCoords, fieldWidth, fieldHeight);
            }
        } else {
            heatmapGroup.attr('clip-path', 'url(#field-clip)');
            if (shotsWithCoords.length > 0) {
                this.createHexbinHeatmap(heatmapGroup, shotsWithCoords, fieldWidth, fieldHeight);
            }
        }

        const dotsGroup = g.append('g')
            .attr('class', 'dots-layer')
            .style('display', this.showDots ? 'block' : 'none');
        this.dotsLayer = dotsGroup;
        this.heatmapLayer = heatmapGroup;
        heatmapGroup.style('display', this.showHeatmap ? 'block' : 'none');

        const colorScale = d3.scaleOrdinal()
            .domain(['Goal', 'Saved', 'Missed', 'Blocked'])
            .range(['#10B981', '#00D9FF', '#F59E0B', '#EF4444']);

        let tooltip = d3.select('body').select('.tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select('body').append('div').attr('class', 'tooltip');
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
            .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.5)')
            .style('line-height', '1.4');

        const radiusScale = d3.scaleSqrt()
            .domain([0, 1])
            .range([3, 10]);

        dotsGroup.selectAll('.shot-dot')
            .data(shotsWithCoords)
            .enter().append('circle')
            .attr('class', 'shot-dot')
            .attr('cx', d => d.visualX)
            .attr('cy', d => d.visualY)
            .attr('r', d => {
                const xg = parseFloat(d.xg) || 0;
                return radiusScale(Math.min(1, Math.max(0, xg)));
            })
            .style('fill', d => colorScale(d.result))
            .style('stroke', '#fff')
            .style('stroke-width', 1.5)
            .style('opacity', 0.8)
            .on('mouseover', function(event, d) {
                const xg = parseFloat(d.xg) || 0;
                const baseRadius = radiusScale(Math.min(1, Math.max(0, xg)));

                d3.select(this)
                    .style('opacity', 1)
                    .attr('r', baseRadius + 2);

                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);

                tooltip.html(`
                    <strong>${d.result}</strong><br/>
                    Shooter: ${d.shooter || 'Unknown'}<br/>
                    Distance: ${parseFloat(d.distance).toFixed(1)}m<br/>
                    Angle: ${parseFloat(d.angle).toFixed(1)}°<br/>
                    xG: ${parseFloat(d.xg).toFixed(2)}
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(event, d) {
                const xg = parseFloat(d.xg) || 0;
                const baseRadius = radiusScale(Math.min(1, Math.max(0, xg)));

                d3.select(this)
                    .style('opacity', 0.8)
                    .attr('r', baseRadius);

                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        this.addSimpleShotMapLegend(svg, fieldWidth, fieldHeight, margin, colorScale);
        this.addHeatmapLegend(svg, fieldWidth, fieldHeight, margin);

        this.dotsLayer.style('display', this.showDots ? 'block' : 'none');
        this.heatmapLayer.style('display', this.showHeatmap ? 'block' : 'none');
        svg.select('.shot-map-legend').style('display', this.showDots ? 'block' : 'none');
        svg.select('.heatmap-legend').style('display', this.showHeatmap ? 'block' : 'none');

        this.app.shotHistogram.createXGHistograms(filteredData, fieldWidth, fieldHeight, margin);

        console.log('Shot map created with dots and heatmap');
        await debugLog('Shot map complete', { dotsDrawn: shotsWithCoords.length });
    }

    async createScatterShotMap(g, shotData, width, height) {
        console.log('Creating scatter plot shot map');
        await debugLog('Creating scatter plot shot map', { shotCount: shotData.length });

        const colorScale = d3.scaleOrdinal()
            .domain(['Goal', 'Saved', 'Missed', 'Blocked'])
            .range(['#28a745', '#007bff', '#ffc107', '#dc3545']);

        g.selectAll('.shot-dot')
            .data(shotData)
            .enter().append('circle')
            .attr('class', 'shot-dot')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 4)
            .style('fill', d => colorScale(d.result))
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .style('opacity', 0.7)
            .on('mouseover', function(event, d) {
                d3.select(this).style('opacity', 1).attr('r', 6);
            })
            .on('mouseout', function(event, d) {
                d3.select(this).style('opacity', 0.7).attr('r', 4);
            });

        const legend = g.append('g')
            .attr('class', 'scatter-legend')
            .attr('transform', `translate(${width - 120}, 20)`);

        const legendData = ['Goal', 'Saved', 'Missed', 'Blocked'];

        legend.selectAll('.legend-item')
            .data(legendData)
            .enter().append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`)
            .each(function(d) {
                const item = d3.select(this);
                item.append('circle')
                    .attr('r', 4)
                    .style('fill', colorScale(d));
                item.append('text')
                    .attr('x', 10)
                    .attr('y', 4)
                    .text(d)
                    .style('font-size', '12px');
            });
    }

    addFieldBackground(g, width, height) {
        g.append('image')
            .attr('href', 'public/images/field.png')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .style('opacity', 0.8);
    }

    drawFloorballCourtOverlay(g, width, height, scale) {
    }

    drawFloorballCourt(g, width, height, scale) {
        g.append('rect')
            .attr('class', 'court-boundary')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .style('fill', '#e8f5e8');

        g.append('line')
            .attr('class', 'court-boundary')
            .attr('x1', width / 2)
            .attr('y1', 0)
            .attr('x2', width / 2)
            .attr('y2', height);

        g.append('circle')
            .attr('class', 'center-circle')
            .attr('cx', width / 2)
            .attr('cy', height / 2)
            .attr('r', 1 * scale);

        const goalAreaWidth = 4 * scale;
        const goalAreaHeight = 5 * scale;
        const goalAreaY = (height - goalAreaHeight) / 2;

        g.append('rect')
            .attr('class', 'goal-area')
            .attr('x', 0)
            .attr('y', goalAreaY)
            .attr('width', goalAreaWidth)
            .attr('height', goalAreaHeight)
            .style('fill', 'none');

        g.append('rect')
            .attr('class', 'goal-area')
            .attr('x', width - goalAreaWidth)
            .attr('y', goalAreaY)
            .attr('width', goalAreaWidth)
            .attr('height', goalAreaHeight)
            .style('fill', 'none');

        const goalWidth = 1.6 * scale;
        const goalY = (height - goalWidth) / 2;
        const goalFromBaseline = 3.5 * scale;

        g.append('rect')
            .attr('class', 'court-boundary')
            .attr('x', goalFromBaseline - 2)
            .attr('y', goalY)
            .attr('width', 4)
            .attr('height', goalWidth)
            .style('fill', '#333');

        g.append('rect')
            .attr('class', 'court-boundary')
            .attr('x', width - goalFromBaseline - 2)
            .attr('y', goalY)
            .attr('width', 4)
            .attr('height', goalWidth)
            .style('fill', '#333');

        g.append('line')
            .attr('class', 'court-boundary')
            .attr('x1', goalFromBaseline)
            .attr('y1', goalY)
            .attr('x2', goalFromBaseline)
            .attr('y2', goalY + goalWidth)
            .style('stroke-width', '3px');

        g.append('line')
            .attr('class', 'court-boundary')
            .attr('x1', width - goalFromBaseline)
            .attr('y1', goalY)
            .attr('x2', width - goalFromBaseline)
            .attr('y2', goalY + goalWidth)
            .style('stroke-width', '3px');
    }

    prepareShotMapData(data, width, height, scale) {
        const team1 = data[0]?.team1;
        const team2 = data[0]?.team2;

        return data.map(shot => {
            const distance = parseFloat(shot.distance) || 0;
            const angle = parseFloat(shot.angle) || 0;

            const angleRad = (angle * Math.PI) / 180;

            const goalFromBaseline = 3.5 * scale;
            let goalX, goalY;

            if (shot.shooting_team === team1) {
                goalX = width / 2;
                goalY = goalFromBaseline;
            } else {
                goalX = width / 2;
                goalY = height - goalFromBaseline;
                const angleRad = ((angle + 180) * Math.PI) / 180;
            }

            const x = goalX + (distance * scale * Math.sin(angleRad));
            const y = goalY - (distance * scale * Math.cos(angleRad));

            const clampedX = Math.max(0, Math.min(width, x));
            const clampedY = Math.max(0, Math.min(height, y));

            return {
                x: clampedX,
                y: clampedY,
                result: shot.result,
                type: shot.type,
                xg: parseFloat(shot.xg) || 0,
                distance: distance,
                angle: angle,
                shooter: shot.shooter,
                team: shot.shooting_team,
                goalX: goalX,
                goalY: goalY,
                attackingGoal: shot.shooting_team === team1 ? 'top' : 'bottom'
            };
        }).filter(shot => shot.distance > 0);
    }

    addSimpleShotMapLegend(svg, width, height, margin, colorScale) {
        const legend = svg.append('g')
            .attr('class', 'shot-map-legend')
            .attr('transform', `translate(${margin.left + width + 20}, ${margin.top + 250})`);

        const legendData = [
            { result: 'Goal', label: 'Goal' },
            { result: 'Saved', label: 'Saved' },
            { result: 'Missed', label: 'Missed' },
            { result: 'Blocked', label: 'Blocked' }
        ];

        const legendItems = legend.selectAll('.legend-item')
            .data(legendData)
            .enter().append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 25})`);

        legendItems.append('circle')
            .attr('r', 5)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('fill', d => colorScale(d.result))
            .style('stroke', '#fff')
            .style('stroke-width', 1.5);

        legendItems.append('text')
            .attr('x', 12)
            .attr('y', 4)
            .text(d => d.label)
            .style('font-size', '12px')
            .style('fill', '#E5E5E7');
    }

    createSplitViewHexbins(group, shotsWithCoords, fieldWidth, fieldHeight, position) {
        console.log(`createSplitViewHexbins: ${position} with ${shotsWithCoords.length} shots`);

        if (!d3.hexbin) {
            console.warn('d3-hexbin not available');
            return;
        }

        const halfHeight = fieldHeight / 2;

        const remappedShots = shotsWithCoords.map(shot => {
            let newY;
            if (position === 'upper') {
                newY = (shot.visualY / fieldHeight) * halfHeight;
            } else {
                newY = ((shot.visualY / fieldHeight) * halfHeight) + halfHeight;
            }

            return {
                ...shot,
                remappedY: newY,
                originalY: shot.visualY
            };
        });

        if (remappedShots.length > 0) {
            console.log(`${position} shots coordinate sample:`, {
                first: {
                    x: remappedShots[0].visualX.toFixed(1),
                    originalY: remappedShots[0].originalY.toFixed(1),
                    remappedY: remappedShots[0].remappedY.toFixed(1),
                    shooter: remappedShots[0].shooter
                },
                fieldHeight: fieldHeight,
                halfHeight: halfHeight
            });
        }

        const scaleFactor = fieldWidth / 600;
        const baseRadius = 20;
        const hexbin = d3.hexbin()
            .x(d => d.visualX)
            .y(d => d.remappedY)
            .radius(baseRadius * scaleFactor)
            .extent([[0, position === 'upper' ? 0 : halfHeight],
                     [fieldWidth, position === 'upper' ? halfHeight : fieldHeight]]);

        const hexData = hexbin(remappedShots).map(bin => {
            const goals = bin.filter(d => d.result === 'Goal').length;
            const total = bin.length;
            const successRate = total > 0 ? goals / total : 0;

            const xgValues = bin.map(d => parseFloat(d.xg)).filter(xg => !isNaN(xg));
            const avgXG = xgValues.length > 0 ? d3.mean(xgValues) : 0;
            const minXG = xgValues.length > 0 ? d3.min(xgValues) : 0;
            const maxXG = xgValues.length > 0 ? d3.max(xgValues) : 0;

            return {
                ...bin,
                goals: goals,
                total: total,
                successRate: successRate,
                avgXG: avgXG,
                minXG: minXG,
                maxXG: maxXG
            };
        });

        const filteredHexData = hexData.filter(d => d.total >= 1);

        const leagueAverage = remappedShots.filter(d => d.result === 'Goal').length / remappedShots.length;

        const colorScale = d3.scaleLinear()
            .domain([0, 0.3, 0.6])
            .range(['#7C3AED', '#00D9FF', '#10B981'])
            .clamp(true);

        const sizeScale = d3.scalePow()
            .exponent(0.8)
            .domain([0, d3.max(filteredHexData, d => d.total) || 1])
            .range([0.4, 1.0]);

        let tooltip = d3.select('body').select('.heatmap-tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select('body').append('div').attr('class', 'heatmap-tooltip tooltip');
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
            .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.5)')
            .style('line-height', '1.4');

        const hexbinDebugKey = `${position}_${this.app.selectedShooter || 'all'}`;
        window.hexbinDebugData[hexbinDebugKey] = {
            position: position,
            shooter: this.app.selectedShooter || 'all',
            radius: baseRadius * scaleFactor,
            hexbins: filteredHexData.map(d => ({
                x: d.x,
                y: d.y,
                total: d.total,
                goals: d.goals,
                scale: sizeScale(d.total)
            }))
        };

        console.log(`Stored hexbin debug data for ${hexbinDebugKey}:`, {
            numHexbins: filteredHexData.length,
            radius: baseRadius * scaleFactor,
            firstHexbin: filteredHexData[0] ? {
                x: filteredHexData[0].x.toFixed(1),
                y: filteredHexData[0].y.toFixed(1),
                total: filteredHexData[0].total
            } : null
        });

        const hexagons = group.selectAll('.hexagon')
            .data(filteredHexData)
            .enter().append('g')
            .attr('class', 'hexagon-group')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        hexagons.append('path')
            .attr('class', 'hexagon')
            .attr('d', hexbin.hexagon())
            .attr('transform', d => `scale(${sizeScale(d.total)})`)
            .attr('data-min-xg', d => d.minXG)
            .attr('data-max-xg', d => d.maxXG)
            .attr('data-avg-xg', d => d.avgXG)
            .style('fill', d => colorScale(d.successRate))
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .style('opacity', 0.93)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .style('opacity', 1)
                    .style('stroke-width', 2);

                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);

                const percentage = (d.successRate * 100).toFixed(1);
                tooltip.html(`
                    <strong>${position === 'upper' ? 'Shooter' : 'On-field'} Zone</strong><br/>
                    Shots: ${d.total}<br/>
                    Goals: ${d.goals}<br/>
                    Success Rate: ${percentage}%
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .style('opacity', 0.93)
                    .style('stroke-width', 1);

                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        console.log(`Created ${hexagons.size()} hexagons for ${position} half`);

        if (filteredHexData.length > 0) {
            const sample = filteredHexData[0];
            console.log(`${position} HEXBIN DEBUG: First hexbin at (${sample.x.toFixed(1)}, ${sample.y.toFixed(1)}), fieldHeight=${fieldHeight.toFixed(1)}, halfHeight=${halfHeight.toFixed(1)}`);

            const yValues = filteredHexData.map(h => h.y);
            console.log(`${position} Y-RANGE: ${Math.min(...yValues).toFixed(1)} to ${Math.max(...yValues).toFixed(1)}`);
        }

        if (this.app.selectedShooter && window.hexbinDebugData['all_shooters_none']) {
            this.compareHexbinData();
        }
    }

    async compareHexbinData() {
        const allShootersData = window.hexbinDebugData['all_shooters_none'];
        const selectedUpperData = window.hexbinDebugData[`upper_${this.app.selectedShooter}`];
        const selectedLowerData = window.hexbinDebugData[`lower_${this.app.selectedShooter}`];

        if (!allShootersData || !selectedUpperData) {
            await debugLog('Hexbin comparison - missing data', {
                hasAllShooters: !!allShootersData,
                hasSelectedUpper: !!selectedUpperData
            });
            return;
        }

        const logData = {
            timestamp: new Date().toISOString(),
            selectedShooter: this.app.selectedShooter,
            allShootersMode: {
                numHexbins: allShootersData.hexbins.length,
                radius: allShootersData.radius,
                fieldWidth: allShootersData.fieldWidth,
                fieldHeight: allShootersData.fieldHeight,
                hexbins: allShootersData.hexbins.slice(0, 10).map(h => ({
                    x: h.x,
                    y: h.y,
                    total: h.total,
                    goals: h.goals,
                    scale: h.scale
                }))
            },
            selectedUpperMode: {
                numHexbins: selectedUpperData.hexbins.length,
                radius: selectedUpperData.radius,
                position: selectedUpperData.position,
                hexbins: selectedUpperData.hexbins.slice(0, 10).map(h => ({
                    x: h.x,
                    y: h.y,
                    total: h.total,
                    goals: h.goals,
                    scale: h.scale
                }))
            }
        };

        if (selectedLowerData) {
            logData.selectedLowerMode = {
                numHexbins: selectedLowerData.hexbins.length,
                radius: selectedLowerData.radius,
                position: selectedLowerData.position,
                hexbins: selectedLowerData.hexbins.slice(0, 10).map(h => ({
                    x: h.x,
                    y: h.y,
                    total: h.total,
                    goals: h.goals,
                    scale: h.scale
                }))
            };
        }

        const allYValues = allShootersData.hexbins.map(h => h.y);
        const upperYValues = selectedUpperData.hexbins.map(h => h.y);

        logData.yAxisAnalysis = {
            allShooters: {
                min: Math.min(...allYValues),
                max: Math.max(...allYValues),
                range: Math.max(...allYValues) - Math.min(...allYValues)
            },
            upperHalf: {
                min: Math.min(...upperYValues),
                max: Math.max(...upperYValues),
                range: Math.max(...upperYValues) - Math.min(...upperYValues),
                expectedMax: allShootersData.fieldHeight / 2
            }
        };

        if (selectedLowerData && selectedLowerData.hexbins.length > 0) {
            const lowerYValues = selectedLowerData.hexbins.map(h => h.y);
            logData.yAxisAnalysis.lowerHalf = {
                min: Math.min(...lowerYValues),
                max: Math.max(...lowerYValues),
                range: Math.max(...lowerYValues) - Math.min(...lowerYValues),
                expectedMin: allShootersData.fieldHeight / 2,
                expectedMax: allShootersData.fieldHeight
            };
        }

        try {
            const response = await fetch('/api/debug-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'HEXBIN_COMPARISON',
                    data: logData
                })
            });

            if (response.ok) {
                console.log('Hexbin comparison data written to log file');
                await this.writeHexbinAnalysisFile(logData);
            }
        } catch (error) {
            console.error('Failed to write hexbin log:', error);
        }
    }

    compareHexbinPositions() {
        if (!window.hexbinTracking.allShooters || !window.hexbinTracking.selectedShooter) {
            console.log('Missing tracking data for comparison');
            return;
        }

        const allShooters = window.hexbinTracking.allShooters;
        const selected = window.hexbinTracking.selectedShooter;

        console.log('=' .repeat(80));
        console.log('HEXBIN POSITION TRACKING BY SHOT ID');
        console.log('=' .repeat(80));

        debugLog('HEXBIN_POSITION_TRACKING', {
            mode: 'comparison_start',
            allShootersCount: allShooters.hexbins.length,
            selectedCount: selected.hexbins.length
        });

        const allShootersMap = new Map();
        allShooters.hexbins.forEach(hexbin => {
            if (hexbin.shotIds) {
                hexbin.shotIds.forEach(shot => {
                    allShootersMap.set(shot.id, {
                        hexbinX: hexbin.x,
                        hexbinY: hexbin.y,
                        hexbinScale: hexbin.scale,
                        shotX: shot.visualX,
                        shotY: shot.visualY
                    });
                });
            }
        });

        const selectedMap = new Map();
        selected.hexbins.forEach(hexbin => {
            if (hexbin.shotIds) {
                hexbin.shotIds.forEach(shot => {
                    selectedMap.set(shot.id, {
                        hexbinX: hexbin.x,
                        hexbinY: hexbin.y,
                        hexbinScale: hexbin.scale,
                        shotX: shot.visualX,
                        shotY: shot.visualY
                    });
                });
            }
        });

        const commonShotIds = [];
        allShootersMap.forEach((value, key) => {
            if (selectedMap.has(key)) {
                commonShotIds.push(key);
            }
        });

        console.log(`Found ${commonShotIds.length} common shots between modes`);

        const discrepancies = [];
        const comparisonDetails = [];

        commonShotIds.slice(0, 10).forEach(shotId => {
            const allPos = allShootersMap.get(shotId);
            const selPos = selectedMap.get(shotId);

            const deltaX = Math.abs(allPos.hexbinX - selPos.hexbinX);
            const deltaY = Math.abs(allPos.hexbinY - selPos.hexbinY);
            const scaleRatio = allPos.hexbinScale / selPos.hexbinScale;

            const comparison = {
                shotId: shotId.substring(0, 50),
                allShooters: {
                    hexbinX: allPos.hexbinX,
                    hexbinY: allPos.hexbinY,
                    scale: allPos.hexbinScale
                },
                selected: {
                    hexbinX: selPos.hexbinX,
                    hexbinY: selPos.hexbinY,
                    scale: selPos.hexbinScale
                },
                deltaX: deltaX,
                deltaY: deltaY,
                scaleRatio: scaleRatio
            };

            comparisonDetails.push(comparison);

            if (deltaX > 0.1 || deltaY > 0.1) {
                discrepancies.push({
                    shotId: shotId,
                    allShooters: allPos,
                    selected: selPos,
                    deltaX: deltaX,
                    deltaY: deltaY,
                    scaleRatio: scaleRatio
                });
            }

            console.log(`Shot ${shotId.substring(0, 30)}...`);
            console.log(`  All Shooters: Hexbin (${allPos.hexbinX.toFixed(1)}, ${allPos.hexbinY.toFixed(1)}), Scale: ${allPos.hexbinScale.toFixed(2)}`);
            console.log(`  Selected:     Hexbin (${selPos.hexbinX.toFixed(1)}, ${selPos.hexbinY.toFixed(1)}), Scale: ${selPos.hexbinScale.toFixed(2)}`);
            console.log(`  Delta:        X: ${deltaX.toFixed(1)}, Y: ${deltaY.toFixed(1)}, Scale Ratio: ${scaleRatio.toFixed(2)}`);
        });

        debugLog('HEXBIN_COMPARISON_DETAILS', {
            totalCommonShots: commonShotIds.length,
            samplesCompared: comparisonDetails.length,
            comparisons: comparisonDetails,
            discrepancyCount: discrepancies.length
        });

        if (discrepancies.length > 0) {
            console.log('\nDISCREPANCIES FOUND:');
            console.log(`${discrepancies.length} shots have different hexbin positions`);

            const avgDeltaX = discrepancies.reduce((sum, d) => sum + d.deltaX, 0) / discrepancies.length;
            const avgDeltaY = discrepancies.reduce((sum, d) => sum + d.deltaY, 0) / discrepancies.length;
            console.log(`Average position difference: X: ${avgDeltaX.toFixed(1)}, Y: ${avgDeltaY.toFixed(1)}`);
        }

        this.writeHexbinTrackingLog({
            allShooters: allShooters,
            selected: selected,
            commonShotIds: commonShotIds.slice(0, 20),
            discrepancies: discrepancies,
            analysis: {
                totalCommonShots: commonShotIds.length,
                totalDiscrepancies: discrepancies.length,
                averageDeltaX: discrepancies.length > 0 ?
                    discrepancies.reduce((sum, d) => sum + d.deltaX, 0) / discrepancies.length : 0,
                averageDeltaY: discrepancies.length > 0 ?
                    discrepancies.reduce((sum, d) => sum + d.deltaY, 0) / discrepancies.length : 0
            }
        });

        console.log('=' .repeat(80));
    }

    async writeHexbinTrackingLog(data) {
        const logContent = {
            timestamp: new Date().toISOString(),
            type: 'HEXBIN_SHOT_TRACKING',
            shooter: this.app.selectedShooter,
            allShootersMode: {
                numHexbins: data.allShooters.hexbins.length,
                radius: data.allShooters.radius,
                fieldDimensions: `${data.allShooters.fieldWidth} x ${data.allShooters.fieldHeight}`
            },
            selectedMode: {
                numHexbins: data.selected.hexbins.length,
                radius: data.selected.radius,
                fieldDimensions: `${data.selected.fieldWidth} x ${data.selected.fieldHeight}`
            },
            analysis: data.analysis,
            sampleDiscrepancies: data.discrepancies.slice(0, 5).map(d => ({
                shotId: d.shotId.substring(0, 50),
                allShootersPos: `(${d.allShooters.hexbinX.toFixed(1)}, ${d.allShooters.hexbinY.toFixed(1)})`,
                selectedPos: `(${d.selected.hexbinX.toFixed(1)}, ${d.selected.hexbinY.toFixed(1)})`,
                delta: `X: ${d.deltaX.toFixed(1)}, Y: ${d.deltaY.toFixed(1)}`,
                scaleRatio: d.scaleRatio.toFixed(2)
            }))
        };

        try {
            await fetch('/api/debug-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logContent)
            });
            console.log('Hexbin tracking log written to file');
        } catch (error) {
            console.error('Failed to write tracking log:', error);
        }
    }

    async writeHexbinAnalysisFile(logData) {
        const analysis = [];

        analysis.push('='.repeat(80));
        analysis.push('HEXBIN COMPARISON ANALYSIS');
        analysis.push(`Time: ${logData.timestamp}`);
        analysis.push(`Selected Shooter: ${logData.selectedShooter}`);
        analysis.push('='.repeat(80));
        analysis.push('');

        analysis.push('ALL SHOOTERS MODE:');
        analysis.push(`  Field: ${logData.allShootersMode.fieldWidth.toFixed(0)} x ${logData.allShootersMode.fieldHeight.toFixed(0)}`);
        analysis.push(`  Hexbin Radius: ${logData.allShootersMode.radius.toFixed(2)}`);
        analysis.push(`  Total Hexbins: ${logData.allShootersMode.numHexbins}`);
        analysis.push(`  Y-Axis Range: ${logData.yAxisAnalysis.allShooters.min.toFixed(1)} to ${logData.yAxisAnalysis.allShooters.max.toFixed(1)}`);
        analysis.push('');

        analysis.push('SELECTED SHOOTER - UPPER HALF:');
        analysis.push(`  Expected Y Range: 0 to ${logData.yAxisAnalysis.upperHalf.expectedMax.toFixed(1)}`);
        analysis.push(`  Actual Y Range: ${logData.yAxisAnalysis.upperHalf.min.toFixed(1)} to ${logData.yAxisAnalysis.upperHalf.max.toFixed(1)}`);
        analysis.push(`  Hexbin Radius: ${logData.selectedUpperMode.radius.toFixed(2)}`);
        analysis.push(`  Total Hexbins: ${logData.selectedUpperMode.numHexbins}`);
        analysis.push('');

        if (logData.selectedLowerMode) {
            analysis.push('SELECTED SHOOTER - LOWER HALF:');
            analysis.push(`  Expected Y Range: ${logData.yAxisAnalysis.lowerHalf.expectedMin.toFixed(1)} to ${logData.yAxisAnalysis.lowerHalf.expectedMax.toFixed(1)}`);
            analysis.push(`  Actual Y Range: ${logData.yAxisAnalysis.lowerHalf.min.toFixed(1)} to ${logData.yAxisAnalysis.lowerHalf.max.toFixed(1)}`);
            analysis.push(`  Hexbin Radius: ${logData.selectedLowerMode.radius.toFixed(2)}`);
            analysis.push(`  Total Hexbins: ${logData.selectedLowerMode.numHexbins}`);
            analysis.push('');
        }

        analysis.push('FIRST 5 HEXBINS COMPARISON:');
        analysis.push('-'.repeat(40));
        analysis.push('All Shooters Mode:');
        logData.allShootersMode.hexbins.slice(0, 5).forEach((h, i) => {
            analysis.push(`  ${i+1}. Pos: (${h.x.toFixed(1)}, ${h.y.toFixed(1)}), Total: ${h.total}, Scale: ${h.scale.toFixed(2)}`);
        });
        analysis.push('');

        analysis.push('Selected Upper Half:');
        logData.selectedUpperMode.hexbins.slice(0, 5).forEach((h, i) => {
            analysis.push(`  ${i+1}. Pos: (${h.x.toFixed(1)}, ${h.y.toFixed(1)}), Total: ${h.total}, Scale: ${h.scale.toFixed(2)}`);
        });

        if (logData.selectedLowerMode) {
            analysis.push('');
            analysis.push('Selected Lower Half:');
            logData.selectedLowerMode.hexbins.slice(0, 5).forEach((h, i) => {
                analysis.push(`  ${i+1}. Pos: (${h.x.toFixed(1)}, ${h.y.toFixed(1)}), Total: ${h.total}, Scale: ${h.scale.toFixed(2)}`);
            });
        }

        analysis.push('');
        analysis.push('='.repeat(80));

        await fetch('/api/debug-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'HEXBIN_ANALYSIS',
                message: analysis.join('\n')
            })
        });
    }

    createSplitHexbinHeatmap(group, shotsWithCoords, width, height, yOffset) {
        console.log(`createSplitHexbinHeatmap: ${shotsWithCoords.length} shots, yOffset=${yOffset}`);

        if (!d3.hexbin) {
            console.warn('d3-hexbin not available, skipping');
            return;
        }

        try {
            const scaleFactor = width / 600;
            const hexbin = d3.hexbin()
                .x(d => d.visualX)
                .y(d => d.visualY)
                .radius(20 * scaleFactor)
                .extent([[0, yOffset], [width, yOffset + height]]);

            const hexData = hexbin(shotsWithCoords).map(bin => {
                const goals = bin.filter(d => d.result === 'Goal').length;
                const total = bin.length;
                const successRate = total > 0 ? goals / total : 0;

                const xgValues = bin.map(d => parseFloat(d.xg)).filter(xg => !isNaN(xg));
                const avgXG = xgValues.length > 0 ? d3.mean(xgValues) : 0;
                const minXG = xgValues.length > 0 ? d3.min(xgValues) : 0;
                const maxXG = xgValues.length > 0 ? d3.max(xgValues) : 0;

                const shotIds = bin.map(shot => ({
                    id: shot.id || `${shot.shooter}_${shot.x_graph}_${shot.y_graph}`,
                    shooter: shot.shooter,
                    originalX: shot.x_graph,
                    originalY: shot.y_graph,
                    visualX: shot.visualX,
                    visualY: shot.visualY,
                    xg: parseFloat(shot.xg)
                }));

                return {
                    ...bin,
                    goals: goals,
                    total: total,
                    successRate: successRate,
                    shotIds: shotIds,
                    avgXG: avgXG,
                    minXG: minXG,
                    maxXG: maxXG
                };
            });

            const filteredHexData = hexData.filter(d => d.total >= 1);

            const leagueAverage = shotsWithCoords.filter(d => d.result === 'Goal').length / shotsWithCoords.length;

            const colorScale = d3.scaleLinear()
                .domain([0, 0.3, 0.6])
                .range(['#7C3AED', '#00D9FF', '#10B981'])
                .clamp(true);

            const sizeScale = d3.scalePow()
                .exponent(0.8)
                .domain([0, d3.max(filteredHexData, d => d.total)])
                .range([0.3, 1.2]);

            let tooltip = d3.select('body').select('.heatmap-tooltip');
            if (tooltip.empty()) {
                tooltip = d3.select('body').append('div').attr('class', 'heatmap-tooltip tooltip');
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
                .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.5)')
                .style('line-height', '1.4');

            const hexagons = group.selectAll('.hexagon')
                .data(filteredHexData)
                .enter().append('g')
                .attr('class', 'hexagon-group')
                .attr('transform', d => `translate(${d.x},${d.y})`);

            hexagons.append('path')
                .attr('class', 'hexagon')
                .attr('d', hexbin.hexagon())
                .attr('transform', d => {
                    const scale = sizeScale(d.total);
                    return `scale(${scale})`;
                })
                .attr('data-min-xg', d => d.minXG)
                .attr('data-max-xg', d => d.maxXG)
                .attr('data-avg-xg', d => d.avgXG)
                .style('fill', d => colorScale(d.successRate))
                .style('stroke', '#fff')
                .style('stroke-width', 1)
                .style('opacity', 0.93)
                .on('mouseover', function(event, d) {
                    d3.select(this)
                        .style('opacity', 1)
                        .style('stroke-width', 2);

                    tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);

                    const percentage = (d.successRate * 100).toFixed(1);
                    const aboveAverage = d.successRate > leagueAverage;
                    const diff = ((d.successRate - leagueAverage) * 100).toFixed(1);

                    tooltip.html(`
                        <strong>Zone Statistics</strong><br/>
                        Shots: ${d.total}<br/>
                        Goals: ${d.goals}<br/>
                        Success Rate: ${percentage}%<br/>
                        ${aboveAverage ? '↑' : '↓'} ${Math.abs(diff)}% vs average
                    `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function(event, d) {
                    d3.select(this)
                        .style('opacity', 0.93)
                        .style('stroke-width', 1);

                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });

            console.log(`Created ${hexagons.size()} hexagons in split view`);

        } catch (error) {
            console.error('Error creating split hexbin heatmap:', error);
        }
    }

    createHexbinHeatmap(group, shotsWithCoords, width, height) {
        const heatmapLog = [];
        heatmapLog.push(`[${new Date().toISOString()}] Starting createHexbinHeatmap`);
        heatmapLog.push(`d3 available: ${typeof d3 !== 'undefined'}`);
        heatmapLog.push(`d3.hexbin available: ${typeof d3.hexbin !== 'undefined'}`);
        heatmapLog.push(`Shots provided: ${shotsWithCoords.length}`);
        heatmapLog.push(`Width: ${width}, Height: ${height}`);

        console.log('createHexbinHeatmap called with', shotsWithCoords.length, 'shots');
        console.log('d3.hexbin available:', typeof d3.hexbin);

        if (!d3.hexbin) {
            const errorMsg = 'd3-hexbin not available, using fallback grid heatmap';
            console.warn(errorMsg);
            heatmapLog.push(`WARNING: ${errorMsg}`);
            debugLog('Heatmap Warning - Using fallback', { logs: heatmapLog });

            this.createGridHeatmap(group, shotsWithCoords, width, height);
            return;
        }

        try {
            const scaleFactor = width / 600;
            const hexbin = d3.hexbin()
                .x(d => d.visualX)
                .y(d => d.visualY)
                .radius(28 * scaleFactor)
                .extent([[0, 0], [width, height]]);

            heatmapLog.push('Hexbin generator created successfully');

            const hexData = hexbin(shotsWithCoords).map(bin => {
                const goals = bin.filter(d => d.result === 'Goal').length;
                const total = bin.length;
                const successRate = total > 0 ? goals / total : 0;

                const xgValues = bin.map(d => parseFloat(d.xg)).filter(xg => !isNaN(xg));
                const avgXG = xgValues.length > 0 ? d3.mean(xgValues) : 0;
                const minXG = xgValues.length > 0 ? d3.min(xgValues) : 0;
                const maxXG = xgValues.length > 0 ? d3.max(xgValues) : 0;

                const shotIds = bin.map(shot => ({
                    id: shot.id || `${shot.shooter}_${shot.x_graph}_${shot.y_graph}`,
                    shooter: shot.shooter,
                    originalX: shot.x_graph,
                    originalY: shot.y_graph,
                    visualX: shot.visualX,
                    visualY: shot.visualY,
                    xg: parseFloat(shot.xg)
                }));

                return {
                    ...bin,
                    goals: goals,
                    total: total,
                    successRate: successRate,
                    shotIds: shotIds,
                    avgXG: avgXG,
                    minXG: minXG,
                    maxXG: maxXG
                };
            });
            heatmapLog.push(`Hexbin data created: ${hexData.length} hexagons`);

            const filteredHexData = hexData.filter(d => d.total >= 1);
            heatmapLog.push(`Filtered hexagon data: ${filteredHexData.length} hexagons`);

            const leagueAverage = shotsWithCoords.filter(d => d.result === 'Goal').length / shotsWithCoords.length;
            heatmapLog.push(`League average success rate: ${(leagueAverage * 100).toFixed(1)}%`);

            const colorScale = d3.scaleLinear()
                .domain([0, 0.3, 0.6])
                .range(['#7C3AED', '#00D9FF', '#10B981'])
                .clamp(true);
            heatmapLog.push('Color scale created');

            const sizeScale = d3.scalePow()
                .exponent(0.8)
                .domain([0, d3.max(filteredHexData, d => d.total)])
                .range([0.3, 1.2]);
            heatmapLog.push(`Size scale created with max: ${d3.max(filteredHexData, d => d.total)} shots`);

            let tooltip = d3.select('body').select('.heatmap-tooltip');
            if (tooltip.empty()) {
                tooltip = d3.select('body').append('div').attr('class', 'heatmap-tooltip tooltip');
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
                .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.5)')
                .style('line-height', '1.4');
            heatmapLog.push('Tooltip created');

            const isAllShootersMode = !this.app.selectedShooter;
            const trackingData = {
                mode: isAllShootersMode ? 'all_shooters' : 'selected_shooter',
                shooter: this.app.selectedShooter || 'none',
                timestamp: new Date().toISOString(),
                radius: 28 * scaleFactor,
                fieldWidth: width,
                fieldHeight: height,
                hexbins: filteredHexData.map(d => ({
                    x: d.x,
                    y: d.y,
                    total: d.total,
                    goals: d.goals,
                    scale: sizeScale(d.total),
                    shotIds: d.shotIds
                }))
            };

            if (isAllShootersMode) {
                window.hexbinTracking.allShooters = trackingData;
            } else {
                window.hexbinTracking.selectedShooter = trackingData;
                this.compareHexbinPositions();
            }

            const hexbinDebugKey = `all_shooters_${this.app.selectedShooter || 'none'}`;
            window.hexbinDebugData[hexbinDebugKey] = {
                mode: 'all_shooters',
                shooter: this.app.selectedShooter || 'none',
                radius: 28 * scaleFactor,
                fieldWidth: width,
                fieldHeight: height,
                hexbins: filteredHexData.map(d => ({
                    x: d.x,
                    y: d.y,
                    total: d.total,
                    goals: d.goals,
                    scale: sizeScale(d.total)
                }))
            };

            console.log(`Stored hexbin debug data for ${hexbinDebugKey}:`, {
                numHexbins: filteredHexData.length,
                radius: 28 * scaleFactor,
                fieldDimensions: `${width} x ${height}`,
                firstThreeHexbins: filteredHexData.slice(0, 3).map(h => ({
                    x: h.x.toFixed(1),
                    y: h.y.toFixed(1),
                    total: h.total
                }))
            });

            const hexagons = group.selectAll('.hexagon')
                .data(filteredHexData)
                .enter().append('g')
                .attr('class', 'hexagon-group')
                .attr('transform', d => `translate(${d.x},${d.y})`);
            heatmapLog.push(`Created ${hexagons.size()} hexagon groups`);

            hexagons.append('path')
                .attr('class', 'hexagon')
                .attr('d', hexbin.hexagon())
                .attr('transform', d => {
                    const scale = sizeScale(d.total);
                    return `scale(${scale})`;
                })
                .attr('data-min-xg', d => d.minXG)
                .attr('data-max-xg', d => d.maxXG)
                .attr('data-avg-xg', d => d.avgXG)
                .style('fill', d => colorScale(d.successRate))
                .style('stroke', '#fff')
                .style('stroke-width', 1)
                .style('opacity', 0.93)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .style('opacity', 1)
                    .style('stroke-width', 2);

                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);

                const percentage = (d.successRate * 100).toFixed(1);
                const aboveAverage = d.successRate > leagueAverage;
                const diff = ((d.successRate - leagueAverage) * 100).toFixed(1);

                tooltip.html(`
                    <strong>Zone Statistics</strong><br/>
                    Shots: ${d.total}<br/>
                    Goals: ${d.goals}<br/>
                    Success Rate: ${percentage}%<br/>
                    ${aboveAverage ? '↑' : '↓'} ${Math.abs(diff)}% vs average
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .style('opacity', 0.93)
                    .style('stroke-width', 1);

                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

            hexagons.filter(d => d.total >= 5)
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.3em')
                .style('font-size', '11px')
                .style('font-weight', 'bold')
                .style('fill', '#fff')
                .style('pointer-events', 'none')
                .text(d => `${(d.successRate * 100).toFixed(0)}%`);

            heatmapLog.push('Heatmap creation completed successfully');
            debugLog('Heatmap Success', { logs: heatmapLog });

        } catch (error) {
            heatmapLog.push(`ERROR: ${error.message}`);
            heatmapLog.push(`Stack: ${error.stack}`);
            console.error('Error creating hexbin heatmap:', error);
            debugLog('Heatmap Error', {
                logs: heatmapLog,
                error: error.message,
                stack: error.stack
            });
        }
    }

    highlightHexbinsByXGRange(xgMin, xgMax, teamClass) {
        console.log(`Highlighting hexbins with xG range ${xgMin.toFixed(2)}-${xgMax.toFixed(2)} for ${teamClass}`);

        if (!this.shotMapSvg) {
            console.warn('Shot map SVG not found');
            return;
        }
        const hexagons = this.shotMapSvg.selectAll('.hexagon');
        console.log(`Found ${hexagons.size()} hexagons to check`);

        let highlightCount = 0;
        let fadeCount = 0;

        hexagons.each(function(d) {
            const hexagon = d3.select(this);
            const minXG = parseFloat(hexagon.attr('data-min-xg'));
            const maxXG = parseFloat(hexagon.attr('data-max-xg'));
            const avgXG = parseFloat(hexagon.attr('data-avg-xg'));

            const overlaps = !isNaN(minXG) && !isNaN(maxXG) &&
                           ((minXG >= xgMin && minXG < xgMax) ||
                            (maxXG > xgMin && maxXG <= xgMax) ||
                            (minXG <= xgMin && maxXG >= xgMax));

            if (overlaps) {
                hexagon
                    .style('opacity', 1)
                    .style('stroke', '#FFD700')
                    .style('stroke-width', 2.5)
                    .classed('highlighted', true);
                highlightCount++;
            } else {
                hexagon
                    .style('opacity', 0.2)
                    .style('stroke', '#fff')
                    .style('stroke-width', 1)
                    .classed('highlighted', false);
                fadeCount++;
            }
        });

        console.log(`Highlighted ${highlightCount} hexbins, faded ${fadeCount} hexbins`);

        const upperHexagons = this.shotMapSvg.selectAll('.upper-split-group .hexagon');
        const lowerHexagons = this.shotMapSvg.selectAll('.lower-split-group .hexagon');

        [upperHexagons, lowerHexagons].forEach(hexGroup => {
            hexGroup.each(function(d) {
                const hexagon = d3.select(this);
                const minXG = parseFloat(hexagon.attr('data-min-xg'));
                const maxXG = parseFloat(hexagon.attr('data-max-xg'));

                const overlaps = !isNaN(minXG) && !isNaN(maxXG) &&
                               ((minXG >= xgMin && minXG < xgMax) ||
                                (maxXG > xgMin && maxXG <= xgMax) ||
                                (minXG <= xgMin && maxXG >= xgMax));

                if (overlaps) {
                    hexagon
                        .style('opacity', 1)
                        .style('stroke', '#FFD700')
                        .style('stroke-width', 2.5)
                        .classed('highlighted', true);
                } else {
                    hexagon
                        .style('opacity', 0.2)
                        .style('stroke', '#fff')
                        .style('stroke-width', 1)
                        .classed('highlighted', false);
                }
            });
        });
    }

    resetHexbinHighlighting() {
        console.log('Resetting hexbin highlighting');

        if (!this.shotMapSvg) {
            console.warn('Shot map SVG not found');
            return;
        }

        this.shotMapSvg.selectAll('.hexagon')
            .style('opacity', 0.93)
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .classed('highlighted', false);

        this.shotMapSvg.selectAll('.upper-split-group .hexagon, .lower-split-group .hexagon')
            .style('opacity', 0.93)
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .classed('highlighted', false);
    }

    createGridHeatmap(group, shotsWithCoords, width, height) {
        console.log('Creating fallback grid heatmap');

        const cellSize = 40;
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);

        const grid = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * cellSize;
                const y = row * cellSize;

                const shotsInCell = shotsWithCoords.filter(shot =>
                    shot.visualX >= x && shot.visualX < x + cellSize &&
                    shot.visualY >= y && shot.visualY < y + cellSize
                );

                if (shotsInCell.length > 0) {
                    const goals = shotsInCell.filter(s => s.result === 'Goal').length;
                    const successRate = goals / shotsInCell.length;

                    grid.push({
                        x: x + cellSize / 2,
                        y: y + cellSize / 2,
                        total: shotsInCell.length,
                        goals: goals,
                        successRate: successRate
                    });
                }
            }
        }

        const colorScale = d3.scaleLinear()
            .domain([0, 0.3, 0.6])
            .range(['#7C3AED', '#00D9FF', '#10B981'])
            .clamp(true);

        group.selectAll('.grid-cell')
            .data(grid)
            .enter().append('rect')
            .attr('class', 'grid-cell')
            .attr('x', d => d.x - cellSize / 2)
            .attr('y', d => d.y - cellSize / 2)
            .attr('width', cellSize)
            .attr('height', cellSize)
            .style('fill', d => colorScale(d.successRate))
            .style('stroke', '#fff')
            .style('stroke-width', 1)
            .style('opacity', d => Math.min(0.8, 0.2 + (d.total * 0.1)))
            .append('title')
            .text(d => `Shots: ${d.total}, Goals: ${d.goals}, Success: ${(d.successRate * 100).toFixed(1)}%`);

        console.log('Grid heatmap created with', grid.length, 'cells');
    }

    addHeatmapLegend(svg, width, height, margin) {
        const legendWidth = 120;

        const legendX = margin.left + (width / 2) - (legendWidth / 2);
        const legendGroup = svg.append('g')
            .attr('class', 'heatmap-legend')
            .attr('transform', `translate(${legendX}, ${margin.top + 20})`);

        legendGroup.append('text')
            .attr('x', 0)
            .attr('y', -5)
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .text('Success Rate');

        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'heatmap-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%')
            .attr('y1', '0%')
            .attr('y2', '0%');

        const colorStops = [
            { offset: '0%', color: '#7C3AED' },
            { offset: '50%', color: '#00D9FF' },
            { offset: '100%', color: '#10B981' }
        ];

        colorStops.forEach(stop => {
            gradient.append('stop')
                .attr('offset', stop.offset)
                .attr('stop-color', stop.color);
        });

        const legendHeight = 10;
        legendGroup.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#heatmap-gradient)');

        const scaleLabels = [
            { value: '0%', x: 0 },
            { value: '30%', x: legendWidth / 2 },
            { value: '60%+', x: legendWidth }
        ];

        scaleLabels.forEach(label => {
            legendGroup.append('text')
                .attr('x', label.x)
                .attr('y', legendHeight + 12)
                .style('font-size', '8px')
                .style('fill', '#A0A0A8')
                .style('text-anchor', label.x === 0 ? 'start' : (label.x === legendWidth ? 'end' : 'middle'))
                .text(label.value);
        });
    }

    addShotMapLegend(svg, width, height, margin, colorScale) {
        const legendWidth = 200;
        const legendHeight = 20;
        const legendX = width + margin.left - legendWidth;
        const legendY = height + margin.top + 20;

        const legend = svg.append('g')
            .attr('class', 'shot-map-legend')
            .attr('transform', `translate(${legendX}, ${legendY})`);

        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'legend-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%')
            .attr('y1', '0%')
            .attr('y2', '0%');

        gradient.selectAll('stop')
            .data(d3.range(0, 1.1, 0.1))
            .enter().append('stop')
            .attr('offset', d => `${d * 100}%`)
            .attr('stop-color', d => colorScale(d));

        legend.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#legend-gradient)')
            .style('stroke', '#333');

        legend.append('text')
            .attr('x', 0)
            .attr('y', legendHeight + 15)
            .text('0%')
            .style('text-anchor', 'start');

        legend.append('text')
            .attr('x', legendWidth / 2)
            .attr('y', legendHeight + 15)
            .text('Success Rate')
            .style('text-anchor', 'middle');

        legend.append('text')
            .attr('x', legendWidth)
            .attr('y', legendHeight + 15)
            .text('100%')
            .style('text-anchor', 'end');
    }

    toggleShotDots(show) {
        this.showDots = show;
        if (this.dotsLayer) {
            this.dotsLayer.style('display', show ? 'block' : 'none');
        }
        if (this.shotMapSvg) {
            this.shotMapSvg.select('.shot-map-legend').style('display', show ? 'block' : 'none');
        }
    }

    toggleHeatmap(show) {
        this.showHeatmap = show;
        if (this.heatmapLayer) {
            this.heatmapLayer.style('display', show ? 'block' : 'none');
        }
        if (this.shotMapSvg) {
            this.shotMapSvg.select('.heatmap-legend').style('display', show ? 'block' : 'none');
            this.shotMapSvg.select('.size-legend').style('display', show ? 'block' : 'none');
        }
    }
}

window.ShotMap = ShotMap;
