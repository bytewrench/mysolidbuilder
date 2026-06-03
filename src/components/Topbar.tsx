import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { EditorEngine } from '../engine/EditorEngine';
import type { MaterialStyle } from '../engine/EditorEngine';
import { 
  Undo2, 
  Redo2, 
  Grid, 
  Sparkles, 
  HelpCircle, 
  Download, 
  Menu,
  Sun,
  Palette,
  Eye,
  Activity,
  Box,
  Ungroup,
  Layers,
  Check,
  X
} from 'lucide-react';

interface TopbarProps {
  engine: EditorEngine | null;
  onOpenHelp: () => void;
  onExit: () => void;
  onToggleLeftMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ engine, onOpenHelp, onExit, onToggleLeftMenu }) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'paint' | 'view' | 'help'>('view');
  
  // History state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Snapping state
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapSize, setSnapSize] = useState(0.5);

  // View Filter states
  const [shadingEnabled, setShadingEnabled] = useState(true);
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [colorsEnabled, setColorsEnabled] = useState(true);
  const [reflectionsEnabled, setReflectionsEnabled] = useState(true);
  const [smoothingEnabled, setSmoothingEnabled] = useState(true);
  const [wireframeEnabled, setWireframeEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [xrayEnabled, setXrayEnabled] = useState(false);

  // Paint active state
  const [color, setColor] = useState('#3b82f6');
  const [materialStyle, setMaterialStyle] = useState<MaterialStyle>('standard');
  const [selectedMesh, setSelectedMesh] = useState<THREE.Object3D | null>(null);

  // Edit Action States
  const [activeEditAction, setActiveEditAction] = useState<'simplify' | 'split' | 'smooth' | 'emboss' | 'hollow' | null>(null);
  const [simplifyRatio, setSimplifyRatio] = useState<number>(0.5);
  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [splitKeepMode, setSplitKeepMode] = useState<'top' | 'bottom' | 'both'>('both');
  const [smoothFactor, setSmoothFactor] = useState<number>(0.5);
  const [smoothIterations, setSmoothIterations] = useState<number>(2);
  const [embossText, setEmbossText] = useState<string>('BUILDER');
  const [embossSize, setEmbossSize] = useState<number>(1.0);
  const [embossDepth, setEmbossDepth] = useState<number>(0.2);
  const [hollowThickness, setHollowThickness] = useState<number>(0.1);

  // Split view sync
  useEffect(() => {
    if (activeEditAction === 'split' && engine) {
      engine.showCuttingPlane(splitRatio);
    } else {
      engine?.hideCuttingPlane();
    }
  }, [activeEditAction, splitRatio, engine]);

  // Tab change cleanup
  useEffect(() => {
    if (activeTab !== 'edit') {
      setActiveEditAction(null);
      engine?.hideCuttingPlane();
    }
  }, [activeTab, engine]);

  useEffect(() => {
    if (!engine) return;

    const handleHistoryChange = () => {
      setCanUndo(engine.historyManager.canUndo());
      setCanRedo(engine.historyManager.canRedo());
    };

    const handleSelectionChange = (e: any) => {
      setSelectedMesh(e.object);
      if (e.object) {
        // Sync color / material
        const mat = e.object.material as any;
        if (mat) {
          if (mat.color) {
            setColor('#' + mat.color.getHexString());
          }
          const isGlass = mat.transmission > 0.5;
          const isMetal = mat.metalness > 0.8;
          const isMatte = mat.roughness > 0.8;
          setMaterialStyle(
            isGlass ? 'glass' :
            isMetal ? 'metal' :
            isMatte ? 'matte' : 'standard'
          );
        }
      }
    };

    (engine as any).addEventListener('history-changed', handleHistoryChange);
    (engine as any).addEventListener('selection-changed', handleSelectionChange);
    
    // Init state
    setSnapEnabled(engine.snapEnabled);
    setSnapSize(engine.gridSnapSize);
    setShadingEnabled(engine.shadingEnabled);
    setShadowsEnabled(engine.shadowsEnabled);
    setColorsEnabled(engine.colorsEnabled);
    setReflectionsEnabled(engine.reflectionsEnabled);
    setSmoothingEnabled(engine.smoothingEnabled);
    setWireframeEnabled(engine.wireframeEnabled);
    setGridEnabled(engine.gridEnabled);
    setXrayEnabled(engine.xrayEnabled);
    handleHistoryChange();

    return () => {
      (engine as any).removeEventListener('history-changed', handleHistoryChange);
      (engine as any).removeEventListener('selection-changed', handleSelectionChange);
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

  const handleToggleFilter = (filter: string) => {
    if (!engine) return;
    switch (filter) {
      case 'shading':
        engine.shadingEnabled = !shadingEnabled;
        setShadingEnabled(engine.shadingEnabled);
        break;
      case 'shadows':
        engine.shadowsEnabled = !shadowsEnabled;
        setShadowsEnabled(engine.shadowsEnabled);
        break;
      case 'colors':
        engine.colorsEnabled = !colorsEnabled;
        setColorsEnabled(engine.colorsEnabled);
        break;
      case 'reflections':
        engine.reflectionsEnabled = !reflectionsEnabled;
        setReflectionsEnabled(engine.reflectionsEnabled);
        break;
      case 'smoothing':
        engine.smoothingEnabled = !smoothingEnabled;
        setSmoothingEnabled(engine.smoothingEnabled);
        break;
      case 'wireframe':
        engine.wireframeEnabled = !wireframeEnabled;
        setWireframeEnabled(engine.wireframeEnabled);
        break;
      case 'grid':
        engine.gridEnabled = !gridEnabled;
        setGridEnabled(engine.gridEnabled);
        break;
      case 'xray':
        engine.xrayEnabled = !xrayEnabled;
        setXrayEnabled(engine.xrayEnabled);
        break;
    }
    engine.updateViewFilters();
  };

  const PRESET_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#00f0ff', '#ffffff', '#475569', '#1e293b'
  ];

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

  return (
    <header className="glass-panel" style={{ 
      gridRow: 1, 
      display: 'flex', 
      flexDirection: 'column',
      padding: 0,
      height: 'var(--topbar-height)',
      borderRadius: 0,
      borderBottom: '1px solid var(--border-light)',
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      zIndex: 100
    }}>
      
      {/* ROW 1: HEADER & TABS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        padding: '0 20px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        
        {/* Left Side: Hamburger & Brand & Tab Selection */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          
          {/* Hamburger Menu Toggle Button */}
          <button 
            className="btn-icon tooltip" 
            onClick={onToggleLeftMenu}
            style={{ marginRight: '16px', width: '36px', height: '36px' }}
            data-tooltip="Open File Menu"
          >
            <Menu size={18} />
          </button>

          {/* Logo */}
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={onExit}
            title="Exit to Landing Page"
          >
            <div style={{
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={14} color="#07080a" />
            </div>
            <h1 style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.5px', margin: 0 }}>
              MYSOLID<span style={{ color: 'var(--accent-cyan)' }}>BUILDER</span>
            </h1>
          </div>

          {/* Tabs Switcher matching MS 3D Builder */}
          <div className="topbar-tabs-container">
            {(['edit', 'paint', 'view', 'help'] as const).map((tab) => (
              <button
                key={tab}
                className={`topbar-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

        </div>

        {/* Right Side: Quick Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* Undo / Redo */}
          <button 
            className="btn-icon tooltip" 
            onClick={handleUndo} 
            disabled={!canUndo}
            style={{ width: '34px', height: '34px' }}
            data-tooltip="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          
          <button 
            className="btn-icon tooltip" 
            onClick={handleRedo} 
            disabled={!canRedo}
            style={{ width: '34px', height: '34px' }}
            data-tooltip="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-light)', margin: '0 4px' }} />

          {/* Export buttons */}
          <button 
            className="btn-action primary tooltip" 
            onClick={() => engine?.exportGLTF()}
            style={{ height: '34px', padding: '0 12px', fontSize: '0.8rem' }}
            data-tooltip="Export as GLTF 3D model"
          >
            <Download size={14} />
            <span>Export GLTF</span>
          </button>

          <button 
            className="btn-action tooltip" 
            onClick={() => engine?.exportDXF()}
            style={{ height: '34px', padding: '0 12px', fontSize: '0.8rem', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
            data-tooltip="Export as 2D DXF CAD layout for plotting"
          >
            <Download size={14} />
            <span>Export DXF (2D)</span>
          </button>

        </div>

      </div>

      {/* ROW 2: ACTIVE TAB TOOLBAR */}
      <div className="topbar-row-secondary">
        
        {/* VIEW TAB TOOLBAR */}
        {activeTab === 'view' && (
          <>
            <button 
              className={`btn-toolbar-toggle ${shadingEnabled ? 'active' : ''}`}
              onClick={() => handleToggleFilter('shading')}
            >
              <Box size={14} />
              <span>Shading</span>
            </button>

            <button 
              className={`btn-toolbar-toggle ${shadowsEnabled ? 'active' : ''}`}
              onClick={() => handleToggleFilter('shadows')}
            >
              <Sun size={14} />
              <span>Shadows</span>
            </button>

            <button 
              className={`btn-toolbar-toggle ${colorsEnabled ? 'active' : ''}`}
              onClick={() => handleToggleFilter('colors')}
            >
              <Palette size={14} />
              <span>Colors</span>
            </button>

            <button 
              className={`btn-toolbar-toggle ${reflectionsEnabled ? 'active' : ''}`}
              onClick={() => handleToggleFilter('reflections')}
            >
              <Activity size={14} />
              <span>Reflections</span>
            </button>

            <button 
              className={`btn-toolbar-toggle ${smoothingEnabled ? 'active' : ''}`}
              onClick={() => handleToggleFilter('smoothing')}
            >
              <Sparkles size={14} />
              <span>Smoothing</span>
            </button>

            <div className="toolbar-divider" />

            <button 
              className={`btn-toolbar-toggle ${wireframeEnabled ? 'active' : ''}`}
              onClick={() => handleToggleFilter('wireframe')}
            >
              <Grid size={14} />
              <span>Wireframe</span>
            </button>

            <button 
              className={`btn-toolbar-toggle ${gridEnabled ? 'active' : ''}`}
              onClick={() => handleToggleFilter('grid')}
            >
              <Layers size={14} />
              <span>Grid</span>
            </button>

            <button 
              className={`btn-toolbar-toggle ${xrayEnabled ? 'active' : ''}`}
              onClick={() => handleToggleFilter('xray')}
            >
              <Eye size={14} />
              <span>X-ray</span>
            </button>
          </>
        )}

        {/* EDIT TAB TOOLBAR */}
        {activeTab === 'edit' && (
          <>
            {activeEditAction === null ? (
              // Main Edit Options
              <>
                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!selectedMesh ? "Select a shape to simplify" : "Simplify: Reduce polygon count"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => setActiveEditAction('simplify')}
                    disabled={!selectedMesh}
                  >
                    <Activity size={14} />
                    <span>Simplify</span>
                  </button>
                </div>

                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!selectedMesh ? "Select a shape to split" : "Split: Cut mesh along plane"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => setActiveEditAction('split')}
                    disabled={!selectedMesh}
                  >
                    <Grid size={14} />
                    <span>Split</span>
                  </button>
                </div>

                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!selectedMesh ? "Select a shape to smooth" : "Smooth: Relax mesh vertices"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => setActiveEditAction('smooth')}
                    disabled={!selectedMesh}
                  >
                    <Sparkles size={14} />
                    <span>Smooth</span>
                  </button>
                </div>

                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!selectedMesh ? "Select a shape to emboss" : "Emboss: Project 3D text onto surface"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => setActiveEditAction('emboss')}
                    disabled={!selectedMesh}
                  >
                    <Palette size={14} />
                    <span>Emboss</span>
                  </button>
                </div>

                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!selectedMesh ? "Select a shape to extrude down" : "Extrude down: Extend downward faces to floor"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => engine?.extrudeDownSelected()}
                    disabled={!selectedMesh}
                  >
                    <Download size={14} />
                    <span>Extrude down</span>
                  </button>
                </div>

                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!engine || engine.selectedObjects.length < 2 ? "Select 2 or more overlapping shapes to merge" : "Merge: Union Boolean operation"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => engine?.mergeSelected()}
                    disabled={!engine || engine.selectedObjects.length < 2}
                  >
                    <Layers size={14} />
                    <span>Merge</span>
                  </button>
                </div>

                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!engine || engine.selectedObjects.length < 2 ? "Select 2 or more overlapping shapes to intersect" : "Intersect: Intersection Boolean operation"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => engine?.intersectSelected()}
                    disabled={!engine || engine.selectedObjects.length < 2}
                  >
                    <Box size={14} />
                    <span>Intersect</span>
                  </button>
                </div>

                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!engine || engine.selectedObjects.length < 2 ? "Select 2 or more shapes to subtract (primary minus others)" : "Subtract: Subtraction Boolean operation"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => engine?.subtractSelected()}
                    disabled={!engine || engine.selectedObjects.length < 2}
                  >
                    <Ungroup size={14} />
                    <span>Subtract</span>
                  </button>
                </div>

                <div className="tooltip" style={{ display: 'flex' }} data-tooltip={!selectedMesh ? "Select a shape to hollow" : "Hollow: Shell mesh with thickness"}>
                  <button 
                    className="btn-toolbar-toggle"
                    onClick={() => setActiveEditAction('hollow')}
                    disabled={!selectedMesh}
                  >
                    <Box size={14} />
                    <span>Hollow</span>
                  </button>
                </div>
              </>
            ) : (
              // Parameter overlays for active actions
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%' }}>
                
                {/* 1. Simplify parameters */}
                {activeEditAction === 'simplify' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reduction Ratio:</span>
                    <input 
                      type="range" 
                      min="0.05" 
                      max="0.95" 
                      step="0.05" 
                      value={simplifyRatio} 
                      onChange={(e) => setSimplifyRatio(parseFloat(e.target.value))}
                      style={{ width: '120px' }} 
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', width: '35px' }}>{Math.round(simplifyRatio * 100)}%</span>
                  </div>
                )}

                {/* 2. Split parameters */}
                {activeEditAction === 'split' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Split Height:</span>
                      <input 
                        type="range" 
                        min="0.05" 
                        max="0.95" 
                        step="0.01" 
                        value={splitRatio} 
                        onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                        style={{ width: '120px' }} 
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', width: '35px' }}>{Math.round(splitRatio * 100)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keep:</span>
                      {(['top', 'bottom', 'both'] as const).map((mode) => (
                        <button
                          key={mode}
                          className={`btn-toolbar-toggle ${splitKeepMode === mode ? 'active' : ''}`}
                          style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                          onClick={() => setSplitKeepMode(mode)}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Smooth parameters */}
                {activeEditAction === 'smooth' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Factor:</span>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="0.9" 
                        step="0.1" 
                        value={smoothFactor} 
                        onChange={(e) => setSmoothFactor(parseFloat(e.target.value))}
                        style={{ width: '80px' }} 
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{smoothFactor.toFixed(1)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Iterations:</span>
                      <input 
                        type="range" 
                        min="1" 
                        max="5" 
                        step="1" 
                        value={smoothIterations} 
                        onChange={(e) => setSmoothIterations(parseInt(e.target.value))}
                        style={{ width: '80px' }} 
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{smoothIterations}</span>
                    </div>
                  </div>
                )}

                {/* 4. Emboss parameters */}
                {activeEditAction === 'emboss' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Type text..." 
                      value={embossText} 
                      onChange={(e) => setEmbossText(e.target.value)} 
                      style={{ width: '100px', height: '24px', padding: '0 8px', fontSize: '0.75rem' }} 
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Size:</span>
                      <input 
                        type="range" 
                        min="0.2" 
                        max="3.0" 
                        step="0.1" 
                        value={embossSize} 
                        onChange={(e) => setEmbossSize(parseFloat(e.target.value))}
                        style={{ width: '70px' }} 
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{embossSize.toFixed(1)}m</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Depth:</span>
                      <input 
                        type="range" 
                        min="-1.5" 
                        max="1.5" 
                        step="0.1" 
                        value={embossDepth} 
                        onChange={(e) => setEmbossDepth(parseFloat(e.target.value))}
                        style={{ width: '70px' }} 
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{embossDepth >= 0 ? '+' : ''}{embossDepth.toFixed(1)}m</span>
                    </div>
                  </div>
                )}

                {/* 5. Hollow parameters */}
                {activeEditAction === 'hollow' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Wall Thickness:</span>
                    <input 
                      type="range" 
                      min="0.02" 
                      max="0.8" 
                      step="0.02" 
                      value={hollowThickness} 
                      onChange={(e) => setHollowThickness(parseFloat(e.target.value))}
                      style={{ width: '120px' }} 
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{hollowThickness.toFixed(2)}m</span>
                  </div>
                )}

                {/* Action Confirmation Buttons */}
                <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', marginRight: '10px' }}>
                  <button 
                    className="btn-toolbar-toggle active" 
                    onClick={async () => {
                      if (!engine) return;
                      if (activeEditAction === 'simplify') {
                        engine.simplifySelected(simplifyRatio);
                      } else if (activeEditAction === 'split') {
                        engine.splitSelected(splitRatio, splitKeepMode);
                      } else if (activeEditAction === 'smooth') {
                        engine.smoothSelected(smoothFactor, smoothIterations);
                      } else if (activeEditAction === 'emboss') {
                        await engine.embossSelected(embossText, embossSize, embossDepth);
                      } else if (activeEditAction === 'hollow') {
                        engine.hollowSelected(hollowThickness);
                      }
                      setActiveEditAction(null);
                    }}
                    style={{ backgroundColor: 'var(--accent-cyan)', color: '#000', padding: '3px 10px' }}
                    title="Apply Action"
                  >
                    <Check size={14} />
                    <span style={{ fontWeight: 700 }}>Accept</span>
                  </button>
                  
                  <button 
                    className="btn-toolbar-toggle" 
                    onClick={() => setActiveEditAction(null)}
                    style={{ borderColor: '#ef4444', color: '#ef4444', padding: '3px 10px' }}
                    title="Cancel Action"
                  >
                    <X size={14} />
                    <span>Cancel</span>
                  </button>
                </div>

              </div>
            )}

            <div className="toolbar-divider" />

            {/* Grid Snapping */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
                <Grid size={14} />
              </button>
              
              <select 
                className="input-field" 
                style={{ 
                  height: '24px', 
                  padding: '0 4px', 
                  width: '75px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.7rem',
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
          </>
        )}

        {/* PAINT TAB TOOLBAR */}
        {activeTab === 'paint' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Swatches:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {PRESET_COLORS.map(hex => (
                  <div 
                    key={hex}
                    className={`color-swatch ${color.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`}
                    style={{ backgroundColor: hex, width: '18px', height: '18px', borderRadius: '4px' }}
                    onClick={() => handleColorChange(hex)}
                  />
                ))}
                <input 
                  type="color" 
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  style={{
                    width: '18px',
                    height: '18px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: 'transparent',
                    padding: 0
                  }} 
                />
              </div>
            </div>

            <div className="toolbar-divider" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Finish:</span>
              {(['standard', 'matte', 'metal', 'glass'] as MaterialStyle[]).map((style) => (
                <button
                  key={style}
                  className={`btn-toolbar-toggle ${materialStyle === style ? 'active' : ''}`}
                  style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                  onClick={() => handleMaterialStyleChange(style)}
                >
                  {style === 'standard' ? 'Default' : style}
                </button>
              ))}
            </div>
          </>
        )}

        {/* HELP TAB TOOLBAR */}
        {activeTab === 'help' && (
          <>
            <button 
              className="btn-toolbar-toggle"
              onClick={onOpenHelp}
            >
              <HelpCircle size={14} />
              <span>Launch Quick Start Guide</span>
            </button>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Hotkeys: [Q] Select | [W] Move | [E] Rotate | [R] Scale | [T] Extrude | [Del] Delete
            </span>
          </>
        )}

      </div>

    </header>
  );
};
