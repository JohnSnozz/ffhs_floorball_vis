// Generate grid cells dynamically
const gridOverlay = document.querySelector('.dev-grid-overlay');
const rows = 10;
const cols = 15;
const letters = 'ABCDEFGHIJ';
for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
        const cell = document.createElement('div');
        cell.className = 'dev-grid-cell';
        if (i === 9) {
            cell.classList.add('half-height');
        }
        cell.dataset.cell = `${letters[i]}${j + 1}`;
        cell.innerHTML = `<span>${letters[i]}${j + 1}</span>`;
        gridOverlay.appendChild(cell);
    }
}

// Toggle dev grid
document.getElementById('toggle-dev-grid').addEventListener('click', function() {
    gridOverlay.classList.toggle('hidden');
});

// Toggle containers dev
document.getElementById('toggle-containers-dev').addEventListener('click', function() {
    document.body.classList.toggle('dev-containers-visible');
});
