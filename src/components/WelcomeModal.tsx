import React, { useState } from 'react';
import { EditorEngine } from '../engine/EditorEngine';
import { 
  Sparkles, 
  BookOpen, 
  Play,
  LayoutTemplate
} from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: EditorEngine | null;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, engine }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'shortcuts'>('templates');

  if (!isOpen) return null;

  const handleSelectTemplate = (type: 'castle' | 'room' | 'playground' | 'empty') => {
    if (engine) {
      engine.loadTemplate(type);
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(0, 240, 255, 0.3)'
            }}>
              <Sparkles size={20} color="#07080a" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>MS BUILD 3D Modeling</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Next-Gen web-based 3D CAD & SketchUp engine</p>
            </div>
          </div>
          <button 
            className="btn-icon" 
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-light)', 
          gap: '16px', 
          marginBottom: '20px' 
        }}>
          <button 
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'templates' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              color: activeTab === 'templates' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('templates')}
          >
            <LayoutTemplate size={16} />
            Quick Start Templates
          </button>
          
          <button 
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'shortcuts' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              color: activeTab === 'shortcuts' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('shortcuts')}
          >
            <BookOpen size={16} />
            Controls & Shortcuts
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'templates' ? (
          <div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Choose a starter layout to experience lighting, mesh shadows, and standard object scaling.
            </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '16px' 
            }}>
              
              {/* Template Card: Empty */}
              <div 
                className="glass-card" 
                style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
                onClick={() => handleSelectTemplate('empty')}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>Empty Sandbox</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  A blank grid floor with lighting set up. Best for starting custom projects.
                </div>
              </div>

              {/* Template Card: Castle */}
              <div 
                className="glass-card" 
                style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
                onClick={() => handleSelectTemplate('castle')}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Tiny Castle Keep <span style={{ fontSize: '0.625rem', background: 'rgba(0, 240, 255, 0.1)', color: 'var(--accent-cyan)', padding: '1px 4px', borderRadius: '3px' }}>Popular</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  A modular fortress keep featuring corner round towers, conic roofs, and castle gates.
                </div>
              </div>

              {/* Template Card: Cozy Room */}
              <div 
                className="glass-card" 
                style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
                onClick={() => handleSelectTemplate('room')}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>Cozy Living Room</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  An interior model showcasing furniture configurations: study desk, monitor stand, and chairs.
                </div>
              </div>

              {/* Template Card: Playground */}
              <div 
                className="glass-card" 
                style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
                onClick={() => handleSelectTemplate('playground')}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>Park Playground</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  A recreational layout containing swing sets, sandboxes, and green grass layers.
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Viewport Camera Navigation */}
            <div className="glass-card" style={{ padding: '12px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Camera Navigation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div><strong>Orbit camera:</strong> Left Click + Drag (Select tool) or Right Click + Drag</div>
                <div><strong>Zoom view:</strong> Scroll Wheel</div>
                <div><strong>Pan camera:</strong> Shift + Right Click + Drag or Middle Click + Drag</div>
              </div>
            </div>

            {/* Keyboard Shortcuts Grid */}
            <div className="glass-card" style={{ padding: '12px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Keyboard Shortcuts</div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '8px 24px',
                fontSize: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Select Tool</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>Q</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Move Tool</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>W</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Rotate Tool</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>E</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Scale Tool</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>R</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Push-Pull Tool</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>T</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Undo Operation</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>Ctrl + Z</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Redo Operation</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>Ctrl + Y</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Duplicate Mesh</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>Ctrl + D</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Delete Selected</span>
                  <kbd style={{ background: '#334155', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>Del / Backspace</kbd>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Modal Footer */}
        <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-action primary" onClick={onClose}>
            <Play size={14} />
            <span>Start Building</span>
          </button>
        </div>

      </div>
    </div>
  );
};
