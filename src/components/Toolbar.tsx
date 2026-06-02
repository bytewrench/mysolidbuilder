import React, { useState, useEffect } from 'react';
import { EditorEngine } from '../engine/EditorEngine';
import type { EditorTool, PrimitiveShape } from '../engine/EditorEngine';
import { 
  MousePointer, 
  Move, 
  RotateCw, 
  Maximize2, 
  ArrowUpRight,
  Eraser, 
  PaintBucket,
  Box,
  Globe,
  Cylinder as CylinderIcon,
  Cone as ConeIcon,
  Disc
} from 'lucide-react';

interface ToolbarProps {
  engine: EditorEngine | null;
  tutorialStep?: string | null;
  setTutorialStep?: (step: string | null) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ engine, tutorialStep, setTutorialStep }) => {
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [activeShape, setActiveShape] = useState<PrimitiveShape>('box');

  useEffect(() => {
    if (!engine) return;

    const handleToolChange = (e: any) => {
      setActiveTool(e.tool);
    };

    (engine as any).addEventListener('tool-changed', handleToolChange);

    // Sync Initial State
    setActiveTool(engine.activeTool);
    setActiveShape(engine.activeShape);

    return () => {
      (engine as any).removeEventListener('tool-changed', handleToolChange);
    };
  }, [engine]);

  const selectTool = (tool: EditorTool) => {
    if (!engine) return;
    engine.setTool(tool);
    setActiveTool(tool);

    if (tool === 'translate' && tutorialStep === 'click-move-btn' && setTutorialStep) {
      setTutorialStep('tutorial-complete');
    }
  };

  const selectShape = (shape: PrimitiveShape) => {
    if (!engine) return;
    engine.activeShape = shape;
    engine.setTool('shape');
    setActiveShape(shape);
    setActiveTool('shape');

    if (shape === 'box' && tutorialStep === 'click-cube-btn' && setTutorialStep) {
      setTutorialStep('click-grid');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '8px 16px',
      zIndex: 50
    }} className="glass-panel glass-panel-cyan">
      
      {/* SECTION 1: EDITING TOOLS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button 
          className={`btn-icon tooltip ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => selectTool('select')}
          data-tooltip="Select (Q)"
        >
          <MousePointer size={18} />
        </button>
        
        <button 
          className={`btn-icon tooltip ${activeTool === 'translate' ? 'active' : ''} ${tutorialStep === 'click-move-btn' ? 'glow-pulsate' : ''}`}
          onClick={() => selectTool('translate')}
          data-tooltip="Move / Position (W)"
        >
          <Move size={18} />
        </button>

        <button 
          className={`btn-icon tooltip ${activeTool === 'rotate' ? 'active' : ''}`}
          onClick={() => selectTool('rotate')}
          data-tooltip="Rotate (E)"
        >
          <RotateCw size={18} />
        </button>

        <button 
          className={`btn-icon tooltip ${activeTool === 'scale' ? 'active' : ''}`}
          onClick={() => selectTool('scale')}
          data-tooltip="Scale / Resize (R)"
        >
          <Maximize2 size={18} />
        </button>

        <button 
          className={`btn-icon tooltip ${activeTool === 'push-pull' ? 'active' : ''}`}
          onClick={() => selectTool('push-pull')}
          data-tooltip="Push-Pull Extrude (T)"
        >
          <ArrowUpRight size={18} />
        </button>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-light)', margin: '0 4px' }} />

        <button 
          className={`btn-icon tooltip ${activeTool === 'paint' ? 'active' : ''}`}
          onClick={() => selectTool('paint')}
          data-tooltip="Paint Tool"
        >
          <PaintBucket size={18} />
        </button>

        <button 
          className={`btn-icon tooltip ${activeTool === 'erase' ? 'active' : ''}`}
          onClick={() => selectTool('erase')}
          data-tooltip="Eraser Tool"
        >
          <Eraser size={18} />
        </button>
      </div>

      <div style={{ width: '1px', height: '32px', background: 'var(--border-light)' }} />

      {/* SECTION 2: SHAPE CREATORS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button 
          className={`btn-icon tooltip ${activeTool === 'shape' && activeShape === 'box' ? 'active' : ''} ${tutorialStep === 'click-cube-btn' ? 'glow-pulsate' : ''}`}
          onClick={() => selectShape('box')}
          data-tooltip="Add Cube"
        >
          <Box size={18} />
        </button>

        <button 
          className={`btn-icon tooltip ${activeTool === 'shape' && activeShape === 'sphere' ? 'active' : ''}`}
          onClick={() => selectShape('sphere')}
          data-tooltip="Add Sphere"
        >
          <Globe size={18} />
        </button>

        <button 
          className={`btn-icon tooltip ${activeTool === 'shape' && activeShape === 'cylinder' ? 'active' : ''}`}
          onClick={() => selectShape('cylinder')}
          data-tooltip="Add Cylinder"
        >
          <CylinderIcon size={18} />
        </button>

        <button 
          className={`btn-icon tooltip ${activeTool === 'shape' && activeShape === 'cone' ? 'active' : ''}`}
          onClick={() => selectShape('cone')}
          data-tooltip="Add Cone"
        >
          <ConeIcon size={18} />
        </button>

        <button 
          className={`btn-icon tooltip ${activeTool === 'shape' && activeShape === 'torus' ? 'active' : ''}`}
          onClick={() => selectShape('torus')}
          data-tooltip="Add Torus"
        >
          <Disc size={18} />
        </button>
      </div>

    </div>
  );
};
export type { ToolbarProps };
