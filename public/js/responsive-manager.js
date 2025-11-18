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

        this.init();
    }

    init() {
        // Wait for DOM and app to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            // Give app time to initialize
            setTimeout(() => this.setup(), 100);
        }
    }

    setup() {
        console.log('Responsive Manager initializing...');

        // Apply initial scaling
        this.calculateAndApplyScale();

        // Listen for window resize
        window.addEventListener('resize', () => this.handleResize());

        // Override the dashboard rect calculation
        this.patchDashboardCalculations();

        console.log('Responsive Manager ready');
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
        if (!container) return;

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

        console.log(`Applied scale: ${(this.currentScale * 100).toFixed(1)}%`);
    }

    patchDashboardCalculations() {
        // Store reference to scale for use in calculations
        window.dashboardScale = this.currentScale;

        // Store the original getBoundingClientRect
        const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

        // Override for dashboard-main to return unscaled dimensions
        const self = this;
        Element.prototype.getBoundingClientRect = function() {
            const rect = originalGetBoundingClientRect.call(this);

            // For elements inside the scaled container, return unscaled dimensions
            if (this.closest('.container')) {
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
    }

    updateVisualizations() {
        // Wait for app to be available
        setTimeout(() => {
            // Force shot map to recalculate if it exists
            if (window.app && window.app.shotMap) {
                try {
                    // Trigger the shot map's update
                    window.app.shotMap.updateVisualization();
                } catch (e) {
                    console.log('Shot map not ready yet');
                }
            }

            // Trigger resize event for D3 components
            window.dispatchEvent(new Event('resize'));

            // Trigger filter update if sidebar exists
            if (window.app && window.app.applyFilters) {
                try {
                    window.app.applyFilters();
                } catch (e) {
                    console.log('Filters not ready yet');
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
}

// Initialize the responsive manager
window.ResponsiveManager = new ResponsiveManager();

// Also make it available globally for debugging
window.responsiveManager = window.ResponsiveManager;