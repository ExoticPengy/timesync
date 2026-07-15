<h1 align="center">📅 TimeSync</h1>
<h3 align="center"><em>Find the one time everyone's actually free.</em></h3>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge&logo=javascript" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/build-Vite-646CFF?style=for-the-badge&logo=vite" alt="Vite"/>
  <img src="https://img.shields.io/badge/style-Glassmorphism-8B5CF6?style=for-the-badge&logo=css3" alt="CSS"/>
</p>

---

## 📖 About The Project

Scheduling a meeting across a group is a chore — **TimeSync** makes it visual. Each person marks the hours they're available on a simple 7-day × 24-hour grid, and the app overlays everyone's input into a heatmap so the best slots jump right out. No more endless "does Tuesday work for you?" threads.

Built with vanilla JavaScript (ES modules) and Vite, backed by Firebase Realtime Database for live shared syncs.

---

## ✨ Features

|  | Feature | Description |
|--|---------|-------------|
| 👥 | **Per-Person Grids** | Each participant joins by name via a shared link and marks their own hours. |
| 🖱️ | **Drag-to-Select** | Click and drag across the grid to block out availability fast. |
| 🔥 | **Group Heatmap** | A live overlay showing cumulative availability across everyone. |
| 🏆 | **Smart Recommendations** | Top 3 meeting slots ranked by how many people can make it. |
| ⏱️ | **Adjustable Duration** | Pick a 1–8 hour meeting length to tune the recommendations. |
| 🗓️ | **Two Modes** | Weekly recurring (Mon–Sun) or one calendar month, chosen at creation — weekly syncs also choose week-grid or day-by-day layout. |

---

## 🧭 How It Works

```
  1. Each person opens the app and drags on the grid to mark free hours
                              │
                              ▼
  2. Share the sync link · each person joins by entering their name
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
├── index.html              # App shell
├── main.js                 # Hash router + boot
├── style.css               # Utility-tool visual system
├── src/
│   ├── logic.js            # Pure: grid codec, density, recommendations
│   ├── db.js               # Firebase RTDB (createSync/subscribeSync/saveGrid)
│   ├── views/
│   │   ├── home.js         # Sync creation form
│   │   └── sync.js         # Join gate, grids, heatmap, recommendations
│   └── components/
│       └── grid.js         # Grid renderer (week/day) + pointer painting
└── test/
    └── logic.test.js       # node assert tests
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

Syncs are stored in Firebase Realtime Database — set it up below, then share sync links with your group.

---

## 🔧 Firebase Setup

TimeSync stores syncs in a Firebase Realtime Database.

1. Create a project at https://console.firebase.google.com (free Spark plan)
2. Build → Realtime Database → Create database (locked mode)
3. Rules tab → paste and publish:

   ```json
   {
     "rules": {
       "syncs": {
         "$id": {
           ".read": true,
           ".write": true,
           "name": { ".validate": "newData.isString() && newData.val().length <= 100" },
           "people": {
             "$person": { ".validate": "newData.isString() && newData.val().length <= 800" }
           }
         }
       }
     }
   }
   ```

4. Project settings → General → Add a Web app → copy the config values
5. `cp .env.example .env` and fill in the values

Note: anyone with a sync link can read and edit that sync — by design
(no accounts, honor system). The web config values are public identifiers,
not secrets; security rules are the enforcement layer.

---

## 📝 License

Open project — free to use and learn from.
