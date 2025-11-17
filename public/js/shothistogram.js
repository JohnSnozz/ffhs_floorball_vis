class ShotHistogram {
    constructor(app) {
        this.app = app;
        this.team1HistGroup = null;
        this.team2HistGroup = null;
        this.team1Name = null;
        this.team2Name = null;
        this.team1FullData = null;
        this.team2FullData = null;
        this.histogramWidth = null;
        this.histogramHeight = null;
    }

    createXGHistograms(data, fieldWidth, fieldHeight, margin) {
        console.log('Creating xG histograms');
        console.log('Current game ID:', this.app.currentGameId);

        d3.select('#shothistogram-for').selectAll('*').remove();
        d3.select('#shothistogram-against').selectAll('*').remove();
        d3.select('#performance-spider').selectAll('*').remove();

        const uniqueShootingTeams = [...new Set(data.map(d => d.shooting_team))].filter(t => t);

        console.log('Unique shooting teams:', uniqueShootingTeams);

        if (uniqueShootingTeams.length === 0) {
            console.log('No teams found for histogram');
            return;
        }

        let team1, team2, team1Shots, team2Shots;
        let team1FullShots, team2FullShots;

        if (this.app.selectedShooter) {
            team1 = this.app.selectedShooter;
            team1Shots = data;

            const teamFilteredData = this.app.currentTeamFilteredData || this.app.currentGameData;

            const team1Name = this.app.currentGameData[0]?.team1;

            team1FullShots = this.app.currentGameData.filter(d => d.shooting_team === team1Name);

            team2 = `Opponents (${this.app.selectedShooter} defending)`;

            team2Shots = teamFilteredData.filter(d => {
                const playerName = this.app.selectedShooter;
                const isOpponentShot = d.shooting_team && d.shooting_team !== team1Name;
                const playerOnField = d.t1lw === playerName ||
                                     d.t1c === playerName ||
                                     d.t1rw === playerName ||
                                     d.t1ld === playerName ||
                                     d.t1rd === playerName ||
                                     d.t1g === playerName ||
                                     d.t1x === playerName;
                return isOpponentShot && playerOnField;
            });

            team2FullShots = this.app.currentGameData.filter(d => d.shooting_team && d.shooting_team !== team1Name);

            console.log(`Selected shooter: ${team1}`);
            console.log(`Current game ID: ${this.app.currentGameId}`);
            console.log(`Shooter's shots: ${team1Shots.length}`);
            console.log(`Team shots (background - white outline): ${team1FullShots.length}`);
            console.log(`Opponent shots when ${team1} defending: ${team2Shots.length}`);
            console.log(`All opponent shots (background - white outline): ${team2FullShots.length}`);
        } else if (this.app.currentGameId === 'all') {
            const allTeamsUnfiltered = [...new Set(this.app.currentGameData.map(d => d.shooting_team))].filter(t => t);
            team1 = allTeamsUnfiltered[0];
            team2 = 'All Opponents';
            team1Shots = data.filter(d => d.shooting_team === team1);
            team2Shots = data.filter(d => d.shooting_team !== team1);
        } else {
            // Use the actual team names from the data, not from shooting_team
            const gameData = this.app.currentGameData;
            if (gameData && gameData.length > 0) {
                team1 = gameData[0].team1;  // Home team from the data
                team2 = gameData[0].team2;  // Away team from the data
                team1Shots = data.filter(d => d.shooting_team === team1);
                team2Shots = data.filter(d => d.shooting_team === team2);
            } else {
                // Fallback to uniqueShootingTeams if no game data
                team1 = uniqueShootingTeams[0];
                team2 = uniqueShootingTeams.length > 1 ? uniqueShootingTeams[1] : team1;
                team1Shots = data.filter(d => d.shooting_team === team1);
                team2Shots = data.filter(d => d.shooting_team === team2);
            }
        }

        console.log(`Team 1 (${team1}): ${team1Shots.length} shots`);
        console.log(`Team 2 (${team2}): ${team2Shots.length} shots`);

        const histogramForContainer = d3.select('#shothistogram-for');
        const histogramAgainstContainer = d3.select('#shothistogram-against');
        const spiderContainer = d3.select('#performance-spider');

        const histogramForRect = histogramForContainer.node().getBoundingClientRect();
        const histogramAgainstRect = histogramAgainstContainer.node().getBoundingClientRect();
        const spiderRect = spiderContainer.node().getBoundingClientRect();

        const histogramWidth = histogramForRect.width - 40;
        const histogramHeight = histogramForRect.height - 40;

        let sharedYMax = null;
        if (!this.app.selectedShooter) {
            sharedYMax = this.calculateSharedYMax(team1Shots, team2Shots);
            console.log(`Shared Y max for team comparison: ${sharedYMax}`);
        } else {
            console.log(`Player selected - using independent Y scales for each histogram`);
        }

        if (this.app.selectedShooter) {
            this.team1FullData = team1FullShots ? team1FullShots.filter(d => {
                const xg = parseFloat(d.xg);
                return !isNaN(xg) && xg >= 0 && xg <= 0.6;
            }) : null;
            this.team2FullData = team2FullShots ? team2FullShots.filter(d => {
                const xg = parseFloat(d.xg);
                return !isNaN(xg) && xg >= 0 && xg <= 0.6;
            }) : null;
        } else {
            this.team1FullData = null;
            this.team2FullData = null;
        }

        const svgFor = histogramForContainer.append('svg')
            .attr('width', histogramForRect.width)
            .attr('height', histogramForRect.height);

        const team1HistGroup = svgFor.append('g')
            .attr('class', 'xg-histogram-team1')
            .attr('transform', `translate(20, 20)`);

        this.drawXGHistogram(team1HistGroup, team1Shots, histogramWidth, histogramHeight, team1, 'team1', sharedYMax);

        const svgAgainst = histogramAgainstContainer.append('svg')
            .attr('width', histogramAgainstRect.width)
            .attr('height', histogramAgainstRect.height);

        const team2HistGroup = svgAgainst.append('g')
            .attr('class', 'xg-histogram-team2')
            .attr('transform', `translate(20, 20)`);

        this.drawXGHistogram(team2HistGroup, team2Shots, histogramWidth, histogramHeight, team2, 'team2', sharedYMax);

        const svgSpider = spiderContainer.append('svg')
            .attr('width', spiderRect.width)
            .attr('height', spiderRect.height)
            .style('display', 'block');

        const spiderWidth = spiderRect.width;
        const spiderHeight = spiderRect.height;

        let spiderPlayerData = null;
        let spiderTeamData = null;
        let spiderAllData = null;

        if (this.app.selectedShooter) {
            const playerName = this.app.selectedShooter;
            const unfilteredData = this.app.currentGameData;

            const playerPersonalShots = unfilteredData.filter(d => d.shooter === playerName);

            const teamShotsWhilePlayerOnIce = unfilteredData.filter(d => {
                const playerOnField = d.t1lw === playerName ||
                                     d.t1c === playerName ||
                                     d.t1rw === playerName ||
                                     d.t1ld === playerName ||
                                     d.t1rd === playerName ||
                                     d.t1g === playerName ||
                                     d.t1x === playerName ||
                                     d.t2lw === playerName ||
                                     d.t2c === playerName ||
                                     d.t2rw === playerName ||
                                     d.t2ld === playerName ||
                                     d.t2rd === playerName ||
                                     d.t2g === playerName ||
                                     d.t2x === playerName;
                return playerOnField;
            });

            console.log(`Shots while ${playerName} on ice: ${teamShotsWhilePlayerOnIce.length}`);
            const playerTeamName = playerPersonalShots[0]?.shooting_team || team1Shots[0]?.shooting_team;
            const teamShotsWhileOnIce = teamShotsWhilePlayerOnIce.filter(d => d.shooting_team === playerTeamName).length;
            const oppShotsWhileOnIce = teamShotsWhilePlayerOnIce.filter(d => d.shooting_team !== playerTeamName).length;
            console.log(`  Team shots: ${teamShotsWhileOnIce}, Opponent shots: ${oppShotsWhileOnIce}`);

            spiderPlayerData = { shots: playerPersonalShots, allShots: teamShotsWhilePlayerOnIce };
            spiderTeamData = { shots: team1FullShots, allShots: [...team1FullShots, ...team2FullShots] };
            spiderAllData = teamShotsWhilePlayerOnIce;
        } else if (this.app.currentGameId === 'all') {
            const unfilteredData = this.app.currentGameData;
            const allTeamsUnfiltered = [...new Set(unfilteredData.map(d => d.shooting_team))].filter(t => t);
            const team1Unfiltered = allTeamsUnfiltered[0];
            const team1ShotsUnfiltered = unfilteredData.filter(d => d.shooting_team === team1Unfiltered);
            const team2ShotsUnfiltered = unfilteredData.filter(d => d.shooting_team !== team1Unfiltered);

            spiderPlayerData = team1ShotsUnfiltered;
            spiderTeamData = null;
            spiderAllData = [...team1ShotsUnfiltered, ...team2ShotsUnfiltered];
        } else {
            const unfilteredData = this.app.currentGameData;
            const uniqueTeams = [...new Set(unfilteredData.map(d => d.shooting_team))].filter(t => t);
            const team1Unfiltered = uniqueTeams[0];
            const team2Unfiltered = uniqueTeams.length > 1 ? uniqueTeams[1] : team1Unfiltered;
            const team1ShotsUnfiltered = unfilteredData.filter(d => d.shooting_team === team1Unfiltered);
            const team2ShotsUnfiltered = unfilteredData.filter(d => d.shooting_team === team2Unfiltered);

            spiderPlayerData = team1ShotsUnfiltered;
            spiderTeamData = team2ShotsUnfiltered;
            spiderAllData = [...team1ShotsUnfiltered, ...team2ShotsUnfiltered];
        }

        this.app.performanceSpider.createSpiderDiagram(svgSpider, spiderPlayerData, spiderTeamData, spiderAllData, this.app.currentGameData, spiderWidth, spiderHeight,
            { x: spiderWidth / 2, y: spiderHeight / 2 });

        this.team1HistGroup = team1HistGroup;
        this.team2HistGroup = team2HistGroup;
        this.team1Name = team1;
        this.team2Name = team2;
        this.histogramWidth = histogramWidth;
        this.histogramHeight = histogramHeight;
    }

    calculateSharedYMax(team1Shots, team2Shots) {
        const binWidth = 0.05;
        const thresholds = d3.range(0, 0.6 + binWidth, binWidth);

        const team1ValidShots = team1Shots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        const team1BinnedData = thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = team1ValidShots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });
            return binShots.length;
        });

        const team2ValidShots = team2Shots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        const team2BinnedData = thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = team2ValidShots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });
            return binShots.length;
        });

        const team1Max = d3.max(team1BinnedData) || 0;
        const team2Max = d3.max(team2BinnedData) || 0;
        return Math.max(team1Max, team2Max);
    }

    drawXGHistogram(group, shots, width, height, teamName, teamClass, sharedYMax) {
        console.log(`Drawing histogram for ${teamName} (${teamClass}): ${shots.length} shots`);

        const shootingTeams = [...new Set(shots.map(d => d.shooting_team))];
        console.log(`Shooting teams in ${teamName} data:`, shootingTeams);

        const validShots = shots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        console.log(`Valid shots for ${teamName}: ${validShots.length}`);

        if (!this.app.selectedShooter) {
            this[`${teamClass}FullData`] = validShots;
            this[`${teamClass}TeamName`] = teamName;
        }

        group.append('text')
            .attr('x', width)
            .attr('y', 0)
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#E5E5E7')
            .text(`${shots.length} shots`);

        if (validShots.length === 0) {
            group.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .style('fill', '#999')
                .text('No xG data available');
            return;
        }

        const binWidth = 0.05;
        const thresholds = d3.range(0, 0.6 + binWidth, binWidth);
        const resultTypes = ['Goal', 'Saved', 'Missed', 'Blocked'];

        const colorScale = d3.scaleOrdinal()
            .domain(resultTypes)
            .range(['#10B981', '#00D9FF', '#F59E0B', '#EF4444']);

        const binnedData = thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = validShots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });

            const resultCounts = {};
            let y0 = 0;

            const stacks = resultTypes.map(result => {
                const count = binShots.filter(d => d.result === result).length;
                resultCounts[result] = count;
                const stack = {
                    result: result,
                    count: count,
                    y0: y0,
                    y1: y0 + count
                };
                y0 += count;
                return stack;
            });

            return {
                x0: threshold,
                x1: thresholds[i + 1],
                total: binShots.length,
                shots: binShots,
                stacks: stacks,
                resultCounts: resultCounts
            };
        });

        const x = d3.scaleLinear()
            .domain([0, 0.6])
            .range([0, width]);

        const yMax = sharedYMax !== null ? sharedYMax : d3.max(binnedData, d => d.total) || 0;
        console.log(`Y-axis max for ${teamName}: ${yMax} (sharedYMax: ${sharedYMax})`);

        if (!yMax || yMax === 0) {
            console.warn(`No valid yMax for histogram ${teamName}, using default of 10`);
        }

        const y = d3.scaleLinear()
            .domain([0, yMax || 10])
            .nice()
            .range([height, 0]);

        let teamOutlineData = null;
        if (this.app.selectedShooter && this[`${teamClass}FullData`]) {
            const teamFullData = this[`${teamClass}FullData`];

            const teamBinnedData = thresholds.slice(0, -1).map((threshold, i) => {
                const binShots = teamFullData.filter(d => {
                    const xg = parseFloat(d.xg);
                    return xg >= threshold && xg < thresholds[i + 1];
                });
                return {
                    x0: threshold,
                    x1: thresholds[i + 1],
                    total: binShots.length
                };
            });

            const teamMaxBin = d3.max(teamBinnedData, d => d.total) || 1;
            const currentMaxBin = yMax;
            const scaleFactor = currentMaxBin / teamMaxBin;

            teamOutlineData = teamBinnedData.map(bin => ({
                ...bin,
                scaledTotal: bin.total * scaleFactor
            }));
        }

        const barGroup = group.append('g').attr('class', 'histogram-bars');

        const self = this;

        binnedData.forEach(bin => {
            const binGroup = barGroup.append('g')
                .attr('class', 'bin-group')
                .attr('transform', `translate(${x(bin.x0)}, 0)`);

            binGroup.selectAll('.stack-segment')
                .data(bin.stacks.filter(s => s.count > 0))
                .enter().append('rect')
                .attr('class', d => `stack-segment result-${d.result.toLowerCase()}`)
                .attr('x', 0)
                .attr('width', Math.max(0, x(bin.x1) - x(bin.x0) - 1))
                .attr('y', d => y(d.y1))
                .attr('height', d => y(d.y0) - y(d.y1))
                .style('fill', d => colorScale(d.result))
                .style('opacity', self.app.selectedShooter ? 0.6 : 0.8)
                .style('stroke', '#fff')
                .style('stroke-width', 0.5)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    binGroup.selectAll('.stack-segment')
                        .style('opacity', self.app.selectedShooter ? 0.8 : 0.95);

                    const xgMin = bin.x0;
                    const xgMax = bin.x1;
                    self.app.shotMap.highlightHexbinsByXGRange(xgMin, xgMax, teamClass);
                })
                .on('mouseout', function() {
                    binGroup.selectAll('.stack-segment')
                        .style('opacity', self.app.selectedShooter ? 0.6 : 0.8);

                    self.app.shotMap.resetHexbinHighlighting();
                })
                .append('title')
                .text(d => {
                    const tooltip = `xG: ${bin.x0.toFixed(2)}-${bin.x1.toFixed(2)}\n` +
                        `Total: ${bin.total} shots\n` +
                        `Goals: ${bin.resultCounts['Goal'] || 0}\n` +
                        `Saved: ${bin.resultCounts['Saved'] || 0}\n` +
                        `Missed: ${bin.resultCounts['Missed'] || 0}\n` +
                        `Blocked: ${bin.resultCounts['Blocked'] || 0}`;
                    return tooltip;
                });
        });

        group.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickValues([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
                .tickFormat(d => d.toFixed(1)));

        group.append('g')
            .call(d3.axisLeft(y).ticks(5));

        group.append('text')
            .attr('transform', `translate(${width / 2}, ${height + 35})`)
            .style('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#A0A0A8')
            .text('xG Value');

        if (this.app.selectedShooter && teamOutlineData) {
            const lineGenerator = d3.line()
                .x(d => d.x)
                .y(d => d.y);

            const pathData = [];

            pathData.push({ x: x(0), y: height });

            teamOutlineData.forEach((bin, i) => {
                const binX = x(bin.x0);
                const binWidth = x(bin.x1) - x(bin.x0);
                const binY = y(bin.scaledTotal);

                if (i === 0 || bin.scaledTotal !== teamOutlineData[i-1].scaledTotal) {
                    pathData.push({ x: binX, y: binY });
                }

                pathData.push({ x: binX + binWidth, y: binY });

                if (i === teamOutlineData.length - 1) {
                    pathData.push({ x: binX + binWidth, y: height });
                } else if (teamOutlineData[i + 1].scaledTotal !== bin.scaledTotal) {
                    pathData.push({ x: binX + binWidth, y: y(teamOutlineData[i + 1].scaledTotal) });
                }
            });

            group.append('path')
                .attr('class', 'team-histogram-outline')
                .attr('d', lineGenerator(pathData))
                .style('fill', 'none')
                .style('stroke', '#fff')
                .style('stroke-width', 1.5)
                .style('opacity', 0.9)
                .style('pointer-events', 'none');
        }

        const xgValues = validShots.map(d => parseFloat(d.xg));
        const avgXG = d3.mean(xgValues);
        if (avgXG) {
            group.append('line')
                .attr('class', 'average-line')
                .attr('x1', x(avgXG))
                .attr('x2', x(avgXG))
                .attr('y1', 0)
                .attr('y2', height)
                .style('stroke', '#A0A0A8')
                .style('stroke-width', 2)
                .style('stroke-dasharray', '5,5');

            group.append('text')
                .attr('x', x(avgXG))
                .attr('y', -2)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', '#A0A0A8')
                .text(`Avg: ${avgXG.toFixed(3)}`);
        }

        group.datum({
            teamName: teamName,
            binnedData: binnedData,
            xScale: x,
            yScale: y,
            height: height,
            totalShots: validShots,
            colorScale: colorScale
        });
    }

    updateXGHistogramsWithPlayer(playerName) {
        if (!this.app.currentGameData || !this.team1HistGroup || !this.team2HistGroup) {
            return;
        }

        console.log(`Updating histograms with player overlay: ${playerName}`);

        const playerShots = this.app.currentGameData.filter(d => d.shooter === playerName);

        if (playerShots.length === 0) {
            console.log(`No shots found for player: ${playerName}`);
            return;
        }

        const playerTeam = playerShots[0].shooting_team;

        const shotsAgainstPlayer = this.app.currentGameData.filter(shot => {
            if (playerTeam === this.team1Name) {
                return shot.shooting_team === this.team2Name && (
                    shot.t1lw === playerName ||
                    shot.t1c === playerName ||
                    shot.t1rw === playerName ||
                    shot.t1ld === playerName ||
                    shot.t1rd === playerName ||
                    shot.t1g === playerName ||
                    shot.t1x === playerName
                );
            } else {
                return shot.shooting_team === this.team1Name && (
                    shot.t2lw === playerName ||
                    shot.t2c === playerName ||
                    shot.t2rw === playerName ||
                    shot.t2ld === playerName ||
                    shot.t2rd === playerName ||
                    shot.t2g === playerName ||
                    shot.t2x === playerName
                );
            }
        });

        console.log(`Found ${shotsAgainstPlayer.length} shots against ${playerName} when defending`);

        if (playerTeam === this.team1Name) {
            if (this.team1HistGroup) {
                this.addPlayerOverlay(this.team1HistGroup, playerShots, playerName, 'offensive');
            }
            if (this.team2HistGroup && shotsAgainstPlayer.length > 0) {
                this.addPlayerOverlay(this.team2HistGroup, shotsAgainstPlayer, playerName, 'defensive');
            }
        } else if (playerTeam === this.team2Name) {
            if (this.team2HistGroup) {
                this.addPlayerOverlay(this.team2HistGroup, playerShots, playerName, 'offensive');
            }
            if (this.team1HistGroup && shotsAgainstPlayer.length > 0) {
                this.addPlayerOverlay(this.team1HistGroup, shotsAgainstPlayer, playerName, 'defensive');
            }
        }
    }

    addPlayerOverlay(histGroup, playerShots, playerName, mode = 'offensive') {
        histGroup.selectAll('.player-overlay').remove();

        const histData = histGroup.datum();
        if (!histData) return;

        const { xScale, yScale, height, colorScale } = histData;

        const validPlayerShots = playerShots.filter(d => {
            const xg = parseFloat(d.xg);
            return !isNaN(xg) && xg >= 0 && xg <= 0.6;
        });

        if (validPlayerShots.length === 0) return;

        const binWidth = 0.05;
        const thresholds = d3.range(0, 0.6 + binWidth, binWidth);
        const resultTypes = ['Goal', 'Saved', 'Missed', 'Blocked'];

        const playerBinnedData = thresholds.slice(0, -1).map((threshold, i) => {
            const binShots = validPlayerShots.filter(d => {
                const xg = parseFloat(d.xg);
                return xg >= threshold && xg < thresholds[i + 1];
            });

            let y0 = 0;
            const stacks = resultTypes.map(result => {
                const count = binShots.filter(d => d.result === result).length;
                const stack = {
                    result: result,
                    count: count,
                    y0: y0,
                    y1: y0 + count
                };
                y0 += count;
                return stack;
            });

            return {
                x0: threshold,
                x1: thresholds[i + 1],
                total: binShots.length,
                stacks: stacks
            };
        });

        const playerOverlay = histGroup.append('g')
            .attr('class', 'player-overlay');

        playerBinnedData.forEach(bin => {
            if (bin.total === 0) return;

            const binGroup = playerOverlay.append('g')
                .attr('transform', `translate(${xScale(bin.x0)}, 0)`);

            binGroup.append('rect')
                .attr('class', 'player-outline')
                .attr('x', 0)
                .attr('y', yScale(bin.total))
                .attr('width', Math.max(0, xScale(bin.x1) - xScale(bin.x0) - 1))
                .attr('height', yScale(0) - yScale(bin.total))
                .style('fill', 'none')
                .style('stroke', mode === 'offensive' ? '#E06B47' : '#444A87')
                .style('stroke-width', 2);

            binGroup.selectAll('.player-stack')
                .data(bin.stacks.filter(s => s.count > 0))
                .enter().append('rect')
                .attr('class', 'player-stack')
                .attr('x', 1)
                .attr('width', Math.max(0, xScale(bin.x1) - xScale(bin.x0) - 3))
                .attr('y', d => yScale(d.y1))
                .attr('height', d => yScale(d.y0) - yScale(d.y1))
                .style('fill', d => colorScale(d.result))
                .style('opacity', 1)
                .style('stroke', '#fff')
                .style('stroke-width', 0.5);
        });

        const playerXgValues = validPlayerShots.map(d => parseFloat(d.xg));
        const playerAvgXG = d3.mean(playerXgValues);
        if (playerAvgXG) {
            const lineColor = mode === 'offensive' ? '#E06B47' : '#444A87';

            playerOverlay.append('line')
                .attr('class', 'player-average-line')
                .attr('x1', xScale(playerAvgXG))
                .attr('x2', xScale(playerAvgXG))
                .attr('y1', 0)
                .attr('y2', height)
                .style('stroke', lineColor)
                .style('stroke-width', 3)
                .style('stroke-dasharray', '3,3');

            const labelText = mode === 'offensive'
                ? `${playerName}: ${playerAvgXG.toFixed(3)}`
                : `vs ${playerName}: ${playerAvgXG.toFixed(3)}`;

            playerOverlay.append('text')
                .attr('x', xScale(playerAvgXG))
                .attr('y', -15)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', lineColor)
                .style('font-weight', 'bold')
                .text(labelText);
        }

        const statsText = mode === 'offensive'
            ? `${playerName}: ${validPlayerShots.length} shots`
            : `Shots vs ${playerName}: ${validPlayerShots.length}`;

        playerOverlay.append('text')
            .attr('x', xScale(0.3))
            .attr('y', -25)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#E5E5E7')
            .style('font-weight', 'bold')
            .text(statsText);
    }

    clearPlayerOverlay() {
        if (this.team1HistGroup) {
            this.team1HistGroup.selectAll('.player-overlay').remove();
        }
        if (this.team2HistGroup) {
            this.team2HistGroup.selectAll('.player-overlay').remove();
        }
        this.team1FullData = null;
        this.team2FullData = null;
    }
}

window.ShotHistogram = ShotHistogram;
