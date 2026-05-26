# TimeSync

A scheduling coordination tool to find the best meeting time across multiple people. Each person marks their availability on a 7-day × 24-hour grid — the group heatmap and smart recommendations do the rest.

## Features

- **Multi-person availability grids** — Each person independently marks free hours
- **Drag-to-select** — Click and drag across the grid to quickly block out availability
- **Heatmap overlay** — Visualizes cumulative availability across the entire group
- **Smart recommendations** — Top 3 meeting slots ranked by maximum participation for your chosen duration
- **Two modes** — Weekly recurring schedule or specific date range
- **Dark glassmorphism theme** — Polished UI with backdrop blur and animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES modules) |
| Build | Vite |
| Styling | Custom CSS (glassmorphism, dark theme) |
| Architecture | State-driven UI with observer callback pattern |

## Setup

```bash
npm install
npm run dev      # Vite dev server
npm run build    # Production build to dist/
```

No backend — all state lives in memory. Share the URL with your group to coordinate.

## How It Works

1. Each person opens the app and marks their availability by clicking/dragging on the grid
2. Switch between people using the person selector; add more with "+ Add Person"
3. The heatmap updates in real-time showing where schedules overlap
4. Set a meeting duration (1-8 hours) to get the top 3 recommended slots
