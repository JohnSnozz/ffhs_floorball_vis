class XGOverview {
    constructor(app) {
        this.app = app;
        this.allShots = [];
    }

    async initialize() {
        console.log('xG Overview initialized');
        await this.loadAllShots();
        this.createFields();
        this.createLegend();
    }

    async loadAllShots() {
        try {
            // Load all shots from all games using shots_view
            const result = this.app.dbManager.db.exec('SELECT * FROM shots_view');

            if (result.length > 0 && result[0].values) {
                const columns = result[0].columns;
                this.allShots = result[0].values
                    .map(row => {
                        const shot = {};
                        columns.forEach((col, index) => {
                            shot[col] = row[index];
                        });
                        return shot;
                    })
                    .filter(shot => {
                        // Exclude turnover markers that are not actual shots
                        // These have "possession" in the result field (e.g., "possession -")
                        const result = shot.result;
                        if (!result) return false;

                        // Filter out any entries with "possession" in the result
                        return !result.toLowerCase().includes('possession');
                    });
                console.log(`Loaded ${this.allShots.length} shots from all games`);
            }
        } catch (error) {
            console.error('Error loading shots:', error);
        }
    }

    createFields() {
        // Create 5 fields with filtered shots
        const shotTypes = [
            { id: 1, type: 'Direct', turnover: false },
            { id: 2, type: 'One-timer', turnover: false },
            { id: 3, type: 'Direct', turnover: true },
            { id: 4, type: 'One-timer', turnover: true },
            { id: 5, type: 'Rebound', turnover: false }
        ];

        shotTypes.forEach(config => {
            const filteredShots = this.filterShotsByType(config.type, config.turnover);
            this.createSingleField(`xg-field-${config.id}`, filteredShots);
        });
    }

    filterShotsByType(type, isTurnover) {
        return this.allShots.filter(shot => {
            const shotType = shot.type;

            if (isTurnover) {
                // Turnovers have type formatted as "Turnover | Direct" or "Turnover | One-timer"
                const turnoverType = `Turnover | ${type}`;
                return shotType === turnoverType;
            } else {
                // Regular shots should NOT contain "Turnover |"
                return shotType === type && !shotType?.includes('Turnover |');
            }
        });
    }

    createSingleField(containerId, shots) {
        const container = d3.select(`#${containerId}`);
        container.selectAll('*').remove();

        const containerElement = document.getElementById(containerId);
        if (!containerElement) return;

        const containerRect = containerElement.getBoundingClientRect();

        // Calculate dimensions - field aspect ratio is 1:2 (width:height)
        const aspectRatio = 2;

        // Calculate size based on available container space
        let fieldWidth, fieldHeight;

        // Try to fit by height first
        fieldHeight = containerRect.height;
        fieldWidth = fieldHeight / aspectRatio;

        // If width is too large, fit by width instead
        if (fieldWidth > containerRect.width) {
            fieldWidth = containerRect.width;
            fieldHeight = fieldWidth * aspectRatio;
        }

        const svg = container
            .append('svg')
            .attr('viewBox', `0 0 ${fieldWidth} ${fieldHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('height', '100%')
            .style('max-width', `${fieldWidth}px`)
            .style('max-height', `${fieldHeight}px`);

        // Add field background image
        svg.append('image')
            .attr('href', 'public/images/field.png')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', fieldWidth)
            .attr('height', fieldHeight)
            .style('opacity', 0.9);

        // Add shots as points
        if (shots && shots.length > 0) {
            this.drawShots(svg, shots, fieldWidth, fieldHeight);
        }
    }

    drawShots(svg, shots, fieldWidth, fieldHeight) {
        // Original field dimensions
        const originalWidth = 600;
        const originalHeight = 1200;

        // Scale factors
        const scaleX = fieldWidth / originalWidth;
        const scaleY = fieldHeight / originalHeight;

        // Color scale for xG values (0 to 0.6) - Blue (low) to Red to Yellow to Green (high)
        const colorScale = d3.scaleLinear()
            .domain([0, 0.2, 0.4, 0.6])
            .range(['#0000ff', '#ff0000', '#ffff00', '#00ff00'])
            .clamp(true);

        // Process shots - all point towards goal at top (y=0)
        const processedShots = shots
            .filter(shot => {
                const x = parseFloat(shot.x_graph);
                const y = parseFloat(shot.y_graph);
                return !isNaN(x) && !isNaN(y);
            })
            .map(shot => {
                const x = parseFloat(shot.x_graph);
                const y = parseFloat(shot.y_graph);
                const xg = parseFloat(shot.xg) || 0;

                // No mirroring - all shots point towards goal at top
                // Just scale the coordinates
                return {
                    x: x * scaleX,
                    y: y * scaleY,
                    xg: xg,
                    ...shot
                };
            });

        console.log(`Drawing ${processedShots.length} shots`);
        console.log('Field dimensions:', fieldWidth, fieldHeight);
        console.log('Scale factors:', scaleX, scaleY);

        if (processedShots.length === 0) {
            console.warn('No shots to draw');
            return;
        }

        // Create Voronoi diagram
        // Define boundaries - exclude areas behind both goals
        // Original coordinates: top goal at y=0, bottom goal at y=1200
        // Exclude: y < 80 (behind top goal) and y > 1120 (behind bottom goal)
        const topGoalLimit = 80 * scaleY; // Behind top goal
        const bottomGoalLimit = 1120 * scaleY; // Behind bottom goal (1200 - 80)

        console.log('Voronoi bounds - top limit:', topGoalLimit, 'bottom limit:', bottomGoalLimit);

        // Create Delaunay triangulation (D3 v7)
        const delaunay = d3.Delaunay.from(
            processedShots,
            d => d.x,
            d => d.y
        );

        // Create Voronoi diagram from Delaunay - full field bounds
        const voronoi = delaunay.voronoi([0, 0, fieldWidth, fieldHeight]);
        console.log('Voronoi diagram created');

        // Create unique clip path ID
        const clipId = `voronoi-clip-${Math.random().toString(36).substr(2, 9)}`;

        // Create clip path to exclude behind-goal areas (top and bottom)
        svg.append('defs')
            .append('clipPath')
            .attr('id', clipId)
            .append('rect')
            .attr('x', 0)
            .attr('y', topGoalLimit)
            .attr('width', fieldWidth)
            .attr('height', bottomGoalLimit - topGoalLimit);

        // Create tooltip
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'xg-voronoi-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'rgba(0, 0, 0, 0.85)')
            .style('color', '#fff')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('font-size', '13px')
            .style('font-weight', '500')
            .style('pointer-events', 'none')
            .style('z-index', '10000')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.3)');

        // Draw Voronoi cells
        const voronoiGroup = svg.append('g')
            .attr('class', 'voronoi-layer')
            .attr('clip-path', `url(#${clipId})`);

        voronoiGroup.selectAll('.voronoi-cell')
            .data(processedShots)
            .enter()
            .append('path')
            .attr('class', 'voronoi-cell')
            .attr('d', (d, i) => voronoi.renderCell(i))
            .attr('fill', d => colorScale(d.xg))
            .attr('opacity', 0.7)
            .attr('stroke', 'none')
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('opacity', 0.9)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 2);

                tooltip
                    .style('visibility', 'visible')
                    .text(`xG: ${d.xg.toFixed(3)}`);
            })
            .on('mousemove', function(event) {
                tooltip
                    .style('top', (event.pageY - 35) + 'px')
                    .style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('opacity', 0.7)
                    .attr('stroke', 'none');

                tooltip.style('visibility', 'hidden');
            });
    }

    createLegend() {
        const legendContainer = d3.select('#xg-legend-gradient');
        legendContainer.selectAll('*').remove();

        const width = 400;
        const height = 20;

        const svg = legendContainer
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Create gradient definition
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'xg-color-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%')
            .attr('y1', '0%')
            .attr('y2', '0%');

        // Add color stops matching the scale
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#0000ff'); // Blue at 0.0

        gradient.append('stop')
            .attr('offset', '33.33%')
            .attr('stop-color', '#ff0000'); // Red at 0.2

        gradient.append('stop')
            .attr('offset', '66.67%')
            .attr('stop-color', '#ffff00'); // Yellow at 0.4

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#00ff00'); // Green at 0.6

        // Draw the gradient rectangle
        svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'url(#xg-color-gradient)')
            .attr('rx', 4);
    }

    async loadData() {
        console.log('Loading xG Overview data');
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.XGOverview = XGOverview;
}
