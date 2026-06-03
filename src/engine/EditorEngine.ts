import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { HistoryManager } from './HistoryManager';
import type { Command } from './HistoryManager';
import confetti from 'canvas-confetti';

// CSG and Advanced Edit Imports
import { union, subtract, intersect, fromGeometry, toGeometry, CSGNode } from './CSG';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// Editor Tools
export type EditorTool = 'select' | 'translate' | 'rotate' | 'scale' | 'push-pull' | 'shape' | 'erase' | 'paint';
export type PrimitiveShape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus';
export type MaterialStyle = 'standard' | 'matte' | 'metal' | 'glass';

export class EditorEngine extends THREE.EventDispatcher<any> {
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;
  public orbitControls!: OrbitControls;
  public transformControls!: TransformControls;
  public gridHelper!: THREE.GridHelper;
  public historyManager = new HistoryManager();

  // Core Editor State
  public activeTool: EditorTool = 'select';
  public activeShape: PrimitiveShape = 'box';
  public activeColor: string = '#3b82f6'; // Indigo default
  public activeMaterialStyle: MaterialStyle = 'standard';
  
  // Selection State
  public selectedObjects: THREE.Object3D[] = [];
  public stickySelection: boolean = false;
  get selectedObject(): THREE.Object3D | null {
    return this.selectedObjects.length > 0 ? this.selectedObjects[0] : null;
  }

  // View Settings State
  public shadingEnabled: boolean = true;
  public shadowsEnabled: boolean = true;
  public colorsEnabled: boolean = true;
  public reflectionsEnabled: boolean = true;
  public smoothingEnabled: boolean = true;
  public wireframeEnabled: boolean = false;
  public gridEnabled: boolean = true;
  public xrayEnabled: boolean = false;

  public snapEnabled: boolean = true;
  public gridSnapSize: number = 0.5;

  private canvas!: HTMLCanvasElement;
  private selectionBoxHelper: THREE.BoxHelper | null = null;
  private selectionLight: THREE.PointLight | null = null;
  private hoverBoxHelper: THREE.BoxHelper | null = null;
  private cuttingPlaneHelper: THREE.GridHelper | null = null;
  private previewMesh!: THREE.Mesh;
  
  // Undo/Redo tracking variables
  private transformStartPos = new THREE.Vector3();
  private transformStartRot = new THREE.Euler();
  private transformStartScl = new THREE.Vector3();

  // Push-Pull dragging states
  private isPushPulling: boolean = false;
  private pushPullMesh: THREE.Mesh | null = null;
  private pushPullNormal = new THREE.Vector3();
  private pushPullLocalNormal = new THREE.Vector3();
  private pushPullStartIntersection = new THREE.Vector3();
  private pushPullStartPos = new THREE.Vector3();
  private pushPullStartScl = new THREE.Vector3();
  private pushPullPlane = new THREE.Plane();

  constructor(canvas: HTMLCanvasElement) {
    super();
    this.canvas = canvas;
    this.initThree();
    this.initLights();
    this.initHelpers();
    this.initControls();
    this.initEventListeners();
    this.animate();
  }

  // 1. Initialize Three.js Components
  private initThree() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0e1117');
    this.scene.fog = new THREE.FogExp2('#0e1117', 0.015);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(15, 12, 20);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true, // Needed for screenshot/export captures
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // Removed warning-producing PCFSoftShadowMap

    // Setup ghost/preview mesh for shape drawing (Highlight moving cursor)
    const previewGeo = new THREE.BoxGeometry(2, 2, 2);
    const previewMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.4,
      wireframe: false
    });
    this.previewMesh = new THREE.Mesh(previewGeo, previewMat);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);
  }

  // 2. Setup Lights
  private initLights() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional Shadow Casting Light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    
    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;

    this.scene.add(dirLight);

    // Extra subtle fill lights
    const fillLight1 = new THREE.DirectionalLight(0x3b82f6, 0.25);
    fillLight1.position.set(-20, 10, -20);
    this.scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0x8b5cf6, 0.15);
    fillLight2.position.set(0, -10, 0);
    this.scene.add(fillLight2);

    // Selection Glow Light (moved to selected object)
    this.selectionLight = new THREE.PointLight(0x00f0ff, 0.8, 10);
    this.selectionLight.visible = false;
    this.scene.add(this.selectionLight);
  }

  // 3. Grid & World Axes Helpers
  private initHelpers() {
    // Grid Helper
    this.gridHelper = new THREE.GridHelper(100, 100, 0x00f0ff, 0x1f2937);
    this.gridHelper.position.y = 0;
    // Lower opacity of grid lines
    const material = this.gridHelper.material as THREE.LineBasicMaterial;
    material.opacity = 0.25;
    material.transparent = true;
    this.scene.add(this.gridHelper);

    // Center Coordinate lines (X: Red, Z: Blue, Y: Green)
    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.position.set(0, 0.01, 0); // slightly above grid
    this.scene.add(axesHelper);
  }

  // 4. Orbit and Transform Controls
  private initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevents camera from going under ground
    this.orbitControls.minDistance = 2;
    this.orbitControls.maxDistance = 150;

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.size = 0.8;
    this.scene.add(this.transformControls as any);

    // Prevent orbit controls from moving while transform controls are dragged
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
      
      if (event.value) {
        // Dragging started - record initial transform
        if (this.selectedObject) {
          this.transformStartPos.copy(this.selectedObject.position);
          this.transformStartRot.copy(this.selectedObject.rotation);
          this.transformStartScl.copy(this.selectedObject.scale);
        }
      } else {
        // Dragging ended - push action to command stack if object actually moved
        if (this.selectedObject) {
          const pos = this.selectedObject.position;
          const rot = this.selectedObject.rotation;
          const scl = this.selectedObject.scale;

          if (!pos.equals(this.transformStartPos) || 
              !rot.equals(this.transformStartRot) || 
              !scl.equals(this.transformStartScl)) {
            
            const target = this.selectedObject;
            const oldPos = this.transformStartPos.clone();
            const newPos = pos.clone();
            const oldRot = this.transformStartRot.clone();
            const newRot = rot.clone();
            const oldScl = this.transformStartScl.clone();
            const newScl = scl.clone();

            const cmd: Command = {
              name: `Transform ${target.name}`,
              execute: () => {
                target.position.copy(newPos);
                target.rotation.copy(newRot);
                target.scale.copy(newScl);
                this.updateSelectionHelper();
              },
              undo: () => {
                target.position.copy(oldPos);
                target.rotation.copy(oldRot);
                target.scale.copy(oldScl);
                this.updateSelectionHelper();
              }
            };
            this.historyManager.execute(cmd);
            this.dispatchEvent({ type: 'history-changed' });
            this.dispatchEvent({ type: 'object-modified', object: target });
          }
        }
      }
    });

    // Snap to grid settings
    this.updateSnapping();
  }

  // 5. Canvas Event Listeners
  private initEventListeners() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    
    // History callbacks trigger react redraw
    this.historyManager.subscribe(() => {
      this.dispatchEvent({ type: 'history-changed' });
    });
  }

  public updateSnapping() {
    if (this.snapEnabled) {
      this.transformControls.setTranslationSnap(this.gridSnapSize);
      this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
      this.transformControls.setScaleSnap(0.25);
    } else {
      this.transformControls.setTranslationSnap(null);
      this.transformControls.setRotationSnap(null);
      this.transformControls.setScaleSnap(null);
    }
  }

  // 6. Handle Mouse Click (Down) Action
  private onPointerDown(event: PointerEvent) {
    // Only handle left mouse click
    if (event.button !== 0) return;

    // Check if transform gizmo is hovered/clicked
    if ((this.transformControls as any).dragging || (this.transformControls as any).pointerIsOver) return;

    // Get normalized device coordinates
    const rect = this.canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // List of models in scene that can be clicked (recursively checks groups as well)
    const targets = this.scene.children.filter(child => 
      child !== (this.gridHelper as any) && 
      child !== (this.selectionBoxHelper as any) &&
      child !== (this.hoverBoxHelper as any) &&
      child !== this.previewMesh &&
      (child instanceof THREE.Mesh || child instanceof THREE.Group)
    );

    const intersects = raycaster.intersectObjects(targets, true);

    if (this.activeTool === 'shape') {
      // Add shape mode: find ground/grid intersection
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const targetPoint = new THREE.Vector3();
      
      if (raycaster.ray.intersectPlane(groundPlane, targetPoint)) {
        // Apply grid snap to placement if enabled
        if (this.snapEnabled) {
          targetPoint.x = Math.round(targetPoint.x / this.gridSnapSize) * this.gridSnapSize;
          targetPoint.z = Math.round(targetPoint.z / this.gridSnapSize) * this.gridSnapSize;
        }
        
        // Spawn shape at location
        this.addShapeAt(targetPoint);
      }
      return;
    }

    if (this.activeTool === 'push-pull') {
      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        const intersection = intersects[0];
        
        if (intersection.face) {
          this.isPushPulling = true;
          this.pushPullMesh = clickedMesh;
          
          // Get the local normal and store it
          const localNorm = intersection.face.normal.clone();
          this.pushPullLocalNormal.copy(localNorm);
          
          // Transform local normal to world normal
          const worldNorm = localNorm.clone().applyQuaternion(clickedMesh.quaternion);
          this.pushPullNormal.copy(worldNorm);

          this.pushPullStartIntersection.copy(intersection.point);
          this.pushPullStartPos.copy(clickedMesh.position);
          this.pushPullStartScl.copy(clickedMesh.scale);

          // Virtual plane facing the camera to measure dragging displacement
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          this.pushPullPlane.setFromNormalAndCoplanarPoint(camDir, intersection.point);

          // Disable OrbitControls to lock camera in place while dragging
          this.orbitControls.enabled = false;
          
          // Selection focus
          this.selectMesh(clickedMesh);
          this.clearHoverHighlight();
        }
      }
      return;
    }

    if (intersects.length > 0) {
      const clickedObj = this.getSelectionTarget(intersects[0].object);

      if (this.activeTool === 'erase') {
        this.deleteMesh(clickedObj);
      } else if (this.activeTool === 'paint') {
        if (clickedObj instanceof THREE.Group) {
          clickedObj.traverse(child => {
            if (child instanceof THREE.Mesh) this.paintMesh(child);
          });
        } else if (clickedObj instanceof THREE.Mesh) {
          this.paintMesh(clickedObj);
        }
      } else {
        // Select, Translate, Rotate, Scale
        if (this.stickySelection) {
          this.toggleSelectMesh(clickedObj);
        } else {
          this.selectMesh(clickedObj);
        }
      }
    } else {
      // Clicked on empty space: deselect if we are in Selection modes
      if (['select', 'translate', 'rotate', 'scale'].includes(this.activeTool)) {
        this.selectMesh(null);
      }
    }
  }

  // 7. Handle Mouse Move (Dragging & Hover Highlight)
  private onPointerMove(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // 1. Handle Push-Pull Dragging Mode
    if (this.isPushPulling && this.pushPullMesh) {
      const currentPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(this.pushPullPlane, currentPoint);
      
      const displacement = new THREE.Vector3().subVectors(currentPoint, this.pushPullStartIntersection);
      let delta = displacement.dot(this.pushPullNormal);

      if (this.snapEnabled) {
        delta = Math.round(delta / this.gridSnapSize) * this.gridSnapSize;
      }

      // Check local normal to see which axis of scale is affected
      const localNormal = this.pushPullLocalNormal;
      let initialScaleValue = 1;
      
      if (Math.abs(localNormal.x) > 0.9) {
        initialScaleValue = this.pushPullStartScl.x;
      } else if (Math.abs(localNormal.y) > 0.9) {
        initialScaleValue = this.pushPullStartScl.y;
      } else if (Math.abs(localNormal.z) > 0.9) {
        initialScaleValue = this.pushPullStartScl.z;
      }

      // Keep minimum thickness
      const newScale = Math.max(0.1, initialScaleValue + delta);
      const scaleDiff = newScale - initialScaleValue;

      // Adjust position (displace center by half of scale increase along normal to anchor bottom/opposite face)
      this.pushPullMesh.position.copy(this.pushPullStartPos)
        .addScaledVector(this.pushPullNormal, scaleDiff / 2);

      // Adjust scale along matching axis
      if (Math.abs(localNormal.x) > 0.9) {
        this.pushPullMesh.scale.x = newScale;
      } else if (Math.abs(localNormal.y) > 0.9) {
        this.pushPullMesh.scale.y = newScale;
      } else if (Math.abs(localNormal.z) > 0.9) {
        this.pushPullMesh.scale.z = newScale;
      }

      this.updateSelectionHelper();
      this.dispatchEvent({ type: 'object-modified', object: this.pushPullMesh });
      this.dispatchEvent({ type: 'push-pull-drag', offset: delta }); // Event to update measurements HUD
      return;
    }

    // 2. Handle Add Shape Ghost Preview Cursor Highlight
    if (this.activeTool === 'shape') {
      this.clearHoverHighlight();
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const targetPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, targetPoint)) {
        if (this.snapEnabled) {
          targetPoint.x = Math.round(targetPoint.x / this.gridSnapSize) * this.gridSnapSize;
          targetPoint.z = Math.round(targetPoint.z / this.gridSnapSize) * this.gridSnapSize;
        }

        this.updatePreviewMeshGeometry();
        this.previewMesh.geometry.computeBoundingBox();
        if (this.previewMesh.geometry.boundingBox) {
          const height = this.previewMesh.geometry.boundingBox.max.y - this.previewMesh.geometry.boundingBox.min.y;
          targetPoint.y = height / 2;
        }

        this.previewMesh.position.copy(targetPoint);
        this.previewMesh.visible = true;

        this.dispatchEvent({ type: 'cursor-moved', point: targetPoint }); // Update measurements HUD coordinates
      } else {
        this.previewMesh.visible = false;
        this.dispatchEvent({ type: 'cursor-moved', point: null });
      }
      return;
    }

    // 3. Handle Hover Outlines
    if ((this.transformControls as any).dragging || (this.transformControls as any).pointerIsOver) {
      this.clearHoverHighlight();
      return;
    }

    const targets = this.scene.children.filter(child => 
      child !== (this.gridHelper as any) && 
      child !== (this.selectionBoxHelper as any) &&
      child !== (this.hoverBoxHelper as any) &&
      child !== this.previewMesh &&
      (child instanceof THREE.Mesh || child instanceof THREE.Group)
    );

    const intersects = raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      const hoveredObj = this.getSelectionTarget(intersects[0].object);
      
      if (hoveredObj === this.selectedObject) {
        this.clearHoverHighlight();
        return;
      }

      if (this.hoverBoxHelper) {
        if ((this.hoverBoxHelper as any).object !== hoveredObj) {
          this.scene.remove(this.hoverBoxHelper);
          this.hoverBoxHelper = new THREE.BoxHelper(hoveredObj, 0xffd700); // Yellow outline
          (this.hoverBoxHelper as any).object = hoveredObj;
          (this.hoverBoxHelper.material as any).depthTest = false;
          (this.hoverBoxHelper.material as any).transparent = true;
          (this.hoverBoxHelper.material as any).opacity = 0.5;
          this.scene.add(this.hoverBoxHelper);
        } else {
          this.hoverBoxHelper.update();
        }
      } else {
        this.hoverBoxHelper = new THREE.BoxHelper(hoveredObj, 0xffd700);
        (this.hoverBoxHelper as any).object = hoveredObj;
        (this.hoverBoxHelper.material as any).depthTest = false;
        (this.hoverBoxHelper.material as any).transparent = true;
        (this.hoverBoxHelper.material as any).opacity = 0.5;
        this.scene.add(this.hoverBoxHelper);
      }
    } else {
      this.clearHoverHighlight();
    }
  }

  private clearHoverHighlight() {
    if (this.hoverBoxHelper) {
      this.scene.remove(this.hoverBoxHelper);
      this.hoverBoxHelper = null;
    }
  }

  private updatePreviewMeshGeometry() {
    let geometry: THREE.BufferGeometry;
    switch (this.activeShape) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(1, 32, 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 2, 16);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(1, 2, 16);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(1, 0.3, 16, 64);
        break;
      case 'box':
      default:
        geometry = new THREE.BoxGeometry(2, 2, 2);
        break;
    }
    this.previewMesh.geometry.dispose();
    this.previewMesh.geometry = geometry;
  }

  // 8. Handle Mouse Drag Release (Pointer Up)
  private onPointerUp() {
    if (this.isPushPulling && this.pushPullMesh) {
      const mesh = this.pushPullMesh;
      const startPos = this.pushPullStartPos.clone();
      const endPos = mesh.position.clone();
      const startScl = this.pushPullStartScl.clone();
      const endScl = mesh.scale.clone();

      if (!startPos.equals(endPos) || !startScl.equals(endScl)) {
        const cmd: Command = {
          name: `Push-Pull ${mesh.name}`,
          execute: () => {
            mesh.position.copy(endPos);
            mesh.scale.copy(endScl);
            this.updateSelectionHelper();
            this.dispatchEvent({ type: 'object-modified', object: mesh });
            this.dispatchEvent({ type: 'scene-changed' });
          },
          undo: () => {
            mesh.position.copy(startPos);
            mesh.scale.copy(startScl);
            this.updateSelectionHelper();
            this.dispatchEvent({ type: 'object-modified', object: mesh });
            this.dispatchEvent({ type: 'scene-changed' });
          }
        };
        this.historyManager.execute(cmd);
        this.dispatchEvent({ type: 'history-changed' });
      }

      this.isPushPulling = false;
      this.pushPullMesh = null;
      this.orbitControls.enabled = true;
      this.dispatchEvent({ type: 'push-pull-drag', offset: null });
    }
  }

  // 9. Core Object Actions & History

  // Add Shape
  private addShapeAt(position: THREE.Vector3) {
    let geometry: THREE.BufferGeometry;

    switch (this.activeShape) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(1, 32, 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 2, 16);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(1, 2, 16);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(1, 0.3, 16, 64);
        break;
      case 'box':
      default:
        geometry = new THREE.BoxGeometry(2, 2, 2);
        break;
    }

    // Material configuration based on UI selection
    const material = this.createMaterialFromStyle(this.activeColor, this.activeMaterialStyle);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${this.activeShape.charAt(0).toUpperCase() + this.activeShape.slice(1)} ${this.getNextMeshId(this.activeShape)}`;
    mesh.position.copy(position);
    
    // Adjust y to make objects rest on the grid
    mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) {
      const height = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
      mesh.position.y += height / 2;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Pulse Glow cyan on creation
    if ((mesh.material as any).emissive) {
      (mesh.material as any).emissive.setHex(0x00f0ff);
    }

    // Create Command
    const cmd: Command = {
      name: `Add ${mesh.name}`,
      execute: () => {
        this.scene.add(mesh);
        this.selectMesh(mesh);
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        if (this.selectedObject === mesh) this.selectMesh(null);
        this.scene.remove(mesh);
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
    
    // Flash tool back to 'translate' or 'select' for quick editing
    this.updateViewFilters();
    this.setTool('translate');
    this.previewMesh.visible = false;
    this.dispatchEvent({ type: 'cursor-moved', point: null });
  }

  // Helper to generate materials
  private createMaterialFromStyle(hexColor: string, style: MaterialStyle): THREE.Material {
    const color = new THREE.Color(hexColor);
    switch (style) {
      case 'matte':
        return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.05 });
      case 'metal':
        return new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.95 });
      case 'glass':
        return new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.1,
          transmission: 0.9,
          thickness: 1.0,
          transparent: true,
          opacity: 1
        });
      case 'standard':
      default:
        return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
    }
  }

  // Paint Mesh
  private paintMesh(mesh: THREE.Mesh) {
    const oldMaterial = mesh.material as THREE.Material;
    const newMaterial = this.createMaterialFromStyle(this.activeColor, this.activeMaterialStyle);

    // Glow mesh cyan on paint
    if ((newMaterial as any).emissive) {
      (newMaterial as any).emissive.setHex(0x00f0ff);
    }

    const cmd: Command = {
      name: `Paint ${mesh.name}`,
      execute: () => {
        mesh.material = newMaterial;
        this.dispatchEvent({ type: 'object-modified', object: mesh });
      },
      undo: () => {
        mesh.material = oldMaterial;
        this.dispatchEvent({ type: 'object-modified', object: mesh });
      }
    };

    this.historyManager.execute(cmd);
  }

  // Delete Mesh / Object
  private deleteMesh(obj: THREE.Object3D) {
    const isSelected = this.selectedObjects.includes(obj);

    const cmd: Command = {
      name: `Delete ${obj.name}`,
      execute: () => {
        if (isSelected) {
          this.selectedObjects = this.selectedObjects.filter(item => item !== obj);
          this.onSelectionChanged();
        }
        this.scene.remove(obj);
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        this.scene.add(obj);
        if (isSelected) {
          this.selectedObjects.push(obj);
          this.onSelectionChanged();
        }
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  // Selection target resolver (group support)
  private getSelectionTarget(obj: THREE.Object3D): THREE.Object3D {
    let current = obj;
    while (current.parent && current.parent !== this.scene) {
      if (current.parent instanceof THREE.Group) {
        current = current.parent;
      } else {
        break;
      }
    }
    return current;
  }

  // Select Object
  public selectMesh(obj: THREE.Object3D | null) {
    if (obj) {
      this.selectedObjects = [obj];
    } else {
      this.selectedObjects = [];
    }
    this.onSelectionChanged();
  }

  public toggleSelectMesh(obj: THREE.Object3D) {
    const idx = this.selectedObjects.indexOf(obj);
    if (idx > -1) {
      this.selectedObjects.splice(idx, 1);
    } else {
      this.selectedObjects.push(obj);
    }
    this.onSelectionChanged();
  }

  public selectAll() {
    const meshes = this.getMeshes();
    this.selectedObjects = [...meshes];
    this.onSelectionChanged();
  }

  public deselectAll() {
    this.selectedObjects = [];
    this.onSelectionChanged();
  }

  public invertSelection() {
    const all = this.getMeshes();
    this.selectedObjects = all.filter(obj => !this.selectedObjects.includes(obj));
    this.onSelectionChanged();
  }

  public groupSelected() {
    if (this.selectedObjects.length < 2) return;

    const group = new THREE.Group();
    group.name = `Group ${this.getNextMeshId('Group')}`;

    // Calculate selection center
    const center = new THREE.Vector3();
    this.selectedObjects.forEach(obj => center.add(obj.position));
    center.divideScalar(this.selectedObjects.length);
    group.position.copy(center);

    const oldParents: { object: THREE.Object3D; parent: THREE.Object3D; position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }[] = [];
    const objectsToGroup = [...this.selectedObjects];

    const cmd: Command = {
      name: `Group into ${group.name}`,
      execute: () => {
        this.scene.add(group);
        objectsToGroup.forEach(obj => {
          oldParents.push({
            object: obj,
            parent: obj.parent || this.scene,
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone()
          });

          // Attach to group (handles world to local conversion)
          group.attach(obj);
        });

        this.selectMesh(group);
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        this.selectMesh(null);
        oldParents.forEach(entry => {
          entry.parent.attach(entry.object);
          entry.object.position.copy(entry.position);
          entry.object.rotation.copy(entry.rotation);
          entry.object.scale.copy(entry.scale);
        });
        this.scene.remove(group);
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  public ungroupSelected() {
    if (!this.selectedObject || !(this.selectedObject instanceof THREE.Group)) return;

    const group = this.selectedObject as THREE.Group;
    const children = [...group.children];
    const oldTransforms: { object: THREE.Object3D; parent: THREE.Object3D; position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }[] = [];

    const cmd: Command = {
      name: `Ungroup ${group.name}`,
      execute: () => {
        this.selectMesh(null);
        children.forEach(obj => {
          oldTransforms.push({
            object: obj,
            parent: group,
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone()
          });

          // Attach back to the scene root
          this.scene.attach(obj);
        });
        this.scene.remove(group);
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        this.scene.add(group);
        oldTransforms.forEach(entry => {
          group.attach(entry.object);
          entry.object.position.copy(entry.position);
          entry.object.rotation.copy(entry.rotation);
          entry.object.scale.copy(entry.scale);
        });
        this.selectMesh(group);
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  private onSelectionChanged() {
    const primary = this.selectedObject;

    if (primary) {
      // Toggle glow highlight
      primary.traverse(child => {
        if (child instanceof THREE.Mesh && (child.material as any).emissive) {
          (child.material as any).emissive.setHex(0x00f0ff);
        }
      });

      // Attach TransformControls if active tool is translate/rotate/scale
      if (['translate', 'rotate', 'scale'].includes(this.activeTool)) {
        this.transformControls.attach(primary);
        (this.transformControls as any).visible = true;
      } else {
        this.transformControls.detach();
        (this.transformControls as any).visible = false;
      }

      // Show selection box helper
      if (this.selectionBoxHelper) this.scene.remove(this.selectionBoxHelper);
      this.selectionBoxHelper = new THREE.BoxHelper(primary, 0x00f0ff);
      (this.selectionBoxHelper.material as any).depthTest = false;
      (this.selectionBoxHelper.material as any).transparent = true;
      (this.selectionBoxHelper.material as any).opacity = 0.8;
      this.scene.add(this.selectionBoxHelper);

      // Light up object slightly
      if (this.selectionLight) {
        this.selectionLight.position.copy(primary.position);
        this.selectionLight.position.y += 1.5;
        this.selectionLight.visible = true;
      }

      // Clear hover helper if hovering selected mesh
      if (this.hoverBoxHelper && (this.hoverBoxHelper as any).object === primary) {
        this.clearHoverHighlight();
      }
    } else {
      this.transformControls.detach();
      (this.transformControls as any).visible = false;
      if (this.selectionBoxHelper) {
        this.scene.remove(this.selectionBoxHelper);
        this.selectionBoxHelper = null;
      }
      if (this.selectionLight) {
        this.selectionLight.visible = false;
      }
    }

    this.dispatchEvent({ type: 'selection-changed', object: primary });
  }

  // Update position of selection box highlight
  private updateSelectionHelper() {
    if (this.selectionBoxHelper && this.selectedObject) {
      this.selectionBoxHelper.update();
    }
    if (this.selectionLight && this.selectedObject) {
      this.selectionLight.position.copy(this.selectedObject.position);
      this.selectionLight.position.y += 2.0;
    }
  }

  // Delete current selected object
  public deleteSelected() {
    if (this.selectedObject) {
      this.deleteMesh(this.selectedObject);
    }
  }

  // Duplicate current selected object
  public duplicateSelected() {
    if (!this.selectedObject) return;
    const obj = this.selectedObject;
    const clone = obj.clone();
    clone.name = `${obj.name} (Copy)`;
    clone.position.x += 2; // offset it slightly
    clone.position.z += 2;
    clone.castShadow = true;
    clone.receiveShadow = true;

    // Glow clone cyan
    clone.traverse(child => {
      if (child instanceof THREE.Mesh && (child.material as any).emissive) {
        (child.material as any).emissive.setHex(0x00f0ff);
      }
    });

    const cmd: Command = {
      name: `Duplicate ${obj.name}`,
      execute: () => {
        this.scene.add(clone);
        this.selectMesh(clone);
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        if (this.selectedObject === clone) this.selectMesh(null);
        this.scene.remove(clone);
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  // Advanced CSG & Mesh Processing Operations (Edit Toolbar)

  private objectToCSG(obj: THREE.Object3D): CSGNode {
    const csgNodes: CSGNode[] = [];
    obj.updateMatrixWorld(true);
    
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const node = fromGeometry(child.geometry, child.matrixWorld);
        csgNodes.push(node);
      }
    });

    if (csgNodes.length === 0) {
      return new CSGNode([]);
    }

    let result = csgNodes[0];
    for (let i = 1; i < csgNodes.length; i++) {
      result = union(result, csgNodes[i]);
    }
    return result;
  }

  public mergeSelected() {
    if (this.selectedObjects.length < 2) return;
    const targets = [...this.selectedObjects];

    const primary = targets[0];
    const primaryColor = (primary as any).material?.color?.getHexString() ? '#' + (primary as any).material.color.getHexString() : this.activeColor;
    const primaryStyle = (primary as any).materialStyle || this.activeMaterialStyle;

    const cmd: Command = {
      name: `Merge Meshes`,
      execute: () => {
        let csgResult = this.objectToCSG(targets[0]);
        for (let i = 1; i < targets.length; i++) {
          const csgNext = this.objectToCSG(targets[i]);
          csgResult = union(csgResult, csgNext);
        }

        const newGeom = toGeometry(csgResult);
        const newMat = this.createMaterialFromStyle(primaryColor, primaryStyle);
        const mergedMesh = new THREE.Mesh(newGeom, newMat);
        mergedMesh.name = `Merged ${this.getNextMeshId('Merged')}`;
        mergedMesh.castShadow = true;
        mergedMesh.receiveShadow = true;

        (cmd as any).resultMesh = mergedMesh;

        targets.forEach((obj) => this.scene.remove(obj));
        this.selectedObjects = [mergedMesh];
        this.scene.add(mergedMesh);

        this.onSelectionChanged();
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        const mergedMesh = (cmd as any).resultMesh;
        if (mergedMesh) {
          this.scene.remove(mergedMesh);
        }
        targets.forEach((obj) => this.scene.add(obj));
        this.selectedObjects = [...targets];
        this.onSelectionChanged();
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  public subtractSelected() {
    if (this.selectedObjects.length < 2) return;
    const targets = [...this.selectedObjects];

    const primary = targets[0];
    const primaryColor = (primary as any).material?.color?.getHexString() ? '#' + (primary as any).material.color.getHexString() : this.activeColor;
    const primaryStyle = (primary as any).materialStyle || this.activeMaterialStyle;

    const cmd: Command = {
      name: `Subtract Meshes`,
      execute: () => {
        let csgResult = this.objectToCSG(targets[0]);
        for (let i = 1; i < targets.length; i++) {
          const csgNext = this.objectToCSG(targets[i]);
          csgResult = subtract(csgResult, csgNext);
        }

        const newGeom = toGeometry(csgResult);
        const newMat = this.createMaterialFromStyle(primaryColor, primaryStyle);
        const resultMesh = new THREE.Mesh(newGeom, newMat);
        resultMesh.name = `${primary.name} (Subtracted)`;
        resultMesh.castShadow = true;
        resultMesh.receiveShadow = true;

        (cmd as any).resultMesh = resultMesh;

        targets.forEach((obj) => this.scene.remove(obj));
        this.selectedObjects = [resultMesh];
        this.scene.add(resultMesh);

        this.onSelectionChanged();
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        const resultMesh = (cmd as any).resultMesh;
        if (resultMesh) {
          this.scene.remove(resultMesh);
        }
        targets.forEach((obj) => this.scene.add(obj));
        this.selectedObjects = [...targets];
        this.onSelectionChanged();
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  public intersectSelected() {
    if (this.selectedObjects.length < 2) return;
    const targets = [...this.selectedObjects];

    const primary = targets[0];
    const primaryColor = (primary as any).material?.color?.getHexString() ? '#' + (primary as any).material.color.getHexString() : this.activeColor;
    const primaryStyle = (primary as any).materialStyle || this.activeMaterialStyle;

    const cmd: Command = {
      name: `Intersect Meshes`,
      execute: () => {
        let csgResult = this.objectToCSG(targets[0]);
        for (let i = 1; i < targets.length; i++) {
          const csgNext = this.objectToCSG(targets[i]);
          csgResult = intersect(csgResult, csgNext);
        }

        const newGeom = toGeometry(csgResult);
        const newMat = this.createMaterialFromStyle(primaryColor, primaryStyle);
        const resultMesh = new THREE.Mesh(newGeom, newMat);
        resultMesh.name = `Intersection ${this.getNextMeshId('Intersection')}`;
        resultMesh.castShadow = true;
        resultMesh.receiveShadow = true;

        (cmd as any).resultMesh = resultMesh;

        targets.forEach((obj) => this.scene.remove(obj));
        this.selectedObjects = [resultMesh];
        this.scene.add(resultMesh);

        this.onSelectionChanged();
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        const resultMesh = (cmd as any).resultMesh;
        if (resultMesh) {
          this.scene.remove(resultMesh);
        }
        targets.forEach((obj) => this.scene.add(obj));
        this.selectedObjects = [...targets];
        this.onSelectionChanged();
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  public simplifySelected(ratio: number) {
    if (!this.selectedObject) return;
    const target = this.selectedObject;

    const originalGeoms = new Map<string, THREE.BufferGeometry>();
    target.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalGeoms.set(child.uuid, child.geometry.clone());
      }
    });

    const cmd: Command = {
      name: `Simplify ${target.name}`,
      execute: () => {
        target.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            try {
              const modifier = new SimplifyModifier();
              const originalGeom = originalGeoms.get(child.uuid);
              if (originalGeom) {
                const totalVerts = originalGeom.attributes.position.count;
                const targetCount = Math.max(4, Math.min(totalVerts - 1, Math.floor(totalVerts * ratio)));
                if (targetCount < totalVerts) {
                  const simplified = modifier.modify(originalGeom, targetCount);
                  child.geometry.dispose();
                  child.geometry = simplified;
                }
              }
            } catch (e) {
              console.warn("Failed to simplify mesh geometry:", e);
            }
          }
        });
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: target });
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        target.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const orig = originalGeoms.get(child.uuid);
            if (orig) {
              child.geometry.dispose();
              child.geometry = orig.clone();
            }
          }
        });
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: target });
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  private smoothGeometry(geometry: THREE.BufferGeometry, factor: number, iterations: number): THREE.BufferGeometry {
    const geom = geometry.clone();
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return geom;

    const count = posAttr.count;
    const vertexKeyMap = new Map<string, number>();
    const uniquePositions: THREE.Vector3[] = [];
    const vertexToUnique: number[] = [];

    for (let i = 0; i < count; i++) {
      const x = parseFloat(posAttr.getX(i).toFixed(5));
      const y = parseFloat(posAttr.getY(i).toFixed(5));
      const z = parseFloat(posAttr.getZ(i).toFixed(5));
      const key = `${x},${y},${z}`;

      let uniqueIdx = vertexKeyMap.get(key);
      if (uniqueIdx === undefined) {
        uniqueIdx = uniquePositions.length;
        vertexKeyMap.set(key, uniqueIdx);
        uniquePositions.push(new THREE.Vector3(x, y, z));
      }
      vertexToUnique.push(uniqueIdx);
    }

    const numUnique = uniquePositions.length;
    const adjList: Set<number>[] = Array.from({ length: numUnique }, () => new Set<number>());

    let indices: ArrayLike<number> | null = null;
    if (geom.index) {
      indices = geom.index.array;
    }

    const totalIndices = indices ? indices.length : count;
    for (let i = 0; i < totalIndices; i += 3) {
      const idx0 = indices ? indices[i] : i;
      const idx1 = indices ? indices[i + 1] : i + 1;
      const idx2 = indices ? indices[i + 2] : i + 2;

      const u0 = vertexToUnique[idx0];
      const u1 = vertexToUnique[idx1];
      const u2 = vertexToUnique[idx2];

      if (u0 !== u1) { adjList[u0].add(u1); adjList[u1].add(u0); }
      if (u1 !== u2) { adjList[u1].add(u2); adjList[u2].add(u1); }
      if (u2 !== u0) { adjList[u2].add(u0); adjList[u0].add(u2); }
    }

    let currPos = uniquePositions.map((v) => v.clone());
    let nextPos = uniquePositions.map((v) => v.clone());

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < numUnique; i++) {
        const neighbors = adjList[i];
        if (neighbors.size === 0) continue;

        const avg = new THREE.Vector3();
        neighbors.forEach((nIdx) => {
          avg.add(currPos[nIdx]);
        });
        avg.divideScalar(neighbors.size);
        nextPos[i].copy(currPos[i]).lerp(avg, factor);
      }
      const temp = currPos;
      currPos = nextPos;
      nextPos = temp.map((v) => v.clone());
    }

    for (let i = 0; i < count; i++) {
      const uIdx = vertexToUnique[i];
      const smoothV = currPos[uIdx];
      posAttr.setXYZ(i, smoothV.x, smoothV.y, smoothV.z);
    }

    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }

  public smoothSelected(factor: number, iterations: number) {
    if (!this.selectedObject) return;
    const target = this.selectedObject;

    const originalGeoms = new Map<string, THREE.BufferGeometry>();
    target.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalGeoms.set(child.uuid, child.geometry.clone());
      }
    });

    const cmd: Command = {
      name: `Smooth ${target.name}`,
      execute: () => {
        target.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const orig = originalGeoms.get(child.uuid);
            if (orig) {
              const smoothed = this.smoothGeometry(orig, factor, iterations);
              child.geometry.dispose();
              child.geometry = smoothed;
            }
          }
        });
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: target });
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        target.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const orig = originalGeoms.get(child.uuid);
            if (orig) {
              child.geometry.dispose();
              child.geometry = orig.clone();
            }
          }
        });
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: target });
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  public async embossSelected(text: string, size: number, depth: number) {
    if (!this.selectedObject) return;
    const target = this.selectedObject;

    try {
      const loader = new FontLoader();
      const fontUrl = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json';
      const response = await fetch(fontUrl);
      const fontJson = await response.json();
      const font = loader.parse(fontJson);

      const absDepth = Math.abs(depth);
      const textGeom = new TextGeometry(text, {
        font: font,
        size: size,
        depth: absDepth,
        curveSegments: 4,
        bevelEnabled: false
      });
      textGeom.center();

      const bbox = new THREE.Box3().setFromObject(target);
      const targetSize = new THREE.Vector3();
      bbox.getSize(targetSize);
      const targetCenter = new THREE.Vector3();
      bbox.getCenter(targetCenter);

      const primaryColor = (target as any).material?.color?.getHexString() ? '#' + (target as any).material.color.getHexString() : this.activeColor;
      const primaryStyle = (target as any).materialStyle || this.activeMaterialStyle;
      const textMat = this.createMaterialFromStyle(primaryColor, primaryStyle);
      const textMesh = new THREE.Mesh(textGeom, textMat);

      let textZ = targetCenter.z + (targetSize.z / 2);
      if (depth > 0) {
        textZ += absDepth / 2 - 0.02;
      } else {
        textZ -= absDepth / 2 - 0.02;
      }

      textMesh.position.set(targetCenter.x, targetCenter.y, textZ);
      textMesh.updateMatrixWorld(true);

      const targetCSG = this.objectToCSG(target);
      const textCSG = fromGeometry(textMesh.geometry, textMesh.matrixWorld);

      let resultCSG: CSGNode;
      if (depth > 0) {
        resultCSG = union(targetCSG, textCSG);
      } else {
        resultCSG = subtract(targetCSG, textCSG);
      }

      const resultGeom = toGeometry(resultCSG);
      const resultMesh = new THREE.Mesh(resultGeom, textMat);
      resultMesh.name = `${target.name} (Embossed)`;
      resultMesh.castShadow = true;
      resultMesh.receiveShadow = true;

      const cmd: Command = {
        name: `Emboss ${target.name}`,
        execute: () => {
          (cmd as any).resultMesh = resultMesh;
          this.scene.remove(target);
          this.scene.add(resultMesh);
          this.selectedObjects = [resultMesh];
          this.onSelectionChanged();
          this.dispatchEvent({ type: 'scene-changed' });
        },
        undo: () => {
          this.scene.remove(resultMesh);
          this.scene.add(target);
          this.selectedObjects = [target];
          this.onSelectionChanged();
          this.dispatchEvent({ type: 'scene-changed' });
        }
      };

      this.historyManager.execute(cmd);
      textGeom.dispose();

    } catch (error) {
      console.error("Emboss failed:", error);
      alert("Emboss failed to execute. Ensure you are connected to the internet to load the default font typeface.");
    }
  }

  private extrudeDownGeometry(mesh: THREE.Mesh, floorY: number = 0): THREE.BufferGeometry {
    mesh.updateMatrixWorld(true);
    const matrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

    const geom = mesh.geometry.clone();
    const posAttr = geom.getAttribute('position');
    const normAttr = geom.getAttribute('normal');
    const uvAttr = geom.getAttribute('uv');

    if (!posAttr) return geom;

    let indices: ArrayLike<number> | null = null;
    if (geom.index) {
      indices = geom.index.array;
    }

    const count = indices ? indices.length : posAttr.count;

    const outPositions: number[] = [];
    const outNormals: number[] = [];
    const outUvs: number[] = [];

    for (let i = 0; i < count; i += 3) {
      const idx0 = indices ? indices[i] : i;
      const idx1 = indices ? indices[i + 1] : i + 1;
      const idx2 = indices ? indices[i + 2] : i + 2;

      const A = new THREE.Vector3(posAttr.getX(idx0), posAttr.getY(idx0), posAttr.getZ(idx0)).applyMatrix4(matrix);
      const B = new THREE.Vector3(posAttr.getX(idx1), posAttr.getY(idx1), posAttr.getZ(idx1)).applyMatrix4(matrix);
      const C = new THREE.Vector3(posAttr.getX(idx2), posAttr.getY(idx2), posAttr.getZ(idx2)).applyMatrix4(matrix);

      const uvA = new THREE.Vector2(uvAttr ? uvAttr.getX(idx0) : 0, uvAttr ? uvAttr.getY(idx0) : 0);
      const uvB = new THREE.Vector2(uvAttr ? uvAttr.getX(idx1) : 0, uvAttr ? uvAttr.getY(idx1) : 0);
      const uvC = new THREE.Vector2(uvAttr ? uvAttr.getX(idx2) : 0, uvAttr ? uvAttr.getY(idx2) : 0);

      const cb = new THREE.Vector3().subVectors(C, B);
      const ab = new THREE.Vector3().subVectors(A, B);
      const faceNormal = new THREE.Vector3().crossVectors(cb, ab).normalize();

      outPositions.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
      if (normAttr) {
        const nA = new THREE.Vector3(normAttr.getX(idx0), normAttr.getY(idx0), normAttr.getZ(idx0)).applyMatrix3(normalMatrix).normalize();
        const nB = new THREE.Vector3(normAttr.getX(idx1), normAttr.getY(idx1), normAttr.getZ(idx1)).applyMatrix3(normalMatrix).normalize();
        const nC = new THREE.Vector3(normAttr.getX(idx2), normAttr.getY(idx2), normAttr.getZ(idx2)).applyMatrix3(normalMatrix).normalize();
        outNormals.push(nA.x, nA.y, nA.z, nB.x, nB.y, nB.z, nC.x, nC.y, nC.z);
      } else {
        outNormals.push(faceNormal.x, faceNormal.y, faceNormal.z, faceNormal.x, faceNormal.y, faceNormal.z, faceNormal.x, faceNormal.y, faceNormal.z);
      }
      outUvs.push(uvA.x, uvA.y, uvB.x, uvB.y, uvC.x, uvC.y);

      if (faceNormal.y < -0.05) {
        const A_ = new THREE.Vector3(A.x, floorY, A.z);
        const B_ = new THREE.Vector3(B.x, floorY, B.z);
        const C_ = new THREE.Vector3(C.x, floorY, C.z);

        outPositions.push(A_.x, A_.y, A_.z, C_.x, C_.y, C_.z, B_.x, B_.y, B_.z);
        const bottomNormal = new THREE.Vector3(0, -1, 0);
        outNormals.push(
          bottomNormal.x, bottomNormal.y, bottomNormal.z,
          bottomNormal.x, bottomNormal.y, bottomNormal.z,
          bottomNormal.x, bottomNormal.y, bottomNormal.z
        );
        outUvs.push(uvA.x, uvA.y, uvC.x, uvC.y, uvB.x, uvB.y);

        const addWallQuad = (v1: THREE.Vector3, v2: THREE.Vector3, v2_: THREE.Vector3, v1_: THREE.Vector3, uv1: THREE.Vector2, uv2: THREE.Vector2) => {
          outPositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v2_.x, v2_.y, v2_.z);
          outPositions.push(v1.x, v1.y, v1.z, v2_.x, v2_.y, v2_.z, v1_.x, v1_.y, v1_.z);

          const edge = new THREE.Vector3().subVectors(v2, v1);
          const wallNormal = new THREE.Vector3(edge.z, 0, -edge.x).normalize();

          outNormals.push(
            wallNormal.x, wallNormal.y, wallNormal.z,
            wallNormal.x, wallNormal.y, wallNormal.z,
            wallNormal.x, wallNormal.y, wallNormal.z,
            wallNormal.x, wallNormal.y, wallNormal.z,
            wallNormal.x, wallNormal.y, wallNormal.z,
            wallNormal.x, wallNormal.y, wallNormal.z
          );

          outUvs.push(
            uv1.x, uv1.y, uv2.x, uv2.y, uv2.x, uv2.y,
            uv1.x, uv1.y, uv2.x, uv2.y, uv1.x, uv1.y
          );
        };

        addWallQuad(A, B, B_, A_, uvA, uvB);
        addWallQuad(B, C, C_, B_, uvB, uvC);
        addWallQuad(C, A, A_, C_, uvC, uvA);
      }
    }

    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute('position', new THREE.Float32BufferAttribute(outPositions, 3));
    newGeom.setAttribute('normal', new THREE.Float32BufferAttribute(outNormals, 3));
    newGeom.setAttribute('uv', new THREE.Float32BufferAttribute(outUvs, 2));

    return newGeom;
  }

  public extrudeDownSelected() {
    if (!this.selectedObject) return;
    const target = this.selectedObject;

    const originalGeoms = new Map<string, { geometry: THREE.BufferGeometry; pos: THREE.Vector3; rot: THREE.Euler; scl: THREE.Vector3 }>();
    target.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalGeoms.set(child.uuid, {
          geometry: child.geometry.clone(),
          pos: child.position.clone(),
          rot: child.rotation.clone(),
          scl: child.scale.clone()
        });
      }
    });

    const cmd: Command = {
      name: `Extrude Down ${target.name}`,
      execute: () => {
        target.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const extruded = this.extrudeDownGeometry(child, 0);
            child.geometry.dispose();
            child.geometry = extruded;
            child.position.set(0, 0, 0);
            child.rotation.set(0, 0, 0);
            child.scale.set(1, 1, 1);
          }
        });
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: target });
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        target.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const orig = originalGeoms.get(child.uuid);
            if (orig) {
              child.geometry.dispose();
              child.geometry = orig.geometry.clone();
              child.position.copy(orig.pos);
              child.rotation.copy(orig.rot);
              child.scale.copy(orig.scl);
            }
          }
        });
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: target });
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  private hollowGeometry(geometry: THREE.BufferGeometry, thickness: number): THREE.BufferGeometry {
    const outer = geometry.clone();
    const posAttr = outer.getAttribute('position');
    const normAttr = outer.getAttribute('normal');
    const uvAttr = outer.getAttribute('uv');

    if (!posAttr || !normAttr) return outer;

    const count = posAttr.count;

    const innerPositions: number[] = [];
    const innerNormals: number[] = [];
    const innerUvs: number[] = [];

    for (let i = 0; i < count; i++) {
      const px = posAttr.getX(i);
      const py = posAttr.getY(i);
      const pz = posAttr.getZ(i);

      const nx = normAttr.getX(i);
      const ny = normAttr.getY(i);
      const nz = normAttr.getZ(i);

      const ix = px - nx * thickness;
      const iy = py - ny * thickness;
      const iz = pz - nz * thickness;

      innerPositions.push(ix, iy, iz);
      innerNormals.push(-nx, -ny, -nz);

      if (uvAttr) {
        innerUvs.push(uvAttr.getX(i), uvAttr.getY(i));
      } else {
        innerUvs.push(0, 0);
      }
    }

    const outerPos: number[] = [];
    const outerNorm: number[] = [];
    const outerUv: number[] = [];

    let indices: ArrayLike<number> | null = null;
    if (geometry.index) {
      indices = geometry.index.array;
    }

    const totalIndices = indices ? indices.length : count;

    for (let i = 0; i < totalIndices; i += 3) {
      const idx0 = indices ? indices[i] : i;
      const idx1 = indices ? indices[i + 1] : i + 1;
      const idx2 = indices ? indices[i + 2] : i + 2;

      outerPos.push(posAttr.getX(idx0), posAttr.getY(idx0), posAttr.getZ(idx0));
      outerPos.push(posAttr.getX(idx1), posAttr.getY(idx1), posAttr.getZ(idx1));
      outerPos.push(posAttr.getX(idx2), posAttr.getY(idx2), posAttr.getZ(idx2));

      outerNorm.push(normAttr.getX(idx0), normAttr.getY(idx0), normAttr.getZ(idx0));
      outerNorm.push(normAttr.getX(idx1), normAttr.getY(idx1), normAttr.getZ(idx1));
      outerNorm.push(normAttr.getX(idx2), normAttr.getY(idx2), normAttr.getZ(idx2));

      outerUv.push(uvAttr ? uvAttr.getX(idx0) : 0, uvAttr ? uvAttr.getY(idx0) : 0);
      outerUv.push(uvAttr ? uvAttr.getX(idx1) : 0, uvAttr ? uvAttr.getY(idx1) : 0);
      outerUv.push(uvAttr ? uvAttr.getX(idx2) : 0, uvAttr ? uvAttr.getY(idx2) : 0);

      outerPos.push(innerPositions[idx0 * 3], innerPositions[idx0 * 3 + 1], innerPositions[idx0 * 3 + 2]);
      outerPos.push(innerPositions[idx2 * 3], innerPositions[idx2 * 3 + 1], innerPositions[idx2 * 3 + 2]);
      outerPos.push(innerPositions[idx1 * 3], innerPositions[idx1 * 3 + 1], innerPositions[idx1 * 3 + 2]);

      outerNorm.push(innerNormals[idx0 * 3], innerNormals[idx0 * 3 + 1], innerNormals[idx0 * 3 + 2]);
      outerNorm.push(innerNormals[idx2 * 3], innerNormals[idx2 * 3 + 1], innerNormals[idx2 * 3 + 2]);
      outerNorm.push(innerNormals[idx1 * 3], innerNormals[idx1 * 3 + 1], innerNormals[idx1 * 3 + 2]);

      outerUv.push(innerUvs[idx0 * 2], innerUvs[idx0 * 2 + 1]);
      outerUv.push(innerUvs[idx2 * 2], innerUvs[idx2 * 2 + 1]);
      outerUv.push(innerUvs[idx1 * 2], innerUvs[idx1 * 2 + 1]);
    }

    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute('position', new THREE.Float32BufferAttribute(outerPos, 3));
    newGeom.setAttribute('normal', new THREE.Float32BufferAttribute(outerNorm, 3));
    newGeom.setAttribute('uv', new THREE.Float32BufferAttribute(outerUv, 2));

    return newGeom;
  }

  public hollowSelected(thickness: number) {
    if (!this.selectedObject) return;
    const target = this.selectedObject;

    const originalGeoms = new Map<string, THREE.BufferGeometry>();
    target.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalGeoms.set(child.uuid, child.geometry.clone());
      }
    });

    const cmd: Command = {
      name: `Hollow ${target.name}`,
      execute: () => {
        target.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const orig = originalGeoms.get(child.uuid);
            if (orig) {
              const hollowed = this.hollowGeometry(orig, thickness);
              child.geometry.dispose();
              child.geometry = hollowed;
            }
          }
        });
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: target });
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        target.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const orig = originalGeoms.get(child.uuid);
            if (orig) {
              child.geometry.dispose();
              child.geometry = orig.clone();
            }
          }
        });
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: target });
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  public splitSelected(ratio: number, keepMode: 'top' | 'bottom' | 'both') {
    if (!this.selectedObject) return;
    const target = this.selectedObject;

    const bbox = new THREE.Box3().setFromObject(target);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    const cutY = bbox.min.y + size.y * ratio;

    const boxWidth = Math.max(100, size.x * 10);
    const boxDepth = Math.max(100, size.z * 10);
    const boxHeight = Math.max(100, size.y * 10);

    const topBoxGeom = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
    const topBoxMesh = new THREE.Mesh(topBoxGeom);
    topBoxMesh.position.set(center.x, cutY + boxHeight / 2, center.z);
    topBoxMesh.updateMatrixWorld(true);

    const bottomBoxGeom = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
    const bottomBoxMesh = new THREE.Mesh(bottomBoxGeom);
    bottomBoxMesh.position.set(center.x, cutY - boxHeight / 2, center.z);
    bottomBoxMesh.updateMatrixWorld(true);

    const targetCSG = this.objectToCSG(target);
    const topCSG = fromGeometry(topBoxMesh.geometry, topBoxMesh.matrixWorld);
    const bottomCSG = fromGeometry(bottomBoxMesh.geometry, bottomBoxMesh.matrixWorld);

    const primaryColor = (target as any).material?.color?.getHexString() ? '#' + (target as any).material.color.getHexString() : this.activeColor;
    const primaryStyle = (target as any).materialStyle || this.activeMaterialStyle;
    const mat = this.createMaterialFromStyle(primaryColor, primaryStyle);

    let topResultMesh: THREE.Mesh | null = null;
    let bottomResultMesh: THREE.Mesh | null = null;

    if (keepMode === 'top' || keepMode === 'both') {
      const topInter = intersect(targetCSG, topCSG);
      const geom = toGeometry(topInter);
      if (geom.getAttribute('position') && geom.getAttribute('position').count > 0) {
        topResultMesh = new THREE.Mesh(geom, mat);
        topResultMesh.name = `${target.name} (Top)`;
        topResultMesh.castShadow = true;
        topResultMesh.receiveShadow = true;
      }
    }

    if (keepMode === 'bottom' || keepMode === 'both') {
      const bottomInter = intersect(targetCSG, bottomCSG);
      const geom = toGeometry(bottomInter);
      if (geom.getAttribute('position') && geom.getAttribute('position').count > 0) {
        bottomResultMesh = new THREE.Mesh(geom, mat);
        bottomResultMesh.name = `${target.name} (Bottom)`;
        bottomResultMesh.castShadow = true;
        bottomResultMesh.receiveShadow = true;
      }
    }

    const cmd: Command = {
      name: `Split ${target.name}`,
      execute: () => {
        this.scene.remove(target);

        if (keepMode === 'both') {
          const newSelection: THREE.Object3D[] = [];
          if (bottomResultMesh) {
            this.scene.add(bottomResultMesh);
            newSelection.push(bottomResultMesh);
          }
          if (topResultMesh) {
            this.scene.add(topResultMesh);
            topResultMesh.position.y += 0.5;
            newSelection.push(topResultMesh);
          }
          this.selectedObjects = newSelection;
        } else if (keepMode === 'top' && topResultMesh) {
          this.scene.add(topResultMesh);
          this.selectedObjects = [topResultMesh];
        } else if (keepMode === 'bottom' && bottomResultMesh) {
          this.scene.add(bottomResultMesh);
          this.selectedObjects = [bottomResultMesh];
        } else {
          this.scene.add(target);
          this.selectedObjects = [target];
        }

        this.onSelectionChanged();
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        if (topResultMesh) this.scene.remove(topResultMesh);
        if (bottomResultMesh) this.scene.remove(bottomResultMesh);
        this.scene.add(target);
        this.selectedObjects = [target];
        this.onSelectionChanged();
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
    topBoxGeom.dispose();
    bottomBoxGeom.dispose();
  }

  public showCuttingPlane(ratio: number) {
    if (!this.selectedObject) return;
    const target = this.selectedObject;
    const bbox = new THREE.Box3().setFromObject(target);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    const cutY = bbox.min.y + size.y * ratio;
    const planeSize = Math.max(10, size.x * 2, size.z * 2);

    if (!this.cuttingPlaneHelper) {
      this.cuttingPlaneHelper = new THREE.GridHelper(planeSize, 20, 0xff00ff, 0xff00ff);
      const mat = this.cuttingPlaneHelper.material as THREE.LineBasicMaterial;
      mat.opacity = 0.6;
      mat.transparent = true;
      this.scene.add(this.cuttingPlaneHelper);
    }

    this.cuttingPlaneHelper.position.set(center.x, cutY, center.z);
    this.cuttingPlaneHelper.visible = true;
  }

  public hideCuttingPlane() {
    if (this.cuttingPlaneHelper) {
      this.scene.remove(this.cuttingPlaneHelper);
      this.cuttingPlaneHelper = null;
    }
  }

  // 10. Core Control APIs (Used by React)

  public setTool(tool: EditorTool) {
    if (this.activeTool === tool) return;
    this.activeTool = tool;

    // Attach / Detach transform controls based on tool mode
    if (this.selectedObject && ['translate', 'rotate', 'scale'].includes(tool)) {
      this.transformControls.attach(this.selectedObject);
      (this.transformControls as any).visible = true;

      if (tool === 'translate') this.transformControls.setMode('translate');
      if (tool === 'rotate') this.transformControls.setMode('rotate');
      if (tool === 'scale') this.transformControls.setMode('scale');
    } else {
      this.transformControls.detach();
      (this.transformControls as any).visible = false;
    }

    // Hide preview mesh when leaving shape tool
    if (tool !== 'shape') {
      this.previewMesh.visible = false;
      this.dispatchEvent({ type: 'cursor-moved', point: null });
    }

    this.dispatchEvent({ type: 'tool-changed', tool });
  }

  public updateSelectedObjectProperties(props: {
    name?: string;
    posX?: number;
    posY?: number;
    posZ?: number;
    rotX?: number;
    rotY?: number;
    rotZ?: number;
    sclX?: number;
    sclY?: number;
    sclZ?: number;
    color?: string;
    style?: MaterialStyle;
  }) {
    if (!this.selectedObject) return;
    const mesh = this.selectedObject;

    const oldName = mesh.name;
    const oldPos = mesh.position.clone();
    const oldRot = mesh.rotation.clone();
    const oldScl = mesh.scale.clone();
    
    const oldMaterials = new Map<string, THREE.Material | THREE.Material[]>();
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        oldMaterials.set(child.uuid, child.material);
      }
    });

    const newMaterial = props.color || props.style 
      ? this.createMaterialFromStyle(props.color || this.activeColor, props.style || this.activeMaterialStyle)
      : null;

    const cmd: Command = {
      name: `Modify ${mesh.name}`,
      execute: () => {
        if (props.name !== undefined) mesh.name = props.name;
        if (props.posX !== undefined) mesh.position.x = props.posX;
        if (props.posY !== undefined) mesh.position.y = props.posY;
        if (props.posZ !== undefined) mesh.position.z = props.posZ;
        if (props.rotX !== undefined) mesh.rotation.x = THREE.MathUtils.degToRad(props.rotX);
        if (props.rotY !== undefined) mesh.rotation.y = THREE.MathUtils.degToRad(props.rotY);
        if (props.rotZ !== undefined) mesh.rotation.z = THREE.MathUtils.degToRad(props.rotZ);
        if (props.sclX !== undefined) mesh.scale.x = props.sclX;
        if (props.sclY !== undefined) mesh.scale.y = props.sclY;
        if (props.sclZ !== undefined) mesh.scale.z = props.sclZ;
        if (newMaterial) {
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = newMaterial;
            }
          });
        }
        
        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: mesh });
        this.dispatchEvent({ type: 'scene-changed' });
      },
      undo: () => {
        mesh.name = oldName;
        mesh.position.copy(oldPos);
        mesh.rotation.copy(oldRot);
        mesh.scale.copy(oldScl);
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = oldMaterials.get(child.uuid);
            if (mat) child.material = mat;
          }
        });

        this.updateSelectionHelper();
        this.dispatchEvent({ type: 'object-modified', object: mesh });
        this.dispatchEvent({ type: 'scene-changed' });
      }
    };

    this.historyManager.execute(cmd);
  }

  // Load preset templates
  public loadTemplate(type: 'castle' | 'room' | 'playground' | 'empty') {
    // Clear current scene
    this.selectMesh(null);
    this.historyManager.clear();
    this.clearHoverHighlight();

    const toRemove: THREE.Object3D[] = [];
    this.scene.children.forEach((child) => {
      if (
        child !== (this.gridHelper as any) && 
        child !== (this.selectionBoxHelper as any) &&
        child !== (this.hoverBoxHelper as any) &&
        child !== this.previewMesh &&
        child instanceof THREE.Mesh
      ) {
        toRemove.push(child);
      }
    });

    toRemove.forEach(mesh => this.scene.remove(mesh));

    if (type === 'castle') {
      import('./TemplateManager').then(({ TemplateManager }) => {
        TemplateManager.createCastle(this.scene, () => {});
        this.dispatchEvent({ type: 'scene-changed' });
      });
    } else if (type === 'room') {
      import('./TemplateManager').then(({ TemplateManager }) => {
        TemplateManager.createRoom(this.scene, () => {});
        this.dispatchEvent({ type: 'scene-changed' });
      });
    } else if (type === 'playground') {
      import('./TemplateManager').then(({ TemplateManager }) => {
        TemplateManager.createPlayground(this.scene, () => {});
        this.dispatchEvent({ type: 'scene-changed' });
      });
    } else {
      this.dispatchEvent({ type: 'scene-changed' });
    }

    // Party confetti for fun loading
    if (type !== 'empty') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  }

  // Export Scene to GLTF
  public exportGLTF() {
    const exporter = new GLTFExporter();
    const exportGroup = new THREE.Group();
    
    this.scene.children.forEach((child) => {
      if (
        child !== (this.gridHelper as any) && 
        child !== (this.selectionBoxHelper as any) &&
        child !== (this.hoverBoxHelper as any) &&
        child !== this.previewMesh &&
        child instanceof THREE.Mesh
      ) {
        exportGroup.add(child.clone());
      }
    });

    exporter.parse(
      exportGroup,
      (gltf) => {
        const output = JSON.stringify(gltf, null, 2);
        this.downloadFile(output, 'model-export.gltf', 'application/json');

        // Confetti celebration
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#00f0ff', '#3b82f6', '#8b5cf6', '#ffffff']
        });
      },
      (error) => {
        console.error('An error happened during GLTF export', error);
      },
      { binary: false }
    );
  }

  public exportDXF() {
    const meshes = this.getMeshes();
    if (meshes.length === 0) {
      alert("Scene is empty. Add shapes before exporting.");
      return;
    }

    let dxfContent = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";

    // Keep track of exported lines to avoid duplicates
    const exportedLines = new Set<string>();
    const roundVal = (v: number) => parseFloat(v.toFixed(4));

    meshes.forEach((obj) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geom = child.geometry;
          const matrix = child.matrixWorld;
          const posAttr = geom.getAttribute('position');
          if (!posAttr) return;

          let indices: ArrayLike<number> | null = null;
          if (geom.index) {
            indices = geom.index.array;
          }

          const count = indices ? indices.length : posAttr.count;

          for (let i = 0; i < count; i += 3) {
            const idx0 = indices ? indices[i] : i;
            const idx1 = indices ? indices[i + 1] : i + 1;
            const idx2 = indices ? indices[i + 2] : i + 2;

            const v0 = new THREE.Vector3(posAttr.getX(idx0), posAttr.getY(idx0), posAttr.getZ(idx0)).applyMatrix4(matrix);
            const v1 = new THREE.Vector3(posAttr.getX(idx1), posAttr.getY(idx1), posAttr.getZ(idx1)).applyMatrix4(matrix);
            const v2 = new THREE.Vector3(posAttr.getX(idx2), posAttr.getY(idx2), posAttr.getZ(idx2)).applyMatrix4(matrix);

            // Project to 2D (X-Y plane, looking from front)
            const addLine = (pA: THREE.Vector3, pB: THREE.Vector3) => {
              const ax = roundVal(pA.x);
              const ay = roundVal(pA.y);
              const bx = roundVal(pB.x);
              const by = roundVal(pB.y);

              // Don't add zero-length lines
              if (Math.abs(ax - bx) < 1e-4 && Math.abs(ay - by) < 1e-4) return;

              // Unique key (sort coords to treat A->B and B->A as same)
              const key = ax < bx || (ax === bx && ay < by)
                ? `${ax},${ay}_${bx},${by}`
                : `${bx},${by}_${ax},${ay}`;

              if (exportedLines.has(key)) return;
              exportedLines.add(key);

              // Write line entity in DXF
              dxfContent += "0\nLINE\n8\n0\n"; // Entity type LINE, Layer 0
              dxfContent += `10\n${ax}\n20\n${ay}\n30\n0.0\n`; // Start point (X, Y, Z=0)
              dxfContent += `11\n${bx}\n21\n${by}\n31\n0.0\n`; // End point (X, Y, Z=0)
            };

            addLine(v0, v1);
            addLine(v1, v2);
            addLine(v2, v0);
          }
        }
      });
    });

    dxfContent += "0\nENDSEC\n0\nEOF\n";

    this.downloadFile(dxfContent, 'layout-export.dxf', 'image/vnd.dxf');
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }

  private downloadFile(content: string, fileName: string, contentType: string) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Apply view filter settings to the scene
  public updateViewFilters() {
    // 1. Grid Helper
    if (this.gridHelper) {
      this.gridHelper.visible = this.gridEnabled;
    }

    // 2. Shadows (toggle light shadow casting)
    this.renderer.shadowMap.enabled = this.shadowsEnabled;
    this.scene.traverse((child) => {
      if (child instanceof THREE.DirectionalLight) {
        child.castShadow = this.shadowsEnabled;
      }
    });

    // 3. Traverse all meshes in the scene and apply filter overrides
    const meshes = this.getMeshes();
    meshes.forEach((obj) => {
      obj.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = child.material as any;
        if (!mat) return;

        // Backup original material settings
        if (!child.userData.originalMaterialSettings) {
          child.userData.originalMaterialSettings = {
            colorHex: '#' + mat.color.getHexString(),
            roughness: mat.roughness,
            metalness: mat.metalness,
            transmission: mat.transmission,
            opacity: mat.opacity,
            transparent: mat.transparent,
            side: mat.side,
            flatShading: mat.flatShading,
            wireframe: mat.wireframe,
          };
        }

        const orig = child.userData.originalMaterialSettings;

        // Apply Shading
        if (!this.shadingEnabled) {
          if (!(child.material instanceof THREE.MeshBasicMaterial)) {
            child.material = new THREE.MeshBasicMaterial({
              color: this.colorsEnabled ? new THREE.Color(orig.colorHex) : new THREE.Color('#ffffff'),
              wireframe: this.wireframeEnabled,
            });
          }
        } else {
          // Restore standard / physical
          let targetMat = child.material;
          if (child.material instanceof THREE.MeshBasicMaterial) {
            targetMat = this.createMaterialFromStyle(orig.colorHex, this.activeMaterialStyle);
            child.material = targetMat;
          }

          const standardMat = targetMat as any;
          if (standardMat.color) {
            standardMat.color.copy(this.colorsEnabled ? new THREE.Color(orig.colorHex) : new THREE.Color('#ffffff'));
          }

          // Apply Smoothing
          standardMat.flatShading = !this.smoothingEnabled;

          // Apply Reflections
          if (!this.reflectionsEnabled) {
            standardMat.metalness = 0;
            standardMat.roughness = 1;
          } else {
            standardMat.metalness = orig.metalness;
            standardMat.roughness = orig.roughness;
          }

          // Apply Wireframe
          standardMat.wireframe = this.wireframeEnabled;

          // Apply X-ray
          if (this.xrayEnabled) {
            standardMat.transparent = true;
            standardMat.opacity = 0.3;
            standardMat.side = THREE.DoubleSide;
            standardMat.depthWrite = false;
          } else {
            standardMat.transparent = orig.transparent;
            standardMat.opacity = orig.opacity;
            standardMat.side = orig.side;
            standardMat.depthWrite = true;
          }

          standardMat.needsUpdate = true;
        }
      });
    });
  }

  // Get active meshes/groups inside the scene
  public getMeshes(): THREE.Object3D[] {
    return this.scene.children.filter(child => 
      child !== (this.gridHelper as any) && 
      child !== (this.selectionBoxHelper as any) &&
      child !== (this.hoverBoxHelper as any) &&
      child !== this.previewMesh &&
      (child instanceof THREE.Mesh || child instanceof THREE.Group)
    );
  }

  // 11. Resize and Render loop
  public handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height, false);
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this));

    this.orbitControls.update();
    
    // Make sure box helpers track meshes being resized/transformed
    this.updateSelectionHelper();
    if (this.hoverBoxHelper) {
      this.hoverBoxHelper.update();
    }

    // Fade out emissive glowing selections / creations over time
    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && (child.material as any).emissive) {
        const emissive = (child.material as any).emissive;
        if (emissive.r > 0.01 || emissive.g > 0.01 || emissive.b > 0.01) {
          emissive.lerp(new THREE.Color(0, 0, 0), 0.05); // fade out glow
        }
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  // Utility to generate unique names
  private getNextMeshId(shapeName: string): number {
    const matches = this.scene.children.filter(child => 
      child.name && child.name.toLowerCase().startsWith(shapeName.toLowerCase())
    );
    return matches.length + 1;
  }
}
