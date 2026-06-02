import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Box, 
  Sparkles, 
  Layers, 
  Cpu, 
  History, 
  Download, 
  ArrowRight, 
  Globe, 
  Server, 
  Shield,
  Activity,
  Maximize2
} from 'lucide-react';

interface LandingPageProps {
  onLaunch: () => void;
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Three.js Scene Setup
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    // Add atmospheric deep fog to match app
    scene.fog = new THREE.FogExp2(0x07080a, 0.03);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(6, 4, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't orbit below grid
    controls.minDistance = 4;
    controls.maxDistance = 15;

    let isUserInteracting = false;
    controls.addEventListener('start', () => {
      isUserInteracting = true;
    });
    controls.addEventListener('end', () => {
      isUserInteracting = false;
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Dynamic accent lighting (cyan/purple glow)
    const cyanLight = new THREE.PointLight(0x00f0ff, 1.5, 10);
    cyanLight.position.set(-2, 1, 2);
    scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0xbd00ff, 1.5, 10);
    purpleLight.position.set(2, -1, -2);
    scene.add(purpleLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(20, 20, 0x00f0ff, 0x1f2937);
    gridHelper.position.y = -1;
    (gridHelper.material as THREE.Material).opacity = 0.15;
    (gridHelper.material as THREE.Material).transparent = true;
    scene.add(gridHelper);

    // Central Floating Composition Group
    const compGroup = new THREE.Group();
    scene.add(compGroup);

    // Create physical glass/metal shapes representing MySolidBuilder primitives
    // 1. Base Platform (Matte Slate)
    const baseGeo = new THREE.BoxGeometry(2.5, 0.2, 2.5);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.8,
      metalness: 0.2
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.8;
    baseMesh.receiveShadow = true;
    compGroup.add(baseMesh);

    // 2. Central Metallic Block (Chrome-like scale/extrusion representation)
    const boxGeo = new THREE.BoxGeometry(1, 1.6, 1);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x0072ff,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.set(-0.4, 0.1, -0.4);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    compGroup.add(boxMesh);

    // 3. Glass Cone (Physical translucent glass)
    const coneGeo = new THREE.ConeGeometry(0.6, 1.2, 32);
    const coneMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.9,
      ior: 1.5,
      thickness: 0.5,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(0.5, -0.1, 0.4);
    coneMesh.castShadow = true;
    compGroup.add(coneMesh);

    // 4. Glass Sphere (Cyan translucent)
    const sphereGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: 0xbd00ff,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.2,
      transmission: 0.8,
      ior: 1.3
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.set(-0.3, 1.3, -0.2);
    sphereMesh.castShadow = true;
    compGroup.add(sphereMesh);

    // Raycasting for interactive hover effects on landing page shapes
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh: THREE.Mesh | null = null;
    let originalEmissive = new THREE.Color(0, 0, 0);

    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([boxMesh, coneMesh, sphereMesh]);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        if (hoveredMesh !== hit) {
          // Reset previous hover
          if (hoveredMesh && hoveredMesh.material) {
            const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(originalEmissive);
            mat.emissiveIntensity = 0;
          }
          // Set new hover
          hoveredMesh = hit;
          const mat = hit.material as THREE.MeshStandardMaterial;
          originalEmissive.copy(mat.emissive);
          mat.emissive.setHex(0x00f0ff);
          mat.emissiveIntensity = 0.5;
          document.body.style.cursor = 'pointer';
        }
      } else {
        if (hoveredMesh && hoveredMesh.material) {
          const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
          mat.emissive.copy(originalEmissive);
          mat.emissiveIntensity = 0;
          hoveredMesh = null;
        }
        document.body.style.cursor = 'default';
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationId: number;

    const animate = (time: number) => {
      animationId = requestAnimationFrame(animate);

      // Rotate group gently when not dragging
      if (!isUserInteracting) {
        compGroup.rotation.y += 0.003;
      }

      // Add a slight hover float effect to the group
      compGroup.position.y = Math.sin(time * 0.001) * 0.15;

      // Gentle rotation for the sphere too
      sphereMesh.position.y = 1.3 + Math.sin(time * 0.002) * 0.1;

      controls.update();
      renderer.render(scene, camera);
    };

    animationId = requestAnimationFrame(animate);

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && containerRef.current) {
        renderer.domElement.removeEventListener('mousemove', handleMouseMove);
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="landing-container">
      {/* Top Navbar */}
      <header className="landing-header">
        <div className="landing-logo">
          <div className="logo-icon">
            <Box size={18} color="var(--bg-dark)" />
          </div>
          <span>mysolidbuilder<span className="dot-ext">.com</span></span>
        </div>
        <nav className="landing-nav">
          <a href="#features">Features</a>
          <a href="#deploy">VPS Setup</a>
          <a href="https://github.com/bytewrench/mysolidbuilder-private" target="_blank" rel="noopener noreferrer" className="github-link">
            GitHub
          </a>
        </nav>
        <button className="btn-launch" onClick={onLaunch}>
          Launch App <ArrowRight size={14} />
        </button>
      </header>

      {/* Main Hero Section */}
      <section className="landing-hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={12} color="var(--accent-cyan)" />
            <span>WebGL 3D Modeling Engine</span>
          </div>
          <h1 className="hero-title">
            Making Solids in <span className="gradient-text">3D</span>, Simplified.
          </h1>
          <p className="hero-tagline">
            An interactive, high-fidelity 3D CAD modeling application inspired by SketchUp. 
            Design, paint, extrude, and Persist physical solid shapes directly in your browser.
          </p>
          <div className="hero-actions">
            <button className="btn-cta-primary" onClick={onLaunch}>
              Start Modeling Free
              <ArrowRight size={16} />
            </button>
            <a href="#features" className="btn-cta-secondary">
              Explore Features
            </a>
          </div>
        </div>

        {/* 3D Viewport Hero Render */}
        <div className="hero-viewport-container">
          <div className="viewport-card">
            <div className="viewport-header">
              <div className="dot red"></div>
              <div className="dot yellow"></div>
              <div className="dot green"></div>
              <span className="window-title">Live 3D Renderer (Draggable)</span>
              <div className="hud-indicator">
                <Activity size={10} color="var(--accent-cyan)" /> 60 FPS
              </div>
            </div>
            <div ref={containerRef} className="viewport-canvas-host">
              {/* WebGL Canvas mounts here */}
            </div>
            <div className="viewport-overlay-tips">
              <Maximize2 size={12} color="var(--text-secondary)" />
              <span>Left-click + drag to orbit. Hover shapes to highlight.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core App Features Grid */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2 className="section-title">Engineered for Creative Speed</h2>
          <p className="section-subtitle">
            A compact but extremely capable system built from the ground up on high-performance WebGL.
          </p>
        </div>

        <div className="features-grid">
          {featuresData.map((feat, idx) => (
            <div 
              key={idx} 
              className={`feature-card ${hoveredFeature === idx ? 'active' : ''}`}
              onMouseEnter={() => setHoveredFeature(idx)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div className="feature-icon-wrapper">
                {feat.icon}
              </div>
              <h3 className="feature-card-title">{feat.title}</h3>
              <p className="feature-card-desc">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hosting & VPS Deployment Section */}
      <section id="deploy" className="deploy-section">
        <div className="deploy-card glass-panel">
          <div className="deploy-badge">
            <Server size={14} color="var(--accent-cyan)" />
            <span>Self-Hosting / VPS Integration</span>
          </div>
          <div className="deploy-grid">
            <div className="deploy-info">
              <h2 className="deploy-title">Run Globally on Your Own VPS</h2>
              <p className="deploy-desc">
                MySolidBuilder is fully static and production-optimized. Because the engine runs fully inside the client's WebGL browser thread, hosting requires zero database servers or complex dynamic runtimes.
              </p>
              
              <ul className="deploy-list">
                <li>
                  <div className="list-icon"><Shield size={14} /></div>
                  <div><strong>Let's Encrypt SSL:</strong> Free automatic HTTPS certificates through Coolify.</div>
                </li>
                <li>
                  <div className="list-icon"><Globe size={14} /></div>
                  <div><strong>IONOS DNS:</strong> Complete setup under your custom `mysolidbuilder.com` domain.</div>
                </li>
                <li>
                  <div className="list-icon"><Cpu size={14} /></div>
                  <div><strong>GitHub Auto-Deploy:</strong> Push updates to your private repository to trigger automatic server rebuilding.</div>
                </li>
              </ul>
            </div>

            <div className="deploy-config-box">
              <div className="config-header">
                <span className="terminal-title">coolify-docker-compose.yaml</span>
              </div>
              <pre className="config-code">
{`version: '3.8'
services:
  mysolidbuilder:
    image: node:20-alpine
    container_name: mysolidbuilder_app
    command: sh -c "npm install && npm run build && npx serve -s dist -l 3000"
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped`}
              </pre>
              <div className="config-footer">
                <span>Designed for Coolify Nixpacks / Static deployments</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agile Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <div className="logo-icon small">
              <Box size={14} color="var(--bg-dark)" />
            </div>
            <span>mysolidbuilder<span className="dot-ext">.com</span></span>
          </div>
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} MySolidBuilder. Proprietary. Co-authored by bytewrench & Antigravity.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Features Array Data
const featuresData = [
  {
    icon: <Cpu size={24} color="var(--accent-cyan)" />,
    title: "Push-Pull Extrusion",
    desc: "Scale solid block faces along their normal axis while anchoring the opposite face. Math projections translate the mesh center automatically."
  },
  {
    icon: <Layers size={24} color="var(--accent-blue)" />,
    title: "Measurements HUD",
    desc: "A custom Value Control Box tracking coordinates, active extrusion offsets, and calculated metric volumes in real time."
  },
  {
    icon: <Sparkles size={24} color="var(--accent-cyan)" />,
    title: "Glass & Metal Materials",
    desc: "Switch shapes between physical metallic chrome reflection, custom matte finishes, and transparent light-refracting glass materials."
  },
  {
    icon: <History size={24} color="var(--accent-blue)" />,
    title: "Command-Pattern Undo",
    desc: "A robust structural command history stack logging additions, translations, colors, and deletions with instant undo/redo capabilities."
  },
  {
    icon: <Download size={24} color="var(--accent-cyan)" />,
    title: "GLTF & Local Persistence",
    desc: "Export your creations instantly to standard 3D GLTF files for Blender, or persist your state automatically to survive browser reloads."
  },
  {
    icon: <Box size={24} color="var(--accent-blue)" />,
    title: "Starter Templates",
    desc: "Instant loading castle layouts, lived-in study rooms, and grass playground configurations to bootstrap your creative layout."
  }
];
