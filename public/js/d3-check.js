/**
 * D3.js Loading Check
 * Ensures D3 is loaded before other scripts try to use it
 */

(function() {
    'use strict';

    // Check if D3 is loaded
    function checkD3() {
        if (typeof d3 === 'undefined') {
            console.error('D3.js is not loaded! Attempting to reload...');

            // Try to reload D3
            const script = document.createElement('script');
            script.src = 'https://d3js.org/d3.v7.min.js';
            script.onload = function() {
                console.log('D3.js reloaded successfully');

                // Dispatch event to notify that D3 is ready
                window.dispatchEvent(new Event('d3-ready'));
            };
            script.onerror = function() {
                console.error('Failed to load D3.js from CDN');

                // Try alternate CDN
                const altScript = document.createElement('script');
                altScript.src = 'https://unpkg.com/d3@7/dist/d3.min.js';
                altScript.onload = function() {
                    console.log('D3.js loaded from alternate CDN');
                    window.dispatchEvent(new Event('d3-ready'));
                };
                document.head.appendChild(altScript);
            };
            document.head.appendChild(script);

            return false;
        }

        console.log('D3.js version ' + d3.version + ' loaded successfully');
        return true;
    }

    // Check immediately
    const d3Loaded = checkD3();

    // Store the result
    window.d3Loaded = d3Loaded;

    // If D3 is already loaded, dispatch the ready event
    if (d3Loaded) {
        // Use setTimeout to ensure other scripts have loaded
        setTimeout(() => {
            window.dispatchEvent(new Event('d3-ready'));
        }, 0);
    }

    // Double-check after a delay
    setTimeout(() => {
        if (typeof d3 === 'undefined') {
            console.error('D3.js still not available after delay');
            checkD3();
        }
    }, 1000);
})();