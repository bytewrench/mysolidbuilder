import { useState, useEffect, useRef } from 'react';
import { Viewport } from './components/Viewport';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { MeasurementsHUD } from './components/MeasurementsHUD';
import { WelcomeModal } from './components/WelcomeModal';
import { LandingPage } from './components/LandingPage';
import { EditorEngine } from './engine/EditorEngine';
import { 
  HelpCircle, 
  Sparkles,
  PlusCircle,
  FolderOpen,
  Save,
  Printer,
  FileText,
  X,
  Activity,
  Trash2,
  HardDrive
} from 'lucide-react';
import * as THREE from 'three';

function App() {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [engine, setEngine] = useState<EditorEngine | null>(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);
  const [tutorialStep, setTutorialStep] = useState<string | null>(null);
  
  // Left drawer & modal state
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [saveName, setSaveName] = useState('New Project');
  const [savedProjects, setSavedProjects] = useState<string[]>([]);
  
  // Statistics State
  const [stats, setStats] = useState({
    name: 'Scene',
    vertices: 0,
    triangles: 0,
    width: 0,
    height: 0,
    depth: 0,
    volume: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEngineReady = (editorEngine: EditorEngine) => {
    setEngine(editorEngine);
  };

  useEffect(() => {
    // Load saved projects list
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ms_project_')) {
        keys.push(key.replace('ms_project_', ''));
      }
    }
    setSavedProjects(keys);
  }, []);

  useEffect(() => {
    if (!engine) return;

    const handleSceneChange = () => {
      if (tutorialStep === 'click-grid') {
        setTutorialStep('click-move-btn');
      }
    };

    (engine as any).addEventListener('scene-changed', handleSceneChange);

    return () => {
      (engine as any).removeEventListener('scene-changed', handleSceneChange);
    };
  }, [engine, tutorialStep]);

  // 1. File -> New Scene
  const handleNewScene = () => {
    if (confirm('Create a new scene? All unsaved changes will be lost.')) {
      engine?.loadTemplate('empty');
      setIsLeftMenuOpen(false);
    }
  };

  // 2. File -> Open (Local File STL/OBJ/GLTF)
  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engine) return;
    setIsLeftMenuOpen(false);

    const extension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    try {
      if (extension === 'gltf' || extension === 'glb') {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        reader.onload = (event) => {
          const buffer = event.target?.result as ArrayBuffer;
          const loader = new GLTFLoader();
          loader.parse(buffer, '', (gltf) => {
            // Add imported model to scene
            gltf.scene.name = file.name;
            gltf.scene.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Add default name if missing
                if (!child.name) child.name = file.name;
              }
            });
            engine.scene.add(gltf.scene);
            engine.selectMesh(gltf.scene);
            (engine as any).dispatchEvent({ type: 'scene-changed' });
          }, (error) => {
            console.error(error);
            alert('Failed to parse GLTF file.');
          });
        };
        reader.readAsArrayBuffer(file);

      } else if (extension === 'stl') {
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
        reader.onload = (event) => {
          const buffer = event.target?.result as ArrayBuffer;
          const loader = new STLLoader();
          const geometry = loader.parse(buffer);
          const material = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color(engine.activeColor),
            roughness: 0.5,
            metalness: 0.2
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = file.name.replace('.stl', '');
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          // Align geometry center
          mesh.geometry.center();
          mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox) {
            const height = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
            mesh.position.y = height / 2;
          }

          engine.scene.add(mesh);
          engine.selectMesh(mesh);
          (engine as any).dispatchEvent({ type: 'scene-changed' });
        };
        reader.readAsArrayBuffer(file);

      } else if (extension === 'obj') {
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const loader = new OBJLoader();
          const obj = loader.parse(text);
          obj.name = file.name.replace('.obj', '');
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.material = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(engine.activeColor),
                roughness: 0.5,
                metalness: 0.2
              });
            }
          });
          engine.scene.add(obj);
          engine.selectMesh(obj);
          (engine as any).dispatchEvent({ type: 'scene-changed' });
        };
        reader.readAsText(file);
      } else {
        alert('Unsupported file format. Please upload .gltf, .glb, .stl, or .obj files.');
      }
    } catch (err) {
      console.error(err);
      alert('Error loading file: ' + err);
    }

    // Reset input
    e.target.value = '';
  };

  // 3. File -> Save As Named Slot
  const handleSaveAsClick = () => {
    setIsLeftMenuOpen(false);
    setIsSaveAsOpen(true);
  };

  const executeSaveAs = () => {
    if (!engine) return;
    const meshes = engine.getMeshes();
    const sceneData = meshes.map(mesh => ({
      name: mesh.name,
      geometryType: (mesh as any).geometry?.type,
      parameters: ((mesh as any).geometry as any)?.parameters || {},
      position: [mesh.position.x, mesh.position.y, mesh.position.z],
      rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
      scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
      color: '#' + ((mesh as any).material as any)?.color?.getHexString(),
      style: ((mesh as any).material as any)?.transmission > 0.5 ? 'glass' :
             ((mesh as any).material as any)?.metalness > 0.8 ? 'metal' :
             ((mesh as any).material as any)?.roughness > 0.8 ? 'matte' : 'standard'
    }));

    localStorage.setItem(`ms_project_${saveName}`, JSON.stringify(sceneData));
    
    // Add to project list
    if (!savedProjects.includes(saveName)) {
      setSavedProjects([...savedProjects, saveName]);
    }
    
    setIsSaveAsOpen(false);
    alert(`Project "${saveName}" saved successfully!`);
  };

  // 4. File -> Load slot
  const handleLoadSlot = (name: string) => {
    if (!engine) return;
    const dataStr = localStorage.getItem(`ms_project_${name}`);
    if (!dataStr) return;

    try {
      const sceneData = JSON.parse(dataStr);
      engine.selectMesh(null);
      engine.historyManager.clear();

      // Clear existing
      const existing = engine.getMeshes();
      existing.forEach(mesh => engine.scene.remove(mesh));

      // Recreate
      sceneData.forEach((item: any) => {
        let geom: THREE.BufferGeometry;
        const p = item.parameters || {};

        if (item.geometryType === 'SphereGeometry') {
          geom = new THREE.SphereGeometry(p.radius || 1, p.widthSegments || 32, p.heightSegments || 16);
        } else if (item.geometryType === 'CylinderGeometry') {
          geom = new THREE.CylinderGeometry(p.radiusTop || 1, p.radiusBottom || 1, p.height || 2, p.radialSegments || 16);
        } else if (item.geometryType === 'ConeGeometry') {
          geom = new THREE.ConeGeometry(p.radius || 1, p.height || 2, p.radialSegments || 16);
        } else if (item.geometryType === 'TorusGeometry') {
          geom = new THREE.TorusGeometry(p.radius || 1, p.tube || 0.3, p.radialSegments || 16, p.tubularSegments || 64);
        } else {
          geom = new THREE.BoxGeometry(p.width || 2, p.height || 2, p.depth || 2);
        }

        const color = new THREE.Color(item.color);
        let material: THREE.Material;
        
        if (item.style === 'matte') {
          material = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.05 });
        } else if (item.style === 'metal') {
          material = new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.95 });
        } else if (item.style === 'glass') {
          material = new THREE.MeshPhysicalMaterial({
            color,
            roughness: 0.1,
            transmission: 0.9,
            thickness: 1.0,
            transparent: true,
            opacity: 1
          });
        } else {
          material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
        }

        const mesh = new THREE.Mesh(geom, material);
        mesh.name = item.name;
        mesh.position.set(item.position[0], item.position[1], item.position[2]);
        mesh.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
        mesh.scale.set(item.scale[0], item.scale[1], item.scale[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        engine.scene.add(mesh);
      });

      (engine as any).dispatchEvent({ type: 'scene-changed' });
      setIsLeftMenuOpen(false);
      alert(`Project "${name}" loaded successfully!`);
    } catch (err) {
      console.error(err);
      alert('Error loading project.');
    }
  };

  // 5. File -> 3D Print (STL Exporter)
  const handle3DPrint = async () => {
    if (!engine) return;
    setIsLeftMenuOpen(false);

    try {
      const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
      const exporter = new STLExporter();
      
      // Export all meshes grouped together
      const exportGroup = new THREE.Group();
      const meshes = engine.getMeshes();
      
      if (meshes.length === 0) {
        alert('Scene is empty. Please add objects before printing.');
        return;
      }

      meshes.forEach(m => exportGroup.add(m.clone()));
      const result = exporter.parse(exportGroup, { binary: true });
      
      const blob = new Blob([result], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'model-for-print.stl';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error(err);
      alert('Error generating STL: ' + err);
    }
  };

  // 6. File -> Print on Paper
  const handlePrintPaper = () => {
    if (!engine) return;
    setIsLeftMenuOpen(false);

    // Capture render output
    const url = engine.renderer.domElement.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>MySolidBuilder 3D Print Capture</title>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; }
              img { max-width: 90%; max-height: 90%; border: 4px solid #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            </style>
          </head>
          <body>
            <img src="${url}" />
          </body>
        </html>
      `);
      win.document.close();
      setTimeout(() => {
        win.print();
        win.close();
      }, 500);
    }
  };

  // 7. File -> About this model
  const handleAboutClick = () => {
    if (!engine) return;
    setIsLeftMenuOpen(false);

    let verts = 0;
    let tris = 0;
    let name = 'Whole Scene';

    const currentMesh = engine.selectedObject;
    const targetObjects = currentMesh ? [currentMesh] : engine.getMeshes();

    if (currentMesh) {
      name = currentMesh.name;
    }

    // Measure bounding box bounds
    const bbox = new THREE.Box3();
    targetObjects.forEach((obj) => {
      bbox.expandByObject(obj);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geo = child.geometry as THREE.BufferGeometry;
          if (geo.attributes.position) {
            verts += geo.attributes.position.count;
            tris += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
          }
        }
      });
    });

    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Quick volume estimate
    const volume = size.x * size.y * size.z;

    setStats({
      name,
      vertices: verts,
      triangles: Math.round(tris),
      width: parseFloat(size.x.toFixed(2)),
      height: parseFloat(size.y.toFixed(2)),
      depth: parseFloat(size.z.toFixed(2)),
      volume: parseFloat(volume.toFixed(2))
    });

    setIsAboutOpen(true);
  };

  const handleDeleteSlot = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete project "${name}"?`)) {
      localStorage.removeItem(`ms_project_${name}`);
      setSavedProjects(savedProjects.filter(p => p !== name));
    }
  };

  if (view === 'landing') {
    return <LandingPage onLaunch={() => setView('app')} />;
  }

  return (
    <div className="workspace-container">
      {/* Top Navigation */}
      <Topbar 
        engine={engine} 
        onOpenHelp={() => setIsWelcomeOpen(true)} 
        onExit={() => setView('landing')} 
        onToggleLeftMenu={() => setIsLeftMenuOpen(!isLeftMenuOpen)}
      />

      {/* Main Workspace Layout */}
      <div className="main-layout">
        
        {/* Central Viewport */}
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
          
          {/* Floating Help Me Button */}
          <button 
            className="btn-action primary" 
            style={{ 
              position: 'absolute', 
              top: '20px', 
              left: '20px', 
              zIndex: 90,
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
              color: 'var(--bg-dark)',
              border: 'none',
              boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)',
              padding: '10px 20px',
              borderRadius: '20px',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
            onClick={() => setTutorialStep('click-cube-btn')}
          >
            <HelpCircle size={16} />
            Help Me
          </button>

          {/* Floating Tutorial Guide Overlay Box */}
          {tutorialStep && (
            <div className="glass-panel glass-panel-cyan" style={{
              position: 'absolute',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 95,
              padding: '16px 20px',
              width: '380px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Sparkles size={16} color="var(--accent-cyan)" />
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Interactive Tutorial
                </h4>
              </div>
              
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {tutorialStep === 'click-cube-btn' && "Step 1: Click the Cube icon on the bottom toolbar to prepare to build a block."}
                {tutorialStep === 'click-grid' && "Step 2: Move your mouse onto the grid floor to see a live coordinate preview, then click to place the block."}
                {tutorialStep === 'click-move-btn' && "Step 3: Great job! The block has been built and is glowing. Now, click the Move Tool (arrows) on the toolbar to activate it."}
                {tutorialStep === 'tutorial-complete' && "Tutorial Complete! You have successfully built a 3D block. Drag the blue, green, or red arrows on the block to move it in space."}
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                {tutorialStep === 'tutorial-complete' ? (
                  <button className="btn-action primary" style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={() => setTutorialStep(null)}>
                    Close
                  </button>
                ) : (
                  <button className="btn-action" style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={() => setTutorialStep(null)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          <Viewport onEngineReady={handleEngineReady} />
          
          {/* Bottom Editor Toolbar */}
          <Toolbar 
            engine={engine} 
            tutorialStep={tutorialStep} 
            setTutorialStep={setTutorialStep} 
          />

          {/* Measurements Value Control Box HUD */}
          <MeasurementsHUD engine={engine} />
        </div>

        {/* Right Properties Panel */}
        <Sidebar engine={engine} />
      </div>

      {/* Hidden File Picker Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden-file-input" 
        accept=".gltf,.glb,.stl,.obj"
      />

      {/* LEFT HAMBURGER MENU DRAWER */}
      {isLeftMenuOpen && (
        <div className="left-drawer-overlay" onClick={() => setIsLeftMenuOpen(false)}>
          <div className="left-drawer-panel" onClick={(e) => e.stopPropagation()}>
            
            <div className="left-drawer-header">
              <h3 className="left-drawer-title">FILE MENU</h3>
              <button className="btn-icon" style={{ width: '32px', height: '32px', border: 'none' }} onClick={() => setIsLeftMenuOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="left-drawer-menu">
              
              <button className="left-drawer-menu-item" onClick={handleNewScene}>
                <PlusCircle size={16} />
                <span>New scene</span>
              </button>

              <button className="left-drawer-menu-item" onClick={handleOpenClick}>
                <FolderOpen size={16} />
                <span>Open local file</span>
              </button>

              <button className="left-drawer-menu-item" onClick={handleSaveAsClick}>
                <Save size={16} />
                <span>Save as...</span>
              </button>

              <button className="left-drawer-menu-item" onClick={handle3DPrint}>
                <Printer size={16} />
                <span>3D Print (Export STL)</span>
              </button>

              <button className="left-drawer-menu-item" onClick={handlePrintPaper}>
                <Printer size={16} />
                <span>Print on paper</span>
              </button>

              <button className="left-drawer-menu-item" onClick={handleAboutClick}>
                <FileText size={16} />
                <span>About this model</span>
              </button>

              <div style={{ height: '1px', background: 'var(--border-light)', margin: '12px 24px' }} />
              
              {/* Saved Slots Header */}
              <div style={{ padding: '0 24px 6px 24px', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Saved Projects Slots
              </div>

              {savedProjects.length === 0 ? (
                <div style={{ padding: '8px 24px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  No saved slot. Use "Save as..." to create one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '180px', overflowY: 'auto' }}>
                  {savedProjects.map(name => (
                    <div 
                      key={name} 
                      className="left-drawer-menu-item" 
                      style={{ justifyContent: 'space-between', padding: '10px 24px' }}
                      onClick={() => handleLoadSlot(name)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <HardDrive size={14} color="var(--accent-cyan)" />
                        <span style={{ fontSize: '0.8rem' }}>{name}</span>
                      </div>
                      <button 
                        className="hierarchy-item-btn delete" 
                        onClick={(e) => handleDeleteSlot(name, e)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>

            <div className="left-drawer-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <Activity size={12} color="var(--accent-cyan)" />
                <span>Engine Active | WebGL 2.0</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SAVE AS MODAL */}
      {isSaveAsOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Save Project As</h3>
              <button className="btn-icon" style={{ border: 'none', width: '32px', height: '32px' }} onClick={() => setIsSaveAsOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Project Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={saveName} 
                  onChange={(e) => setSaveName(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn-action" onClick={() => setIsSaveAsOpen(false)}>
                  Cancel
                </button>
                <button className="btn-action primary" onClick={executeSaveAs}>
                  Save Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABOUT THIS MODEL MODAL */}
      {isAboutOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>About This Model</h3>
              <button className="btn-icon" style={{ border: 'none', width: '32px', height: '32px' }} onClick={() => setIsAboutOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Model Label / Group:</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{stats.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Vertices:</span>
                <span style={{ fontWeight: 600 }}>{stats.vertices.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Polygons (Triangles):</span>
                <span style={{ fontWeight: 600 }}>{stats.triangles.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bounding Box Dimensions (m):</span>
                <span style={{ fontWeight: 600 }}>{stats.width}m × {stats.height}m × {stats.depth}m</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bounding Volume Estimate:</span>
                <span style={{ fontWeight: 600 }}>{stats.volume} m³</span>
              </div>

              <button className="btn-action primary" style={{ marginTop: '16px', justifyContent: 'center' }} onClick={() => setIsAboutOpen(false)}>
                Close Statistics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome & Templates Modal */}
      <WelcomeModal 
        isOpen={isWelcomeOpen} 
        onClose={() => setIsWelcomeOpen(false)} 
        engine={engine} 
      />
    </div>
  );
}

export default App;
