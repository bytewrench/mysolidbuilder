import React, { useState, useEffect } from 'react';
import { EditorEngine } from '../engine/EditorEngine';
import * as THREE from 'three';
import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Layers, 
  Settings, 
  Copy,
  FolderTree,
  CheckSquare,
  Square,
  RefreshCw,
  FolderClosed,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface SidebarProps {
  engine: EditorEngine | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ engine }) => {
  const [meshes, setMeshes] = useState<THREE.Object3D[]>([]);
  const [selectedMesh, setSelectedMesh] = useState<THREE.Object3D | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [stickySelection, setStickySelection] = useState(false);
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(true);

  // Inspector Form State
  const [meshName, setMeshName] = useState('');
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [posZ, setPosZ] = useState(0);
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [rotZ, setRotZ] = useState(0);
  const [sclX, setSclX] = useState(1);
  const [sclY, setSclY] = useState(1);
  const [sclZ, setSclZ] = useState(1);

  useEffect(() => {
    if (!engine) return;

    const handleSceneChange = () => {
      setMeshes(engine.getMeshes());
      setSelectedCount(engine.selectedObjects.length);
    };

    const handleSelectionChange = (e: any) => {
      const obj = e.object as THREE.Object3D | null;
      setSelectedMesh(obj);
      setSelectedCount(engine.selectedObjects.length);
      setStickySelection(engine.stickySelection);
      if (obj) {
        syncInspector(obj);
      }
    };

    const handleObjectModified = (e: any) => {
      if (selectedMesh && e.object === selectedMesh) {
        syncInspector(e.object);
      }
    };

    (engine as any).addEventListener('scene-changed', handleSceneChange);
    (engine as any).addEventListener('selection-changed', handleSelectionChange);
    (engine as any).addEventListener('object-modified', handleObjectModified);

    // Initial Sync
    setMeshes(engine.getMeshes());
    setSelectedMesh(engine.selectedObject);
    setSelectedCount(engine.selectedObjects.length);
    setStickySelection(engine.stickySelection);
    if (engine.selectedObject) {
      syncInspector(engine.selectedObject);
    }

    return () => {
      (engine as any).removeEventListener('scene-changed', handleSceneChange);
      (engine as any).removeEventListener('selection-changed', handleSelectionChange);
      (engine as any).removeEventListener('object-modified', handleObjectModified);
    };
  }, [engine, selectedMesh]);

  const syncInspector = (mesh: THREE.Object3D) => {
    setMeshName(mesh.name);
    setPosX(parseFloat(mesh.position.x.toFixed(2)));
    setPosY(parseFloat(mesh.position.y.toFixed(2)));
    setPosZ(parseFloat(mesh.position.z.toFixed(2)));

    setRotX(parseFloat((THREE.MathUtils.radToDeg(mesh.rotation.x) % 360).toFixed(1)));
    setRotY(parseFloat((THREE.MathUtils.radToDeg(mesh.rotation.y) % 360).toFixed(1)));
    setRotZ(parseFloat((THREE.MathUtils.radToDeg(mesh.rotation.z) % 360).toFixed(1)));

    setSclX(parseFloat(mesh.scale.x.toFixed(2)));
    setSclY(parseFloat(mesh.scale.y.toFixed(2)));
    setSclZ(parseFloat(mesh.scale.z.toFixed(2)));
  };

  const handlePropertyChange = (field: string, val: any) => {
    if (!engine || !selectedMesh) return;

    const props: any = {};
    if (field === 'name') {
      props.name = val;
      setMeshName(val);
    }
    if (field === 'posX') { props.posX = parseFloat(val); setPosX(parseFloat(val)); }
    if (field === 'posY') { props.posY = parseFloat(val); setPosY(parseFloat(val)); }
    if (field === 'posZ') { props.posZ = parseFloat(val); setPosZ(parseFloat(val)); }
    if (field === 'rotX') { props.rotX = parseFloat(val); setRotX(parseFloat(val)); }
    if (field === 'rotY') { props.rotY = parseFloat(val); setRotY(parseFloat(val)); }
    if (field === 'rotZ') { props.rotZ = parseFloat(val); setRotZ(parseFloat(val)); }
    if (field === 'sclX') { props.sclX = parseFloat(val); setSclX(parseFloat(val)); }
    if (field === 'sclY') { props.sclY = parseFloat(val); setSclY(parseFloat(val)); }
    if (field === 'sclZ') { props.sclZ = parseFloat(val); setSclZ(parseFloat(val)); }
    
    engine.updateSelectedObjectProperties(props);
  };

  const toggleVisibility = (mesh: THREE.Object3D, e: React.MouseEvent) => {
    e.stopPropagation();
    mesh.visible = !mesh.visible;
    setMeshes([...meshes]);
  };

  const deleteMesh = (mesh: THREE.Object3D, e: React.MouseEvent) => {
    e.stopPropagation();
    if (engine) {
      engine.selectMesh(null);
      engine.scene.remove(mesh);
      (engine as any).dispatchEvent({ type: 'scene-changed' });
    }
  };

  const handleToggleSticky = () => {
    if (!engine) return;
    const newVal = !stickySelection;
    engine.stickySelection = newVal;
    setStickySelection(newVal);
  };

  return (
    <aside className="glass-panel" style={{
      width: 'var(--sidebar-width)',
      height: 'calc(100vh - var(--topbar-height))',
      borderRadius: 0,
      borderLeft: '1px solid var(--border-light)',
      borderRight: 'none',
      borderTop: 'none',
      borderBottom: 'none',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      overflowY: 'auto',
      boxSizing: 'border-box',
      zIndex: 40
    }}>
      
      {/* 1. SELECTION & GROUPING UTILITIES (Matches Microsoft 3D Builder Sidebar) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <FolderClosed size={16} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Selection Tools
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          
          <button 
            className="btn-action tooltip"
            style={{ padding: '6px', fontSize: '0.75rem', justifyContent: 'center' }}
            onClick={() => engine?.groupSelected()}
            disabled={selectedCount < 2}
            data-tooltip="Group Selected Objects"
          >
            <Layers size={14} />
            <span>Group</span>
          </button>

          <button 
            className="btn-action tooltip"
            style={{ padding: '6px', fontSize: '0.75rem', justifyContent: 'center' }}
            onClick={() => engine?.ungroupSelected()}
            disabled={!selectedMesh || !(selectedMesh instanceof THREE.Group)}
            data-tooltip="Ungroup Group Container"
          >
            <FolderClosed size={14} />
            <span>Ungroup</span>
          </button>

          <button 
            className="btn-action"
            style={{ padding: '6px', fontSize: '0.75rem', justifyContent: 'center' }}
            onClick={() => engine?.selectAll()}
          >
            <CheckSquare size={14} />
            <span>Select All</span>
          </button>

          <button 
            className="btn-action"
            style={{ padding: '6px', fontSize: '0.75rem', justifyContent: 'center' }}
            onClick={() => engine?.deselectAll()}
          >
            <Square size={14} />
            <span>Deselect All</span>
          </button>

          <button 
            className="btn-action"
            style={{ padding: '6px', fontSize: '0.75rem', justifyContent: 'center', gridColumn: 'span 2' }}
            onClick={() => engine?.invertSelection()}
          >
            <RefreshCw size={14} />
            <span>Invert Selection</span>
          </button>

          <button 
            className={`btn-action ${stickySelection ? 'primary' : ''}`}
            style={{ padding: '6px', fontSize: '0.75rem', justifyContent: 'center', gridColumn: 'span 2' }}
            onClick={handleToggleSticky}
          >
            <Layers size={14} />
            <span>{stickySelection ? 'Sticky Selection: ON' : 'Sticky Selection: OFF'}</span>
          </button>

        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border-light)' }} />

      {/* 2. OBJECT PROPERTIES INSPECTOR */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Settings size={16} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Transform Inspector
          </h3>
          {selectedCount > 1 && (
            <span style={{
              fontSize: '0.625rem',
              background: 'rgba(0, 240, 255, 0.1)',
              color: 'var(--accent-cyan)',
              padding: '2px 6px',
              borderRadius: '4px',
              marginLeft: 'auto'
            }}>{selectedCount} Selected</span>
          )}
        </div>

        {selectedMesh ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Object Name */}
            <div>
              <label className="input-label">Object Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={meshName} 
                onChange={(e) => handlePropertyChange('name', e.target.value)} 
              />
            </div>

            {/* Position */}
            <div>
              <label className="input-label">Position (m)</label>
              <div className="coords-grid">
                <div className="coord-input-container">
                  <span className="coord-label">X</span>
                  <input type="number" step="0.1" className="input-field" value={posX} onChange={(e) => handlePropertyChange('posX', e.target.value)} />
                </div>
                <div className="coord-input-container">
                  <span className="coord-label">Y</span>
                  <input type="number" step="0.1" className="input-field" value={posY} onChange={(e) => handlePropertyChange('posY', e.target.value)} />
                </div>
                <div className="coord-input-container">
                  <span className="coord-label">Z</span>
                  <input type="number" step="0.1" className="input-field" value={posZ} onChange={(e) => handlePropertyChange('posZ', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <label className="input-label">Rotation (°)</label>
              <div className="coords-grid">
                <div className="coord-input-container">
                  <span className="coord-label">X</span>
                  <input type="number" step="5" className="input-field" value={rotX} onChange={(e) => handlePropertyChange('rotX', e.target.value)} />
                </div>
                <div className="coord-input-container">
                  <span className="coord-label">Y</span>
                  <input type="number" step="5" className="input-field" value={rotY} onChange={(e) => handlePropertyChange('rotY', e.target.value)} />
                </div>
                <div className="coord-input-container">
                  <span className="coord-label">Z</span>
                  <input type="number" step="5" className="input-field" value={rotZ} onChange={(e) => handlePropertyChange('rotZ', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Scale */}
            <div>
              <label className="input-label">Scale Factor</label>
              <div className="coords-grid">
                <div className="coord-input-container">
                  <span className="coord-label">X</span>
                  <input type="number" step="0.1" min="0.05" className="input-field" value={sclX} onChange={(e) => handlePropertyChange('sclX', e.target.value)} />
                </div>
                <div className="coord-input-container">
                  <span className="coord-label">Y</span>
                  <input type="number" step="0.1" min="0.05" className="input-field" value={sclY} onChange={(e) => handlePropertyChange('sclY', e.target.value)} />
                </div>
                <div className="coord-input-container">
                  <span className="coord-label">Z</span>
                  <input type="number" step="0.1" min="0.05" className="input-field" value={sclZ} onChange={(e) => handlePropertyChange('sclZ', e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button 
                className="btn-action" 
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px', justifyContent: 'center' }}
                onClick={() => engine?.duplicateSelected()}
              >
                <Copy size={12} />
                <span>Duplicate</span>
              </button>
              <button 
                className="btn-action" 
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', justifyContent: 'center' }}
                onClick={() => engine?.deleteSelected()}
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>

          </div>
        ) : (
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-muted)', 
            padding: '16px', 
            textAlign: 'center', 
            background: 'rgba(0,0,0,0.1)', 
            borderRadius: '6px',
            border: '1px dashed var(--border-light)'
          }}>
            Select an object in the viewport to inspect its coordinates and dimensions.
          </div>
        )}
      </div>

      <div style={{ height: '1px', background: 'var(--border-light)' }} />

      {/* 3. SCENE HIERARCHY / ITEMS LIST (Retractable container like MS 3D Builder) */}
      <div>
        <button 
          onClick={() => setIsHierarchyOpen(!isHierarchyOpen)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            width: '100%', 
            background: 'transparent', 
            border: 'none', 
            padding: 0,
            cursor: 'pointer',
            color: 'var(--text-primary)',
            outline: 'none',
            marginBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderTree size={16} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Items
            </h3>
          </div>
          {isHierarchyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isHierarchyOpen && (
          <>
            {meshes.length === 0 ? (
              <div style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                padding: '16px', 
                textAlign: 'center', 
                background: 'rgba(0,0,0,0.1)', 
                borderRadius: '6px',
                border: '1px dashed var(--border-light)'
              }}>
                No items in scene.
              </div>
            ) : (
              <div className="hierarchy-list">
                {meshes.map((mesh) => (
                  <div 
                    key={mesh.uuid}
                    className={`hierarchy-item ${selectedMesh === mesh || (engine?.selectedObjects.includes(mesh)) ? 'active' : ''}`}
                    onClick={() => engine?.selectMesh(mesh)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', fontWeight: (mesh instanceof THREE.Group) ? 700 : 400 }}>
                      {(mesh instanceof THREE.Group) ? `📁 ${mesh.name}` : `📦 ${mesh.name}`}
                    </span>
                    <div className="hierarchy-item-actions">
                      <button className="hierarchy-item-btn" onClick={(e) => toggleVisibility(mesh, e)}>
                        {mesh.visible ? <Eye size={12} /> : <EyeOff size={12} color="#ef4444" />}
                      </button>
                      <button className="hierarchy-item-btn delete" onClick={(e) => deleteMesh(mesh, e)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

    </aside>
  );
};
