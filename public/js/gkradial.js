class GoalkeeperRadialChart {
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
                this.createRadialChart();
            });
        }
    }

    setData(currentGameData, allGamesData, selectedGoalkeeper = null, typeFilters = []) {
        this.currentGameData = currentGameData;
        this.allGamesData = allGamesData;
        this.selectedGoalkeeper = selectedGoalkeeper;
        this.typeFilters = typeFilters;
        this.createRadialChart();
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

            if (goalkeeper) {
                let shotGoalkeeper = shot.t1g;
                if (shotGoalkeeper !== goalkeeper) return false;
            }

            if (this.typeFilters && this.typeFilters.length > 0) {
                const shotType = shot.type;
                const isDirectShot = shotType === 'Direct' || shotType === 'Turnover | Direct';
                const isOneTimerShot = shotType === 'One-timer' || shotType === 'Turnover | One-timer';
                const isReboundShot = shotType === 'Rebound';

                let matchesTypeFilter = false;
                if (this.typeFilters.includes('Direct') && isDirectShot) {
                    matchesTypeFilter = true;
                }
                if (this.typeFilters.includes('One-timer') && isOneTimerShot) {
                    matchesTypeFilter = true;
                }
                if (this.typeFilters.includes('Rebound') && isReboundShot) {
                    matchesTypeFilter = true;
                }

                if (!matchesTypeFilter) return false;
            }

            return true;
        });
    }

    calculateAngleFromGoal(shot) {
        const angle = parseFloat(shot.angle);

        if (isNaN(angle)) {
            console.log('Invalid angle:', shot);
            return null;
        }

        console.log('Shot angle from data:', angle, 'Distance:', shot.distance);

        return angle;
    }

    binShotsByAngle(shots) {
        const bins = [];

        for (let angle = 0; angle < 180; angle += 20) {
            bins.push({
                label: `${angle}°-${angle + 20}°`,
                min: angle,
                max: angle + 20,
                shots: [],
                goals: 0,
                total: 0
            });
        }

        shots.forEach(shot => {
            const angle = this.calculateAngleFromGoal(shot);
            if (angle === null) return;

            for (let bin of bins) {
                if (angle >= bin.min && angle < bin.max) {
                    bin.shots.push(shot);
                    bin.total++;
                    if (shot.result === 'Goal') {
                        bin.goals++;
                    }
                    break;
                }
            }
        });

        bins.forEach(bin => {
            bin.successRate = bin.total > 0 ? bin.goals / bin.total : 0;
        });

        return bins.filter(b => b.total > 0);
    }

    createRadialChart() {
        const container = d3.select('#goalkeeper-radial');
        container.selectAll('*').remove();

        // Title
        container.append('div')
            .style('text-align', 'right')
            .style('font-size', '11px')
            .style('color', '#A0A0A8')
            .style('font-weight', '600')
            .style('margin-bottom', '8px')
            .text('Save Rate by Angle');

        if (!this.currentGameData || this.currentGameData.length === 0) {
            console.log('No game data');
            return;
        }

        const shots = this.getGoalkeeperShots(this.currentGameData, this.selectedGoalkeeper);
        console.log('Goalkeeper shots:', shots.length);

        if (shots.length === 0) {
            container.append('div')
                .style('text-align', 'center')
                .style('color', '#A0A0A8')
                .style('padding', '20px')
                .text('No goalkeeper shots available');
            return;
        }

        const bins = this.binShotsByAngle(shots);
        console.log('Angle bins:', bins);

        const containerRect = container.node().getBoundingClientRect();
        const width = containerRect.width;

        const pngWidth = 155;
        const pngHeight = 124;
        const goalXFromPngLeft = 78;
        const goalYFromPngTop = 104;

        const distanceGoalToPngBottom = pngHeight - goalYFromPngTop;
        const maxRadius = width / 2;
        const height = maxRadius + distanceGoalToPngBottom;

        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height);

        const centerX = width / 2;
        const centerY = height - distanceGoalToPngBottom;

        const pngX = centerX - goalXFromPngLeft;
        const pngY = centerY - goalYFromPngTop;

        svg.append('image')
            .attr('href', 'public/images/goalfield.png')
            .attr('x', pngX)
            .attr('y', pngY)
            .attr('width', pngWidth)
            .attr('height', pngHeight)
            .style('opacity', 0.3);

        const colorScale = d3.scaleLinear()
            .domain([0, 0.3, 0.6])
            .range(['#10B981', '#00D9FF', '#7C3AED'])
            .clamp(true);

        const maxTotal = d3.max(bins, d => d.total) || 1;
        const radiusScale = d3.scaleLinear()
            .domain([0, maxTotal])
            .range([20, maxRadius]);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(d => radiusScale(d.total))
            .startAngle(d => (d.min - 90) * (Math.PI / 180))
            .endAngle(d => (d.max - 90) * (Math.PI / 180));

        svg.selectAll('.arc')
            .data(bins)
            .enter()
            .append('path')
            .attr('class', 'arc')
            .attr('d', arc)
            .attr('transform', `translate(${centerX}, ${centerY})`)
            .attr('fill', d => colorScale(d.successRate))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .style('opacity', 0.85)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .style('opacity', 1)
                    .attr('stroke-width', 2);
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .style('opacity', 0.85)
                    .attr('stroke-width', 1);
            })
            .append('title')
            .text(d => `${d.label}\nShots: ${d.total}\nGoals: ${d.goals}\nSave Pct: ${((1 - d.successRate) * 100).toFixed(1)}%`);

        svg.append('circle')
            .attr('cx', centerX)
            .attr('cy', centerY)
            .attr('r', 4)
            .attr('fill', '#fff')
            .style('opacity', 0.8);
    }
}

window.GoalkeeperRadialChart = GoalkeeperRadialChart;

const goalkeeperRadialChart = new GoalkeeperRadialChart();
