import './style.css';
import { configured } from './src/db.js';
import { renderHome } from './src/views/home.js';
import { renderSync } from './src/views/sync.js';

const app = document.querySelector('#app');
let cleanup = null;

function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  app.innerHTML = '';

  if (!configured) {
    app.innerHTML = `
      <div class="app-header"><h1>TimeSync</h1></div>
      <div class="card">
        <p>Firebase is not configured.</p>
        <p class="muted">Copy <code>.env.example</code> to <code>.env</code>, fill in your
        Firebase web config, and restart the dev server. See README for setup.</p>
      </div>`;
    return;
  }

  const m = location.hash.match(/^#\/s\/([^/]+)/);
  cleanup = m ? renderSync(app, m[1]) : renderHome(app);
}

window.addEventListener('hashchange', route);
route();
