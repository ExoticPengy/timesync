export function renderGrid(container, state, isHeatmap = false) {
    let days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    if (state.mode === 'date') {
        days = [];
        const curr = new Date(state.startDate);
        for (let i = 0; i < 7; i++) {
            days.push(curr.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }));
            curr.setDate(curr.getDate() + 1);
        }
    }

    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'grid';

    // Column Headers (Hours)
    grid.appendChild(document.createElement('div')); // Empty corner
    for (let h = 0; h < 24; h++) {
        const hourLabel = document.createElement('div');
        hourLabel.className = 'hour-label';
        hourLabel.textContent = `${h}:00`;
        grid.appendChild(hourLabel);
    }

    let isDragging = false;
    let dragType = true;

    // Rows (Days)
    days.forEach((day, d) => {
        // Row Header (Day Label)
        const dayLabel = document.createElement('div');
        dayLabel.className = 'day-label';
        dayLabel.textContent = day;
        grid.appendChild(dayLabel);

        // Cells for this day
        for (let h = 0; h < 24; h++) {
            const cell = document.createElement('div');
            cell.className = 'cell';

            if (isHeatmap) {
                cell.classList.add('heatmap');
                const heatData = state.getHeatmapData();
                const value = heatData.density[d][h];
                const intensity = heatData.max > 0 ? value / heatData.max : 0;

                if (value > 0) {
                    cell.style.background = `rgba(99, 102, 241, ${0.1 + intensity * 0.9})`;
                    cell.style.boxShadow = intensity > 0.5 ? `0 0 10px rgba(99, 102, 241, ${intensity * 0.5})` : 'none';
                }
                cell.addEventListener('mouseenter', (e) => showTooltip(e, `${value} / ${heatData.max} available`));
                cell.addEventListener('mouseleave', hideTooltip);
            } else {
                // Use state.activeGrid[d][h] for checking selection
                if (state.activeGrid[d][h]) {
                    cell.classList.add('selected');
                }

                cell.addEventListener('mousedown', () => {
                    isDragging = true;
                    dragType = !state.activeGrid[d][h];
                    toggle(d, h, dragType);
                });

                cell.addEventListener('mouseenter', () => {
                    if (isDragging) {
                        toggle(d, h, dragType);
                    }
                });
            }
            grid.appendChild(cell);
        }
    });

    container.appendChild(grid);

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    function toggle(d, h, force) {
        if (state.activeGrid[d][h] !== force) {
            state.toggleSlot(d, h);
        }
    }
}

let tooltip = null;
function showTooltip(e, text) {
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        document.body.appendChild(tooltip);
    }
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
}

function hideTooltip() {
    if (tooltip) tooltip.style.display = 'none';
}
