# Codebase Architecture & Mathematical Foundations

This document provides a technical walkthrough of the architecture, design patterns, and mathematical calculations driving the MS Build 3D Web Editor.

---

## 1. Architectural Pattern: Engine-UI Separation

To prevent sluggish frame rates and decouple concerns, the application follows a strict **Engine-UI Separation** model. 

* **The Engine Core (Vanilla TypeScript / Three.js)**: Runs in a high-performance rendering loop. It manages the 3D scene graph, renderer properties, cameras, shadow mapping, lighting, raycasting, selection helpers, template loaders, and the history undo/redo command stack.
* **The UI Shell (React / Tailwind-like Custom CSS)**: Handles the layout panels, sidebars, coordinate forms, color pallets, settings menus, and welcome modal dialogs.
* **Communication Interface**: 
  - **Downwards (React to Engine)**: React triggers actions directly on the engine instance (e.g. `engine.setTool(tool)`, `engine.updateSelectedObjectProperties(props)`, or `engine.historyManager.undo()`).
  - **Upwards (Engine to React)**: The engine extends `THREE.EventDispatcher` and fires events (e.g. `scene-changed`, `selection-changed`, `object-modified`, `cursor-moved`, `push-pull-drag`). React sub-components register listeners on mount and synchronize local state with engine properties on event trigger.

---

## 2. Mathematical Implementations

### A. Grid Snapping
When translating meshes or placing shapes, coordinates are rounded to the nearest multiple of the `gridSnapSize` $S$:

$$\text{SnappedCoordinate} = \text{round}\left(\frac{\text{RawCoordinate}}{S}\right) \times S$$

* Snapping translation uses `transformControls.setTranslationSnap(S)`.
* Snapping rotation utilizes $15^\circ$ (converted to radians: $\theta \approx 0.2618 \text{ rad}$).
* Snapping scaling defaults to increments of $0.25$ factor divisions.

---

### B. Push-Pull (Face Extrusion) Anchor Mechanics
When a user pulls or pushes a 3D block face, standard scaling operates symmetrically from the object center, which shifts both opposing faces. To anchor the opposite base face in place:

1. **World Coordinate Projection**:
   We project the mouse displacement vector $\vec{D}$ (from the initial intersection point to the current point on the camera-facing virtual plane) onto the world direction of the face normal $\vec{N}_{\text{world}}$:

   $$\Delta = \vec{D} \cdot \vec{N}_{\text{world}}$$

2. **Axis Isolation**:
   We determine which local axis ($X$, $Y$, or $Z$) corresponds to the face normal. Let $S_{\text{initial}}$ and $P_{\text{initial}}$ be the initial scale and position along that axis.
   
3. **Clamping & Sizing**:
   Calculate the new scale value, clamping it to a minimum thickness of $0.1$ meters:

   $$S_{\text{new}} = \max(0.1, S_{\text{initial}} + \Delta)$$

   $$\Delta_{\text{scale}} = S_{\text{new}} - S_{\text{initial}}$$

4. **Base-Anchored Position Translation**:
   To keep the opposite face stationary, the center position $P$ of the mesh must translate along the world normal vector by exactly half of the scale difference:

   $$P_{\text{new}} = P_{\text{initial}} + \left(\frac{\Delta_{\text{scale}}}{2}\right) \vec{N}_{\text{world}}$$

This creates a high-fidelity extrusion simulation for block faces without rebuilding local vertex topology.

---

### C. Hover Outlines & Selection Glows
* **Hover Highlights**: A pointermove event triggers a camera raycast. If an object is hovered, the engine creates a yellow `THREE.BoxHelper(hoveredMesh, 0xffd700)` in the scene, and updates its bounds inside the rendering loop.
* **Selection/Creation Glowing Fades**: On selection click or block creation, the engine sets the mesh material emissive properties to a cyan color:

   $$\text{Color}_{\text{emissive}} = (0.0, 0.94, 1.0)$$

   Inside the requestAnimationFrame loop, the emissive values are linearly interpolated (LERPed) back to black ($0,0,0$) by $5\%$ increments per frame, generating a glowing pulse effect:

   $$\text{Color}_{\text{emissive}}^{(t)} = \text{lerp}\left(\text{Color}_{\text{emissive}}^{(t-1)}, (0,0,0), 0.05\right)$$

---

## 3. Command History (Undo/Redo)

State modification relies on the **Command Pattern**:

```typescript
export interface Command {
  execute(): void;
  undo(): void;
  name: string;
}
```

* When a mesh is moved, rotated, scaled, painted, added, or deleted, a matching Command is pushed to the `HistoryManager` undo stack.
* Triggering Undo pops the command, calls `.undo()`, and moves it to the redo stack.
* New modifications clear the redo stack to prevent branch divergence.
