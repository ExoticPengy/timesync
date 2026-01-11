import './style.css';
import { State } from './src/state.js';
import { renderGrid } from './src/components/Grid.js';

const state = new State();

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="container">
    <header>
      <h1>TimeSync</h1>
      <p>Synchronize schedules and find the perfect time for everyone.</p>
    </header>
    
    <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 2rem;">
      <div class="mode-toggle">
        <button id="mode-week" class="mode-btn active">Weekly</button>
        <button id="mode-date" class="mode-btn">Specific Dates</button>
      </div>
      <input type="date" id="start-date" style="display: none;">
    </div>
    


    <div class="main-layout">
      <!-- Selector Column -->
      <section class="glass-card">
        <div class="grid-header">
          <div class="grid-title">Your Availability</div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <div id="person-selector-container"></div>
            <button id="add-person" class="primary" style="padding: 0.5rem 1rem; font-size: 0.8rem;">+ Add</button>
          </div>
        </div>
        <div id="selector-grid"></div>
        <div class="controls" style="justify-content: flex-end;">
          <button id="clear-grid" style="font-size: 0.8rem; padding: 0.5rem 1rem;">Clear Availability</button>
        </div>
      </section>

      <!-- Heatmap Column -->
      <section class="glass-card">
        <div class="grid-header">
          <div class="grid-title">Group Sync Map</div>
          <div id="stats" style="color: var(--text-muted); font-size: 0.9rem;"></div>
        </div>
        <div id="heatmap-grid"></div>
        <div class="controls">
          <p style="color: var(--text-muted); font-size: 0.8rem;">
            Vibrant colors indicate higher availability among participants.
          </p>
        </div>
      </section>
    </div>

    <!-- Recommendations Section -->
    <section class="glass-card" style="margin-top: 2rem;">
      <div class="grid-header">
        <div class="grid-title">🏆 Top Recommended Times</div>
        <div style="display: flex; gap: 1rem; align-items: center;">
            <select id="duration-select" style="padding: 0.25rem 0.5rem; font-size: 0.9rem; width: auto; background-position: right 0.5rem center;">
                ${[1, 2, 3, 4, 5, 6, 7, 8].map(h => `<option value="${h}">Duration: ${h}h</option>`).join('')}
            </select>
        </div>
      </div>
      <div id="recommended-container"></div>
    </section>
  </div>
`;

function updateUI() {
  // Render Person Selector
  const selectorContainer = document.querySelector('#person-selector-container');
  // Remove inline styles to use CSS class
  selectorContainer.innerHTML = `
    <select id="person-select">
      ${state.people.map(p => `<option value="${p.id}" ${p.id === state.activePersonId ? 'selected' : ''}>${p.name}</option>`).join('')}
    </select>
  `;

  document.querySelector('#person-select').addEventListener('change', (e) => {
    state.switchPerson(e.target.value);
  });

  // Render Stats
  document.querySelector('#stats').textContent = `${state.people.length} Participant${state.people.length > 1 ? 's' : ''}`;

  // Render Date Controls
  const modeWeekBtn = document.querySelector('#mode-week');
  const modeDateBtn = document.querySelector('#mode-date');
  const dateInput = document.querySelector('#start-date');

  if (state.mode === 'week') {
    modeWeekBtn.classList.add('active');
    modeDateBtn.classList.remove('active');
    dateInput.style.display = 'none';
  } else {
    modeWeekBtn.classList.remove('active');
    modeDateBtn.classList.add('active');
    dateInput.style.display = 'block';
    dateInput.value = state.startDate.toISOString().split('T')[0];
  }

  // Render Grids
  renderGrid(document.querySelector('#selector-grid'), state, false);
  renderGrid(document.querySelector('#heatmap-grid'), state, true);

  // Render Recommendations
  renderRecommendations();

  // Update duration selector if needed (to keep sync if re-rendered entire app)
  const durationSelect = document.querySelector('#duration-select');
  if (durationSelect) durationSelect.value = state.duration;
}

function renderRecommendations() {
  const container = document.querySelector('#recommended-container');
  const heatData = state.getHeatmapData();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Function to get max availability in a window
  // We want to find windows where the MINIMUM availability across the duration is maximized.
  // usage: checks window [h, h+duration)
  const getWindowMin = (dayDensity, startHour, duration) => {
    if (startHour + duration > 24) return 0;
    let min = Infinity;
    for (let i = 0; i < duration; i++) {
      min = Math.min(min, dayDensity[startHour + i]);
    }
    return min;
  };

  const slots = [];
  heatData.density.forEach((day, dIdx) => {
    // Iterate up to 24 - duration
    for (let hIdx = 0; hIdx <= 24 - state.duration; hIdx++) {
      const count = getWindowMin(day, hIdx, state.duration);
      if (count > 0) {
        slots.push({ day: days[dIdx], hour: hIdx, count });
      }
    }
  });

  // Sort by count descending, then by day/hour
  slots.sort((a, b) => b.count - a.count || a.hour - b.hour);

  const topThree = slots.slice(0, 3);

  if (topThree.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No times selected yet. Start marking your availability!</p>`;
    return;
  }

  container.innerHTML = `
    <div class="recommended-list">
      ${topThree.map((slot, i) => {
    const endHour = slot.hour + state.duration;
    return `
        <div class="recommended-item">
          <span class="recommended-rank">#${i + 1}</span>
          <span class="recommended-time">${slot.day} ${slot.hour}:00 - ${endHour}:00</span>
          <span class="recommended-count">${slot.count} / ${state.people.length} People</span>
        </div>
      `}).join('')}
    </div>
  `;
}

function setupEventHandlers() {
  document.querySelector('#add-person').addEventListener('click', () => {
    state.addPerson();
  });

  document.querySelector('#clear-grid').addEventListener('click', () => {
    state.clearActive();
  });

  document.querySelector('#mode-week').addEventListener('click', () => {
    state.setMode('week');
  });

  document.querySelector('#mode-date').addEventListener('click', () => {
    state.setMode('date');
  });

  document.querySelector('#start-date').addEventListener('change', (e) => {
    state.setStartDate(e.target.value);
  });

  document.querySelector('#duration-select').addEventListener('change', (e) => {
    state.setDuration(e.target.value);
  });
}

// Move event listeners out of updateUI
setupEventHandlers();
state.onUpdate = updateUI;
updateUI();
