/**
 * D3.js Loading Check
 * Ensures D3 is loaded before other scripts try to use it
 */

(function() {
    'use strict';

    // Check if D3 is loaded
    function checkD3() {
        if (typeof d3 === 'undefined' || !d3 || !d3.version) {
            console.error('D3.js is not loaded or incomplete! Attempting to reload...');

            // Try to reload D3
            const script = document.createElement('script');
            script.src = 'https://d3js.org/d3.v7.min.js';
            script.onload = function() {
                if (typeof d3 !== 'undefined' && d3.version) {
                    console.log('D3.js v' + d3.version + ' reloaded successfully');
                    window.dispatchEvent(new Event('d3-ready'));
                } else {
                    console.error('D3 still not available after reload');
                }
            };
            script.onerror = function() {
                console.error('Failed to load D3.js from CDN, trying alternate...');

                // Try alternate CDN
                const altScript = document.createElement('script');
                altScript.src = 'https://unpkg.com/d3@7/dist/d3.min.js';
                altScript.onload = function() {
                    if (typeof d3 !== 'undefined' && d3.version) {
                        console.log('D3.js v' + d3.version + ' loaded from alternate CDN');
                        window.dispatchEvent(new Event('d3-ready'));
                    }
                };
                altScript.onerror = function() {
                    console.error('Failed to load D3 from all CDNs');
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