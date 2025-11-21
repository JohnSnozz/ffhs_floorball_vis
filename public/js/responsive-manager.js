/**
 * Responsive Manager for Floorball Dashboard
 * Handles scaling of the dashboard and triggers position recalculation
 */

class ResponsiveManager {
    constructor() {
        this.baseWidth = 1920;
        this.baseHeight = 1080;
        this.currentScale = 1;
        this.scaledWidth = 1920;
        this.scaledHeight = 1080;
        this.enabled = true;
        this.initialized = false;

        // Check for disable flag
        if (window.location.search.includes('noscale')) {
            console.log('Responsive scaling disabled via URL parameter');
            this.enabled = false;
            return;
        }

        this.init();
    }

    init() {
        // Wait for DOM and app to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.waitForApp());
        } else {
            this.waitForApp();
        }
    }

    waitForApp() {
        // Wait for the app to be fully initialized
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait

        const checkApp = () => {
            attempts++;

            // Check if essential elements and libraries exist
            const container = document.querySelector('.container');
            const dashboardMain = document.querySelector('.dashboard-main');
            const d3Available = typeof d3 !== 'undefined' && d3.version;
            const appAvailable = window.app || window.floorballApp;

            if (container && dashboardMain && appAvailable && d3Available) {
                console.log('App ready, initializing responsive manager');
                this.setup();
            } else if (attempts < maxAttempts) {
                const missing = [];
                if (!container) missing.push('container');
                if (!dashboardMain) missing.push('dashboard-main');
                if (!appAvailable) missing.push('app');
                if (!d3Available) missing.push('D3.js');

                console.log(`Waiting for: ${missing.join(', ')} (attempt ${attempts})`);
                setTimeout(checkApp, 100);
            } else {
                console.error('Failed to initialize responsive manager - missing:', {
                    container: !!container,
                    dashboardMain: !!dashboardMain,
                    app: !!appAvailable,
                    d3: d3Available
                });
                // Try to setup anyway
                this.setup();
            }
        };

        checkApp();
    }

    setup() {
        try {
            console.log('Responsive Manager initializing...');
            this.initialized = true;

            // Add keyboard shortcut to toggle scaling (Ctrl+Shift+R)
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                    e.preventDefault();
                    this.toggleScaling();
                }
            });

            // Apply initial scaling
            this.calculateAndApplyScale();

            // Listen for window resize
            window.addEventListener('resize', () => this.handleResize());

            // Override the dashboard rect calculation
            this.patchDashboardCalculations();

            console.log('Responsive Manager ready');
            console.log('Press Ctrl+Shift+R to toggle scaling on/off');
        } catch (error) {
            console.error('Error in responsive manager setup:', error);
            this.reset();
        }
    }

    calculateAndApplyScale() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate scale to fit viewport
        const scaleX = viewportWidth / this.baseWidth;
        const scaleY = viewportHeight / this.baseHeight;

        // Use smaller scale to ensure everything fits
        this.currentScale = Math.min(scaleX, scaleY);

        // Apply limits
        const minScale = 0.4;
        const maxScale = 2;
        this.currentScale = Math.max(minScale, Math.min(maxScale, this.currentScale));

        // Calculate scaled dimensions
        this.scaledWidth = this.baseWidth * this.currentScale;
        this.scaledHeight = this.baseHeight * this.currentScale;

        // Apply scaling to container
        this.applyScale();

        // Trigger visualization updates
        this.updateVisualizations();
    }

    applyScale() {
        const container = document.querySelector('.container');
        if (!container) {
            console.error('Container not found, cannot apply scale');
            return;
        }

        // Check if dashboard content exists
        const dashboardMain = document.querySelector('.dashboard-main');
        if (!dashboardMain) {
            console.warn('Dashboard main not found, scaling may not work correctly');
        }

        try {
            // Apply CSS transform scale
            container.style.transform = `scale(${this.currentScale})`;
            container.style.transformOrigin = 'top left';

            // Adjust body to center the scaled container
            document.body.style.justifyContent = 'flex-start';
            document.body.style.alignItems = 'flex-start';

            // Calculate centering offset
            const leftOffset = (window.innerWidth - this.scaledWidth) / 2;
            const topOffset = (window.innerHeight - this.scaledHeight) / 2;

            container.style.position = 'absolute';
            container.style.left = `${Math.max(0, leftOffset)}px`;
            container.style.top = `${Math.max(0, topOffset)}px`;

            // Ensure container is visible
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';

            console.log(`Applied scale: ${(this.currentScale * 100).toFixed(1)}%, container positioned at (${Math.max(0, leftOffset)}, ${Math.max(0, topOffset)})`);
        } catch (error) {
            console.error('Error applying scale:', error);
        }
    }

    patchDashboardCalculations() {
        // Store reference to scale for use in calculations
        window.dashboardScale = this.currentScale;

        // Only patch if not already patched
        if (this._patched) {
            return;
        }

        try {
            // Store the original getBoundingClientRect
            const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

            // Override for dashboard-main to return unscaled dimensions
            const self = this;
            Element.prototype.getBoundingClientRect = function() {
                const rect = originalGetBoundingClientRect.call(this);

                // Only adjust for elements inside the scaled container
                // Skip if this is called during D3 initialization
                if (this && this.closest && this.closest('.container') && self.currentScale !== 1) {
                    const scale = self.currentScale;
                    return {
                        width: rect.width / scale,
                        height: rect.height / scale,
                        top: rect.top / scale,
                        left: rect.left / scale,
                        right: rect.right / scale,
                        bottom: rect.bottom / scale,
                        x: rect.x / scale,
                        y: rect.y / scale
                    };
                }

                return rect;
            };

            this._patched = true;
        } catch (error) {
            console.error('Failed to patch getBoundingClientRect:', error);
        }
    }

    updateVisualizations() {
        // Wait for app to be available
        setTimeout(() => {
            // Only try to update shot map if we're on a page that has one
            // Check if shot map container exists before trying to update
            const shotMapContainer = document.querySelector('.shot-map-container, #shot-map');
            if (shotMapContainer && window.app && window.app.shotMap) {
                try {
                    // Trigger the shot map's update
                    window.app.shotMap.updateVisualization();
                } catch (e) {
                    // Silently fail if shot map update fails
                }
            }

            // Trigger resize event for D3 components
            window.dispatchEvent(new Event('resize'));

            // Trigger filter update if sidebar exists
            if (window.app && window.app.applyFilters) {
                try {
                    window.app.applyFilters();
                } catch (e) {
                    // Silently fail if filters not ready
                }
            }
        }, 200);
    }

    handleResize() {
        // Debounce resize
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.calculateAndApplyScale();
        }, 150);
    }

    // Public API
    getScale() {
        return this.currentScale;
    }

    forceUpdate() {
        this.calculateAndApplyScale();
    }

    toggleScaling() {
        this.enabled = !this.enabled;
        console.log(`Scaling ${this.enabled ? 'ENABLED' : 'DISABLED'}`);

        if (this.enabled) {
            this.calculateAndApplyScale();
        } else {
            this.reset();
        }
    }

    reset() {
        console.log('Resetting to default scale');
        const container = document.querySelector('.container');
        if (container) {
            container.style.transform = 'none';
            container.style.position = 'static';
            container.style.left = 'auto';
            container.style.top = 'auto';
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
        }

        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'center';

        this.currentScale = 1;
        window.dashboardScale = 1;
    }

    // Debug info
    getDebugInfo() {
        const container = document.querySelector('.container');
        const dashboardMain = document.querySelector('.dashboard-main');

        return {
            enabled: this.enabled,
            initialized: this.initialized,
            currentScale: this.currentScale,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            containerFound: !!container,
            dashboardMainFound: !!dashboardMain,
            containerStyles: container ? {
                transform: container.style.transform,
                position: container.style.position,
                left: container.style.left,
                top: container.style.top,
                display: container.style.display || 'block',
                visibility: container.style.visibility || 'visible'
            } : null
        };
    }
}

// Initialize the responsive manager
window.ResponsiveManager = new ResponsiveManager();

// Also make it available globally for debugging
window.responsiveManager = window.ResponsiveManager;

// Add console helper
console.log('Responsive Manager loaded. Debug commands:');
console.log('  responsiveManager.getDebugInfo() - Show current state');
console.log('  responsiveManager.reset() - Reset to default scale');
console.log('  responsiveManager.toggleScaling() - Enable/disable scaling');
console.log('  responsiveManager.forceUpdate() - Force recalculation');
console.log('Press Ctrl+Shift+R to toggle scaling on/off');