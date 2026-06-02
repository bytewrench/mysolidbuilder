import React, { useState, useEffect } from 'react';
import { EditorEngine } from '../engine/EditorEngine';
import type { MaterialStyle } from '../engine/EditorEngine';
import * as THREE from 'three';
import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Layers, 
  Settings, 
  Paintbrush, 
  Copy
} from 'lucide-react';

interface SidebarProps {
  engine: EditorEngine | null;
}

const PRESET_COLORS = [
  '#3b82f6', // Indigo Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Amber Orange
  '#ef4444', // Coral Red
  '#ec4899', // Pink
  '#8b5cf6', // Violet Purple
  '#00f0ff', // Cyber Cyan
  '#e2e8f0', // Off White
  '#475569', // Steel Slate
  '#1e293b'  // Midnight Navy
];

export const Sidebar: React.FC<SidebarProps> = ({ engine }) => {
  const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
  const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh | null>(null);

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

  // Material & Color State
  const [color, setColor] = useState('#3b82f6');
  const [materialStyle, setMaterialStyle] = useState<MaterialStyle>('standard');

  useEffect(() => {
    if (!engine) return;

    const handleSceneChange = () => {
      setMeshes(engine.getMeshes());
    };

    const handleSelectionChange = (e: any) => {
      const mesh = e.object as THREE.Mesh | null;
      setSelectedMesh(mesh);
      if (mesh) {
        syncInspector(mesh);
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
    if (engine.selectedObject) {
      syncInspector(engine.selectedObject);
    }

    return () => {
      (engine as any).removeEventListener('scene-changed', handleSceneChange);
      (engine as any).removeEventListener('selection-changed', handleSelectionChange);
      (engine as any).removeEventListener('object-modified', handleObjectModified);
    };
  }, [engine, selectedMesh]);

  const syncInspector = (mesh: THREE.Mesh) => {
    setMeshName(mesh.name);
    setPosX(parseFloat(mesh.position.x.toFixed(2)));
    setPosY(parseFloat(mesh.position.y.toFixed(2)));
    setPosZ(parseFloat(mesh.position.z.toFixed(2)));

    // Rotations in degrees
    setRotX(parseFloat((THREE.MathUtils.radToDeg(mesh.rotation.x) % 360).toFixed(1)));
    setRotY(parseFloat((THREE.MathUtils.radToDeg(mesh.rotation.y) % 360).toFixed(1)));
    setRotZ(parseFloat((THREE.MathUtils.radToDeg(mesh.rotation.z) % 360).toFixed(1)));

    setSclX(parseFloat(mesh.scale.x.toFixed(2)));
    setSclY(parseFloat(mesh.scale.y.toFixed(2)));
    setSclZ(parseFloat(mesh.scale.z.toFixed(2)));

    // Get color & style
    const mat = mesh.material as THREE.Material;
    if (mat) {
      if ((mat as any).color) {
        setColor('#' + (mat as any).color.getHexString());
      }
      const isGlass = (mat as any).transmission > 0.5;
      const isMetal = (mat as any).metalness > 0.8;
      const isMatte = (mat as any).roughness > 0.8;
      
      setMaterialStyle(
        isGlass ? 'glass' :
        isMetal ? 'metal' :
        isMatte ? 'matte' : 'standard'
      );
    }
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

  const handleColorChange = (hex: string) => {
    setColor(hex);
    if (engine) {
      engine.activeColor = hex;
      if (selectedMesh) {
        engine.updateSelectedObjectProperties({ color: hex });
      }
    }
  };

  const handleMaterialStyleChange = (style: MaterialStyle) => {
    setMaterialStyle(style);
    if (engine) {
      engine.activeMaterialStyle = style;
      if (selectedMesh) {
        engine.updateSelectedObjectProperties({ style });
      }
    }
  };

  const toggleVisibility = (mesh: THREE.Mesh, e: React.MouseEvent) => {
    e.stopPropagation();
    mesh.visible = !mesh.visible;
    // Force rerender hierarchy
    setMeshes([...meshes]);
  };

  const deleteMesh = (mesh: THREE.Mesh, e: React.MouseEvent) => {
    e.stopPropagation();
    if (engine) {
      engine.selectMesh(null);
      engine.scene.remove(mesh);
      (engine as any).dispatchEvent({ type: 'scene-changed' });
    }
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
      gap: '20px',
      overflowY: 'auto',
      boxSizing: 'border-box',
      zIndex: 40
    }}>
      
      {/* 1. SCENE HIERARCHY */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Layers size={16} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Scene Hierarchy
          </h3>
        </div>
        
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
            No models in sandbox. Add one below!
          </div>
        ) : (
          <div className="hierarchy-list">
            {meshes.map((mesh) => (
              <div 
                key={mesh.uuid}
                className={`hierarchy-item ${selectedMesh === mesh ? 'active' : ''}`}
                onClick={() => engine?.selectMesh(mesh)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {mesh.name}
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
      </div>

      <div style={{ height: '1px', background: 'var(--border-light)' }} />

      {/* 2. OBJECT PROPERTIES INSPECTOR */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Settings size={16} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Transform Inspector
          </h3>
        </div>

        {selectedMesh ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
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

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button 
                className="btn-action" 
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                onClick={() => engine?.duplicateSelected()}
              >
                <Copy size={12} />
                Duplicate
              </button>
              <button 
                className="btn-action" 
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                onClick={() => engine?.deleteSelected()}
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>

          </div>
        ) : (
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-muted)', 
            padding: '24px 16px', 
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

      {/* 3. MATERIAL & COLORS PALETTE */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Paintbrush size={16} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Material & Color
          </h3>
        </div>

        {/* Color Palette */}
        <label className="input-label" style={{ marginBottom: '8px' }}>Color Swatch</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {PRESET_COLORS.map((hex) => (
            <div 
              key={hex}
              className={`color-swatch ${color.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`}
              style={{ backgroundColor: hex }}
              onClick={() => handleColorChange(hex)}
            />
          ))}
          <input 
            type="color" 
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{
              width: '24px',
              height: '24px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: 'transparent',
              padding: 0
            }} 
            className="tooltip"
            data-tooltip="Custom Color Picker"
          />
        </div>

        {/* Material Styles */}
        <label className="input-label" style={{ marginBottom: '8px' }}>Material Finish</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {(['standard', 'matte', 'metal', 'glass'] as MaterialStyle[]).map((style) => (
            <button
              key={style}
              className={`btn-action ${materialStyle === style ? 'primary' : ''}`}
              style={{ 
                padding: '6px 10px', 
                fontSize: '0.75rem', 
                textTransform: 'capitalize', 
                justifyContent: 'center',
                boxShadow: 'none'
              }}
              onClick={() => handleMaterialStyleChange(style)}
            >
              {style === 'standard' ? 'Default' : style}
            </button>
          ))}
        </div>
      </div>

    </aside>
  );
};
