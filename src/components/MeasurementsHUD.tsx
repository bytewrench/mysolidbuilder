import React, { useState, useEffect } from 'react';
import { EditorEngine } from '../engine/EditorEngine';
import * as THREE from 'three';

interface MeasurementsHUDProps {
  engine: EditorEngine | null;
}

export const MeasurementsHUD: React.FC<MeasurementsHUDProps> = ({ engine }) => {
  const [cursorPoint, setCursorPoint] = useState<THREE.Vector3 | null>(null);
  const [pushPullOffset, setPushPullOffset] = useState<number | null>(null);
  const [selectedMesh, setSelectedMesh] = useState<THREE.Object3D | null>(null);
  const [volume, setVolume] = useState<number | null>(null);

  useEffect(() => {
    if (!engine) return;

    const handleCursorMoved = (e: any) => {
      setCursorPoint(e.point ? e.point.clone() : null);
    };

    const handlePushPullDrag = (e: any) => {
      setPushPullOffset(e.offset);
    };

    const handleSelectionChange = (e: any) => {
      const mesh = e.object as THREE.Object3D | null;
      setSelectedMesh(mesh);
      if (mesh) {
        calculateVolume(mesh);
        setPushPullOffset(null);
      } else {
        setVolume(null);
      }
    };

    const handleObjectModified = (e: any) => {
      if (selectedMesh && e.object === selectedMesh) {
        calculateVolume(e.object);
      }
    };

    const handleToolChange = (e: any) => {
      if (e.tool !== 'push-pull') {
        setPushPullOffset(null);
      }
      setCursorPoint(null);
    };

    (engine as any).addEventListener('cursor-moved', handleCursorMoved);
    (engine as any).addEventListener('push-pull-drag', handlePushPullDrag);
    (engine as any).addEventListener('selection-changed', handleSelectionChange);
    (engine as any).addEventListener('object-modified', handleObjectModified);
    (engine as any).addEventListener('tool-changed', handleToolChange);

    // Initial Sync
    setSelectedMesh(engine.selectedObject);
    if (engine.selectedObject) {
      calculateVolume(engine.selectedObject);
    }

    return () => {
      (engine as any).removeEventListener('cursor-moved', handleCursorMoved);
      (engine as any).removeEventListener('push-pull-drag', handlePushPullDrag);
      (engine as any).removeEventListener('selection-changed', handleSelectionChange);
      (engine as any).removeEventListener('object-modified', handleObjectModified);
      (engine as any).removeEventListener('tool-changed', handleToolChange);
    };
  }, [engine, selectedMesh]);

  const calculateVolume = (obj: THREE.Object3D) => {
    let totalVol = 0;

    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const scale = child.scale;
        const type = child.geometry.type;
        let vol = 0;

        // Standard volumes based on base geometries:
        // Box (width=2, height=2, depth=2)
        if (type === 'BoxGeometry') {
          vol = (2 * scale.x) * (2 * scale.y) * (2 * scale.z);
        }
        // Sphere (radius=1)
        else if (type === 'SphereGeometry') {
          vol = (4 / 3) * Math.PI * Math.pow(scale.x, 3);
        }
        // Cylinder (radius=1, height=2)
        else if (type === 'CylinderGeometry') {
          vol = Math.PI * Math.pow(scale.x, 2) * (2 * scale.y);
        }
        // Cone (radius=1, height=2)
        else if (type === 'ConeGeometry') {
          vol = (1 / 3) * Math.PI * Math.pow(scale.x, 2) * (2 * scale.y);
        }
        // Torus (radius=1, tube=0.3)
        else if (type === 'TorusGeometry') {
          vol = 2 * Math.pow(Math.PI, 2) * Math.pow(0.3 * scale.y, 2) * (1 * scale.x);
        }
        totalVol += vol;
      }
    });

    setVolume(totalVol > 0 ? parseFloat(totalVol.toFixed(3)) : null);
  };

  const getActiveDisplay = () => {
    if (pushPullOffset !== null) {
      return (
        <div>
          <div style={{ fontSize: '0.625rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
            Extrusion Depth
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {pushPullOffset >= 0 ? '+' : ''}{pushPullOffset.toFixed(2)} m
          </div>
        </div>
      );
    }

    if (cursorPoint !== null && engine?.activeTool === 'shape') {
      return (
        <div>
          <div style={{ fontSize: '0.625rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
            Grid Placement Coordinates
          </div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            X: {cursorPoint.x.toFixed(2)}m | Z: {cursorPoint.z.toFixed(2)}m
          </div>
        </div>
      );
    }

    if (selectedMesh) {
      // Calculate dimensional bounding size
      let w = 0, h = 0, d = 0;
      if (selectedMesh instanceof THREE.Mesh) {
        w = 2 * selectedMesh.scale.x;
        h = 2 * selectedMesh.scale.y;
        d = 2 * selectedMesh.scale.z;
      } else {
        const bbox = new THREE.Box3().setFromObject(selectedMesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        w = size.x;
        h = size.y;
        d = size.z;
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
              Selected Bounding Volume
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              {volume !== null ? `${volume} m³` : 'N/A'}
            </div>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
            <span>W: {w.toFixed(1)}m</span>
            <span>H: {h.toFixed(1)}m</span>
            <span>D: {d.toFixed(1)}m</span>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
          Measurements (VCB)
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Grid snap size: <strong>{engine?.gridSnapSize}m</strong>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      right: '24px',
      zIndex: 50,
      padding: '10px 16px',
      minWidth: '180px',
      boxSizing: 'border-box'
    }} className="glass-panel glass-panel-cyan">
      {getActiveDisplay()}
    </div>
  );
};
