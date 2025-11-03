class GoalkeeperQuadrant {
    constructor() {
        this.currentData = null;
        this.selectedGoalkeeper = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const gkSelect = document.getElementById('goalkeeper-select');
        if (gkSelect) {
            gkSelect.addEventListener('change', (e) => {
                this.selectedGoalkeeper = e.target.value || null;
                this.createQuadrant();
            });
        }
    }

    setData(gameData, selectedGoalkeeper = null) {
        this.currentData = gameData;
        this.selectedGoalkeeper = selectedGoalkeeper;
        this.createQuadrant();
    }

    createQuadrant() {
        const container = d3.select('#goalkeeper-quadrant');
        container.selectAll('*').remove();

        d3.selectAll('.gkquadrant-tooltip').remove();

        if (!this.currentData || this.currentData.length === 0) {
            container.append('div')
                .style('text-align', 'center')
                .style('color', '#A0A0A8')
                .style('padding', '20px')
                .text('No data available');
            return;
        }

        // Filter nur shots on goal (Goal oder Saved) von Team 2 gegen Team 1
        const team1Name = this.currentData[0]?.team1;

        let shotsOnGoal = this.currentData.filter(shot => {
            // Nur Schüsse von Team 2 (shooting_team !== team1)
            const isTeam2Shooting = shot.shooting_team !== team1Name;
            if (!isTeam2Shooting) return false;

            // Nur Goal oder Saved
            const resultIsRelevant = shot.result === 'Goal' || shot.result === 'Saved';
            if (!resultIsRelevant) return false;

            // Kein 6v5 ohne Torhüter (t1x muss leer sein)
            if (shot.t1x !== null && shot.t1x !== undefined && shot.t1x !== '') {
                return false;
            }

            return true;
        });

        // Filter nach Goalkeeper wenn ausgewählt
        if (this.selectedGoalkeeper) {
            shotsOnGoal = shotsOnGoal.filter(shot => shot.t1g === this.selectedGoalkeeper);
        }

        if (shotsOnGoal.length === 0) {
            container.append('div')
                .style('text-align', 'center')
                .style('color', '#A0A0A8')
                .style('padding', '20px')
                .text('No shots on goal');
            return;
        }

        // Kategorisiere Schüsse in Quadranten mit fixen xG-Schwellenwerten
        const quadrants = {
            'heroSaves': [],      // xG > 0.3 + Saved
            'routine': [],        // xG 0-0.3 + Saved
            'acceptable': [],     // xG > 0.3 + Goal
            'lowXgGoals': []      // xG < 0.1 + Goal
        };

        shotsOnGoal.forEach(shot => {
            const xg = parseFloat(shot.xg) || 0;
            const isSaved = shot.result === 'Saved';
            const isGoal = shot.result === 'Goal';

            if (xg > 0.3 && isSaved) {
                quadrants.heroSaves.push(shot);
            } else if (xg >= 0 && xg <= 0.3 && isSaved) {
                quadrants.routine.push(shot);
            } else if (xg > 0.3 && isGoal) {
                quadrants.acceptable.push(shot);
            } else if (xg < 0.1 && isGoal) {
                quadrants.lowXgGoals.push(shot);
            }
        });

        // Zähle Shot Types pro Quadrant
        const shotTypes = ['Direct', 'One-timer', 'Rebound', 'Turnover | Direct', 'Turnover | One-timer'];

        const countTypesByQuadrant = (shots) => {
            const counts = {};
            shotTypes.forEach(type => {
                counts[type] = shots.filter(s => s.type === type).length;
            });
            return counts;
        };

        const typeBreakdown = {
            heroSaves: countTypesByQuadrant(quadrants.heroSaves),
            routine: countTypesByQuadrant(quadrants.routine),
            acceptable: countTypesByQuadrant(quadrants.acceptable),
            lowXgGoals: countTypesByQuadrant(quadrants.lowXgGoals)
        };

        // SVG Setup - rechtsbündig in 300px Container
        const containerWidth = 300;
        const margin = { top: 0, right: 0, bottom: 5, left: 0 };
        const width = containerWidth - margin.left - margin.right;
        const height = 235;

        // Title vor SVG
        container.append('div')
            .style('text-align', 'right')
            .style('font-size', '11px')
            .style('color', '#A0A0A8')
            .style('font-weight', '600')
            .style('margin-bottom', '8px')
            .text(`Shot Performance (${shotsOnGoal.length} shots on goal)`);

        const svg = container.append('svg')
            .attr('width', containerWidth)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'gkquadrant-tooltip')
            .style('position', 'absolute')
            .style('background-color', 'rgba(0, 0, 0, 0.9)')
            .style('color', '#E5E5E7')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('border', '1px solid rgba(255, 255, 255, 0.2)')
            .style('font-size', '11px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 1000);

        // Quadrant Dimensionen
        const quadWidth = width / 2;
        const quadHeight = height / 2;

        // Quadrant Layout: [y][x] = [row][col]
        // Oben = High xG, Unten = Low xG
        // Links = GOAL, Rechts = SAVED
        const layout = [
            [
                { key: 'acceptable', label: 'Acceptable Goals', subtitle: '>0.3 xG', color: '#F59E0B' },
                { key: 'heroSaves', label: 'Hero Saves', subtitle: '>0.3 xG', color: '#10B981' }
            ],
            [
                { key: 'lowXgGoals', label: 'Low xG Goals', subtitle: '<0.1 xG', color: '#7C3AED' },
                { key: 'routine', label: 'Routine Saves', subtitle: '0-0.3 xG', color: '#00D9FF' }
            ]
        ];

        // Zeichne Quadranten
        layout.forEach((row, rowIdx) => {
            row.forEach((quad, colIdx) => {
                const x = colIdx * quadWidth;
                const y = rowIdx * quadHeight;
                const shots = quadrants[quad.key];
                const total = shots.length;
                const percentage = shotsOnGoal.length > 0 ? (total / shotsOnGoal.length * 100) : 0;

                // Hintergrund mit hover
                g.append('rect')
                    .attr('x', x + 2)
                    .attr('y', y + 2)
                    .attr('width', quadWidth - 4)
                    .attr('height', quadHeight - 4)
                    .attr('fill', '#1A1A1D')
                    .attr('stroke', quad.color)
                    .attr('stroke-width', 1)
                    .attr('rx', 0)
                    .on('mouseover', (event) => {
                        const types = typeBreakdown[quad.key];
                        let tooltipHtml = `<strong>${quad.label}</strong><br/>`;
                        tooltipHtml += `<div style="margin-top: 6px; font-size: 10px;">`;

                        let hasTypes = false;
                        shotTypes.forEach(type => {
                            const count = types[type];
                            if (count > 0) {
                                hasTypes = true;
                                const shortName = type.replace('Turnover | ', 'TO ');
                                tooltipHtml += `${shortName}: ${count}<br/>`;
                            }
                        });

                        if (!hasTypes) {
                            tooltipHtml += `No shots`;
                        }

                        tooltipHtml += `</div>`;

                        tooltip
                            .html(tooltipHtml)
                            .style('opacity', 1)
                            .style('left', (event.pageX + 10) + 'px')
                            .style('top', (event.pageY - 10) + 'px');
                    })
                    .on('mousemove', (event) => {
                        tooltip
                            .style('left', (event.pageX + 10) + 'px')
                            .style('top', (event.pageY - 10) + 'px');
                    })
                    .on('mouseout', () => {
                        tooltip.style('opacity', 0);
                    });

                // Center Y for all elements
                const centerY = y + quadHeight / 2;

                // Quadrant Label
                g.append('text')
                    .attr('x', x + quadWidth / 2)
                    .attr('y', centerY - 20)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('fill', quad.color)
                    .style('font-weight', '700')
                    .text(quad.label);

                // Subtitle with xG range
                g.append('text')
                    .attr('x', x + quadWidth / 2)
                    .attr('y', centerY - 8)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '8px')
                    .style('fill', '#A0A0A8')
                    .text(quad.subtitle);

                // Total Count
                g.append('text')
                    .attr('x', x + quadWidth / 2)
                    .attr('y', centerY + 12)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '22px')
                    .style('fill', '#E5E5E7')
                    .style('font-weight', '700')
                    .text(total);

                // Percentage
                g.append('text')
                    .attr('x', x + quadWidth / 2)
                    .attr('y', centerY + 28)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('fill', '#A0A0A8')
                    .text(`${percentage.toFixed(0)}%`);
            });
        });

        // Trennlinien
        g.append('line')
            .attr('x1', quadWidth)
            .attr('y1', 0)
            .attr('x2', quadWidth)
            .attr('y2', height)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.3);

        g.append('line')
            .attr('x1', 0)
            .attr('y1', quadHeight)
            .attr('x2', width)
            .attr('y2', quadHeight)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.3);

    }
}

window.GoalkeeperQuadrant = GoalkeeperQuadrant;

const goalkeeperQuadrant = new GoalkeeperQuadrant();
