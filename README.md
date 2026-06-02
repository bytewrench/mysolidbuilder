# MySolidBuilder 3D Web Editor

> A next-generation, high-fidelity web-based 3D modeling application inspired by SketchUp and MySolidBuilder. Built with **React**, **TypeScript**, and **Three.js (WebGL)**.

---

## 🚀 Key Features

* **Advanced 3D Viewport**: High-performance WebGL scene rendering with fog depth, ambient and directional soft shadows, grid helpers, and standard coordinate axes.
* **SketchUp-Style Push-Pull (Extrude)**: Interactive face extrusion using mouse vector projections and dot-product offsets. Scaled geometries dynamically shift position vectors to anchor the opposite face in place.
* **Real-time Value Control Box (VCB) HUD**: Live coordinate viewer, extrusion depth tracker, and 3D mesh volume calculator that updates dynamically as you drag gizmos or scale meshes.
* **Interactive Guided Tutorial ("Help Me")**: Floating instructional cards coupled with pulsating neon buttons, cursor highlighting, and fade-out cyan selection glows.
* **Full Transform Controls**: Precise handles for translating, rotating, and scaling meshes along X, Y, and Z axes, with configurable grid snapping increments.
* **Command-Pattern History**: Deep undo/redo state stack tracking additions, translations, paint styles, and object deletions.
* **Advanced Materials Finishes**: Matte, Metallic, Standard, and transparent physical refraction Glass finishes with a 10-color swatches palette and custom color pickers.
* **Project Exporter**: Instant JSON local storage backup and GLTF 3D exporter with canvas-confetti particle celebrations.
* **Starter Templates**: Interactive templates to load structuredCastle Keeps, Cozy Living Rooms, and recreational Playgrounds.

---

## ⌨️ Controls & Shortcuts

### Viewport Navigation
* **Rotate/Orbit Camera**: Left-Click + Drag (Select tool) OR Right-Click + Drag
* **Pan Camera**: Shift + Right-Click + Drag OR Middle-Click + Drag
* **Zoom**: Scroll Wheel

### Keyboard Hotkeys
| Key | Action |
|---|---|
| `Q` | Activate **Select** Tool |
| `W` | Activate **Move/Translate** Tool |
| `E` | Activate **Rotate** Tool |
| `R` | Activate **Scale** Tool |
| `T` | Activate **Push-Pull (Extrude)** Tool |
| `Escape` | Clear current selection |
| `Delete` / `Backspace` | Delete active object |
| `Ctrl + Z` | Undo last operation |
| `Ctrl + Y` | Redo last operation |
| `Ctrl + D` | Duplicate selected mesh |

---

## 🛠️ Tech Stack & Architecture

The application is built on the **Engine-UI Separation pattern**, keeping logical and visual concerns decoupled for rendering efficiency:

```
  ┌─────────────────────────────────────────────────────────┐
  │                       React UI                          │
  │     (Topbar, Sidebar, Toolbar, Welcome, Measurements)   │
  └───────────────────────────┬─────────────────────────────┘
                              │ API Calls & Event Listeners
                              ▼
  ┌─────────────────────────────────────────────────────────┐
  │                 Editor Engine Core                      │
  │                  (EditorEngine.ts)                      │
  └───────┬───────────────────┬───────────────────┬─────────┘
          ▼                   ▼                   ▼
  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
  │   Three.js    │   │History Manager│   │Template Maker │
  │ (Scene Graph) │   │ (Undo/Redo)   │   │  (Presets)    │
  └───────────────┘   └───────────────┘   └───────────────┘
```

1. **Vite + React + TypeScript**: Handles rendering of the control deck, sidebar inputs, scene tree list, dialog frames, and styling properties.
2. **EditorEngine Core**: Coordinates direct Three.js scene actions, renderer dimensions, raycasting, cameras, lights, and selection helpers.
3. **HistoryManager**: Implements the Command pattern where each workspace operation (translate, scale, color, add, delete) records its execute and undo instructions.

---

## 📥 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+)
* [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/bytewrench/mysolidbuilder-private.git
   cd mysolidbuilder
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Spin up the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

---

## 📝 License
Proprietary. Developed by bytewrench and Antigravity AI.
