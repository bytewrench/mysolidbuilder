import React, { useEffect, useRef } from 'react';
import { EditorEngine } from '../engine/EditorEngine';
import type { EditorTool } from '../engine/EditorEngine';

interface ViewportProps {
  onEngineReady: (engine: EditorEngine) => void;
}

export const Viewport: React.FC<ViewportProps> = ({ onEngineReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the engine
    const editorEngine = new EditorEngine(canvasRef.current);
    onEngineReady(editorEngine);

    // Resize Handler
    const handleResize = () => {
      editorEngine.handleResize();
    };

    window.addEventListener('resize', handleResize);

    // Keyboard Shortcuts Handler
    const handleKeyDown = (event: KeyboardEvent) => {
      const isInput = ['input', 'select', 'textarea'].includes(
        document.activeElement?.tagName.toLowerCase() || ''
      );
      if (isInput) return; // Ignore hotkeys if typing in inputs

      const isCtrl = event.ctrlKey || event.metaKey;

      if (isCtrl) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            editorEngine.historyManager.redo();
          } else {
            editorEngine.historyManager.undo();
          }
        } else if (event.key.toLowerCase() === 'y') {
          event.preventDefault();
          editorEngine.historyManager.redo();
        } else if (event.key.toLowerCase() === 'd') {
          event.preventDefault();
          editorEngine.duplicateSelected();
        }
      } else {
        switch (event.code) {
          case 'KeyQ':
            editorEngine.setTool('select');
            break;
          case 'KeyW':
            editorEngine.setTool('translate');
            break;
          case 'KeyE':
            editorEngine.setTool('rotate');
            break;
          case 'KeyR':
            editorEngine.setTool('scale');
            break;
          case 'KeyT':
            editorEngine.setTool('push-pull');
            break;
          case 'Delete':
          case 'Backspace':
            editorEngine.deleteSelected();
            break;
          case 'Escape':
            editorEngine.selectMesh(null);
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Trigger initial size computation
    setTimeout(() => {
      editorEngine.handleResize();
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      // Detach events and cleanup
      editorEngine.selectMesh(null);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} className="viewport-canvas" />

      {/* Grid HUD / Shortcuts Quick Display */}
      <div className="shortcuts-overlay">
        <div className="shortcut-badge">
          <span className="shortcut-key">Q</span> Select
        </div>
        <div className="shortcut-badge">
          <span className="shortcut-key">W</span> Move
        </div>
        <div className="shortcut-badge">
          <span className="shortcut-key">E</span> Rotate
        </div>
        <div className="shortcut-badge">
          <span className="shortcut-key">R</span> Scale
        </div>
        <div className="shortcut-badge">
          <span className="shortcut-key">T</span> Push-Pull
        </div>
        <div className="shortcut-badge">
          <span className="shortcut-key">Del</span> Delete
        </div>
        <div className="shortcut-badge">
          <span className="shortcut-key">Ctrl+Z</span> Undo
        </div>
        <div className="shortcut-badge">
          <span className="shortcut-key">Ctrl+D</span> Duplicate
        </div>
      </div>
    </div>
  );
};
export type { EditorTool };
