import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { HistoryManager } from './HistoryManager';
import type { Command } from './HistoryManager';
import confetti from 'canvas-confetti';

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
    this.scene.add(this.transformControls.getHelper());

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
