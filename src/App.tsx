import { useState, useEffect } from 'react';
import { Viewport } from './components/Viewport';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { MeasurementsHUD } from './components/MeasurementsHUD';
import { WelcomeModal } from './components/WelcomeModal';
import { LandingPage } from './components/LandingPage';
import { EditorEngine } from './engine/EditorEngine';
import { HelpCircle, Sparkles } from 'lucide-react';

function App() {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [engine, setEngine] = useState<EditorEngine | null>(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);
  const [tutorialStep, setTutorialStep] = useState<string | null>(null);

  const handleEngineReady = (editorEngine: EditorEngine) => {
    setEngine(editorEngine);
  };

  useEffect(() => {
    if (!engine) return;

    const handleSceneChange = () => {
      // If user places cube on the grid, advance to click-move-btn step
      if (tutorialStep === 'click-grid') {
        setTutorialStep('click-move-btn');
      }
    };

    (engine as any).addEventListener('scene-changed', handleSceneChange);

    return () => {
      (engine as any).removeEventListener('scene-changed', handleSceneChange);
    };
  }, [engine, tutorialStep]);

  if (view === 'landing') {
    return <LandingPage onLaunch={() => setView('app')} />;
  }

  return (
    <div className="workspace-container">
      {/* Top Navigation */}
      <Topbar engine={engine} onOpenHelp={() => setIsWelcomeOpen(true)} onExit={() => setView('landing')} />

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

              {tutorialStep === 'tutorial-complete' && (
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <strong>What you did:</strong> Spawning a 3D Box added a new mesh to the WebGL scene structure. The translation controls modify position vectors in real time.
                </div>
              )}

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
