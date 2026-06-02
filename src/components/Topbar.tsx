import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { EditorEngine } from '../engine/EditorEngine';
import { 
  Undo2, 
  Redo2, 
  Save, 
  Download, 
  FolderOpen, 
  Grid, 
  Sparkles, 
  Trash2, 
  HelpCircle 
} from 'lucide-react';

interface TopbarProps {
  engine: EditorEngine | null;
  onOpenHelp: () => void;
  onExit: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ engine, onOpenHelp, onExit }) => {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapSize, setSnapSize] = useState(0.5);

  useEffect(() => {
    if (!engine) return;

    const handleHistoryChange = () => {
      setCanUndo(engine.historyManager.canUndo());
      setCanRedo(engine.historyManager.canRedo());
    };

    (engine as any).addEventListener('history-changed', handleHistoryChange);
    // Initial State
    setSnapEnabled(engine.snapEnabled);
    setSnapSize(engine.gridSnapSize);
    handleHistoryChange();

    return () => {
      (engine as any).removeEventListener('history-changed', handleHistoryChange);
    };
  }, [engine]);

  const handleUndo = () => engine?.historyManager.undo();
  const handleRedo = () => engine?.historyManager.redo();

  const handleToggleSnap = () => {
    if (!engine) return;
    const newVal = !snapEnabled;
    engine.snapEnabled = newVal;
    engine.updateSnapping();
    setSnapEnabled(newVal);
  };

  const handleChangeSnapSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!engine) return;
    const val = parseFloat(e.target.value);
    engine.gridSnapSize = val;
    engine.updateSnapping();
    setSnapSize(val);
  };

  const handleSave = () => {
    if (!engine) return;
    const meshes = engine.getMeshes();
    const sceneData = meshes.map(mesh => ({
      name: mesh.name,
      geometryType: mesh.geometry.type,
      parameters: (mesh.geometry as any).parameters,
      position: [mesh.position.x, mesh.position.y, mesh.position.z],
      rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
      scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
      color: '#' + (mesh.material as any).color.getHexString(),
      style: (mesh.material as any).transmission > 0.5 ? 'glass' :
             (mesh.material as any).metalness > 0.8 ? 'metal' :
             (mesh.material as any).roughness > 0.8 ? 'matte' : 'standard'
    }));

    localStorage.setItem('ms_build_3d_project', JSON.stringify(sceneData));
    alert('Project saved successfully to browser storage!');
  };

  const handleLoad = () => {
    if (!engine) return;
    const dataStr = localStorage.getItem('ms_build_3d_project');
    if (!dataStr) {
      alert('No saved project found. Draw something first!');
      return;
    }

    try {
      const sceneData = JSON.parse(dataStr);
      engine.selectMesh(null);
      engine.historyManager.clear();

      // Remove existing user models
      const userMeshes = engine.getMeshes();
      userMeshes.forEach(mesh => engine.scene.remove(mesh));

      // Recreate meshes
      sceneData.forEach((item: any) => {
        let geom: THREE.BufferGeometry;
        const p = item.parameters || {};

        // Rebuild geometries based on type
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

        // Build material
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
      alert('Project loaded successfully!');
    } catch (err) {
      console.error(err);
      alert('Error parsing saved project.');
    }
  };

  const handleExport = () => {
    engine?.exportGLTF();
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
      engine?.loadTemplate('empty');
    }
  };

  return (
    <header className="glass-panel" style={{ 
      gridRow: 1, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '0 20px',
      height: 'var(--topbar-height)',
      borderRadius: 0,
      borderBottom: '1px solid var(--border-light)',
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      zIndex: 100
    }}>
      
      {/* Brand Logo */}
      <div 
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        onClick={onExit}
        title="Exit to Landing Page"
      >
        <div style={{
          background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)'
        }}>
          <Sparkles size={18} color="#07080a" />
        </div>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.5px', margin: 0, display: 'inline-block' }}>
            MYSOLID<span style={{ color: 'var(--accent-cyan)' }}>BUILDER</span>
          </h1>
          <span style={{ 
            fontSize: '0.625rem', 
            background: 'rgba(0, 240, 255, 0.1)', 
            color: 'var(--accent-cyan)', 
            border: '1px solid var(--border-cyan)', 
            padding: '2px 6px', 
            borderRadius: '4px',
            marginLeft: '8px',
            verticalAlign: 'middle',
            fontWeight: 600
          }}>3D EDITOR</span>
        </div>
      </div>

      {/* Editor History and Save Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        
        {/* Undo / Redo */}
        <button 
          className="btn-icon tooltip" 
          onClick={handleUndo} 
          disabled={!canUndo}
          data-tooltip="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button 
          className="btn-icon tooltip" 
          onClick={handleRedo} 
          disabled={!canRedo}
          data-tooltip="Redo (Ctrl+Y)"
        >
          <Redo2 size={18} />
        </button>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-light)', margin: '0 4px' }} />

        {/* LocalStorage Actions */}
        <button className="btn-action tooltip" onClick={handleSave} data-tooltip="Save to Local Storage">
          <Save size={16} />
          <span>Save</span>
        </button>
        <button className="btn-action tooltip" onClick={handleLoad} data-tooltip="Load Last Saved Model">
          <FolderOpen size={16} />
          <span>Load</span>
        </button>

        {/* Clear Scene */}
        <button className="btn-action tooltip" style={{ color: '#ef4444' }} onClick={handleClear} data-tooltip="Clear Sandbox">
          <Trash2 size={16} />
          <span>Clear</span>
        </button>
      </div>

      {/* Right Side Settings and Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        
        {/* Snapping */}
        <div className="glass-card" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '4px 8px', 
          gap: '8px', 
          height: '32px',
          borderRadius: '6px'
        }}>
          <button 
            onClick={handleToggleSnap}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: snapEnabled ? 'var(--accent-cyan)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: 0
            }}
            className="tooltip"
            data-tooltip="Toggle Grid Snapping"
          >
            <Grid size={16} />
          </button>
          
          <select 
            className="input-field" 
            style={{ 
              height: '24px', 
              padding: '0 4px', 
              width: '70px',
              background: 'transparent',
              border: 'none',
              fontSize: '0.75rem',
              color: snapEnabled ? 'var(--text-primary)' : 'var(--text-muted)'
            }}
            value={snapSize}
            onChange={handleChangeSnapSize}
            disabled={!snapEnabled}
          >
            <option value="0.1">0.1m</option>
            <option value="0.25">0.25m</option>
            <option value="0.5">0.5m</option>
            <option value="1.0">1.0m</option>
            <option value="2.0">2.0m</option>
          </select>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-light)' }} />

        {/* Help button */}
        <button 
          className="btn-icon tooltip" 
          onClick={onOpenHelp}
          data-tooltip="View Shortcuts & Info"
        >
          <HelpCircle size={18} />
        </button>

        {/* GLTF Export */}
        <button 
          className="btn-action primary tooltip" 
          onClick={handleExport}
          data-tooltip="Export as GLTF file"
        >
          <Download size={16} />
          <span>Export 3D</span>
        </button>

      </div>

    </header>
  );
};
