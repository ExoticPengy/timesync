<h1 align="center">📅 TimeSync</h1>
<h3 align="center"><em>Find the one time everyone's actually free.</em></h3>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge&logo=javascript" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/build-Vite-646CFF?style=for-the-badge&logo=vite" alt="Vite"/>
  <img src="https://img.shields.io/badge/style-Glassmorphism-8B5CF6?style=for-the-badge&logo=css3" alt="CSS"/>
  <img src="https://img.shields.io/badge/backend-none-555555?style=for-the-badge" alt="No backend"/>
</p>

---

## 📖 About The Project

Scheduling a meeting across a group is a chore — **TimeSync** makes it visual. Each person marks the hours they're available on a simple 7-day × 24-hour grid, and the app overlays everyone's input into a heatmap so the best slots jump right out. No more endless "does Tuesday work for you?" threads.

It's built with **vanilla JavaScript** (ES modules) and **Vite** — no framework, no backend. State lives entirely in the browser, driven by a small observer/callback pattern, with a polished dark **glassmorphism** UI.

---

## ✨ Features

|  | Feature | Description |
|--|---------|-------------|
| 👥 | **Per-Person Grids** | Each participant independently marks their free hours. |
| 🖱️ | **Drag-to-Select** | Click and drag across the grid to block out availability fast. |
| 🔥 | **Group Heatmap** | A live overlay showing cumulative availability across everyone. |
| 🏆 | **Smart Recommendations** | Top 3 meeting slots ranked by how many people can make it. |
| ⏱️ | **Adjustable Duration** | Pick a 1–8 hour meeting length to tune the recommendations. |
| 🗓️ | **Two Modes** | Weekly recurring schedule, or a specific date range. |
| 🌙 | **Glassmorphism UI** | Dark theme with backdrop blur and smooth animations. |

---

## 🧭 How It Works

```
  1. Each person opens the app and drags on the grid to mark free hours
                              │
                              ▼
  2. Switch people with the selector · "+ Add Person" for more
                              │
                              ▼
  3. The HEATMAP updates live, showing where schedules overlap
                              │
                              ▼
  4. Set a meeting duration → get the TOP 3 recommended slots
```

---

## 🛠️ Technology Stack

| Category | Technology | Purpose |
|:---------|:-----------|:--------|
| **Frontend** | Vanilla JavaScript (ES modules) | UI logic, no framework |
| **Build** | Vite | Dev server + production bundling |
| **Styling** | Custom CSS | Glassmorphism, dark theme, animations |
| **Architecture** | State-driven UI | Central `State` with observer callbacks |

---

## 📂 Project Structure

```
timesync/
├── index.html                  # App shell
├── main.js                     # Entry — wires State + Grid, renders UI
├── style.css                   # Glassmorphism dark theme
└── src/
    ├── state.js                # Central state + observer callbacks
    └── components/
        └── Grid.js             # Availability grid rendering & interaction
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ExoticPengy/timesync.git
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run**

   ```bash
   npm run dev      # Vite dev server
   npm run build    # production build to dist/
   ```

No backend — all state lives in memory. Share the URL with your group to coordinate.

---

## 📝 License

Open project — free to use and learn from.
