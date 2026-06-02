import * as THREE from 'three';

export class TemplateManager {
  static createCastle(scene: THREE.Scene, historyAction: (mesh: THREE.Mesh) => void) {
    const meshes: THREE.Mesh[] = [];

    // Colors
    const stoneColor = 0x8a95a5;
    const roofColor = 0xc2410c; // Terracotta red
    const woodColor = 0x78350f; // Brown
    const grassColor = 0x15803d; // Green

    // Ground
    const groundGeo = new THREE.BoxGeometry(40, 0.2, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: grassColor, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.name = 'Green Field';
    ground.position.set(0, -0.1, 0);
    ground.receiveShadow = true;
    meshes.push(ground);

    // Main Keep (Center)
    const keepGeo = new THREE.BoxGeometry(10, 8, 10);
    const keepMat = new THREE.MeshStandardMaterial({ color: stoneColor, roughness: 0.9, metalness: 0.1 });
    const keep = new THREE.Mesh(keepGeo, keepMat);
    keep.name = 'Main Keep';
    keep.position.set(0, 4, 0);
    keep.castShadow = true;
    keep.receiveShadow = true;
    meshes.push(keep);

    // Keep Roof (Pyramid / Wedge)
    const roofGeo = new THREE.ConeGeometry(8.5, 5, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.name = 'Keep Roof';
    roof.position.set(0, 10.5, 0);
    roof.rotation.y = Math.PI / 4; // Align pyramid walls with cube walls
    roof.castShadow = true;
    meshes.push(roof);

    // Towers (4 Corners of the keep)
    const towerRadius = 2;
    const towerHeight = 11;
    const towerPositions = [
      { x: -5, z: -5, name: 'Northwest Tower' },
      { x: 5, z: -5, name: 'Northeast Tower' },
      { x: -5, z: 5, name: 'Southwest Tower' },
      { x: 5, z: 5, name: 'Southeast Tower' },
    ];

    towerPositions.forEach((pos) => {
      const towerGeo = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
      const tower = new THREE.Mesh(towerGeo, keepMat);
      tower.name = pos.name;
      tower.position.set(pos.x, towerHeight / 2, pos.z);
      tower.castShadow = true;
      tower.receiveShadow = true;
      meshes.push(tower);

      const tRoofGeo = new THREE.ConeGeometry(towerRadius * 1.3, 4, 16);
      const tRoof = new THREE.Mesh(tRoofGeo, roofMat);
      tRoof.name = `${pos.name} Roof`;
      tRoof.position.set(pos.x, towerHeight + 2, pos.z);
      tRoof.castShadow = true;
      meshes.push(tRoof);
    });

    // Front Gate
    const gateGeo = new THREE.BoxGeometry(4, 3, 1);
    const gateMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.9 });
    const gate = new THREE.Mesh(gateGeo, gateMat);
    gate.name = 'Castle Gate';
    gate.position.set(0, 1.5, 5.1);
    gate.castShadow = true;
    meshes.push(gate);

    // Add everything to scene and register with history
    meshes.forEach((mesh) => {
      scene.add(mesh);
      historyAction(mesh);
    });
  }

  static createRoom(scene: THREE.Scene, historyAction: (mesh: THREE.Mesh) => void) {
    const meshes: THREE.Mesh[] = [];

    // Colors
    const woodColor = 0xb45309; // Warm Brown
    const metalColor = 0x334155; // Slate Blue Metal
    const fabricColor = 0x6366f1; // Indigo
    const screenColor = 0x0f172a; // Dark Slate
    const floorColor = 0xddc3a5; // Light wood floor
    const wallColor = 0xe2e8f0; // Off white

    // Floor
    const floorGeo = new THREE.BoxGeometry(30, 0.2, 30);
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.5 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.name = 'Parquet Floor';
    floor.position.set(0, -0.1, 0);
    floor.receiveShadow = true;
    meshes.push(floor);

    // Walls
    const wallLGeo = new THREE.BoxGeometry(0.5, 12, 30);
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });
    const wallL = new THREE.Mesh(wallLGeo, wallMat);
    wallL.name = 'Left Wall';
    wallL.position.set(-15, 6, 0);
    wallL.receiveShadow = true;
    meshes.push(wallL);

    const wallBGeo = new THREE.BoxGeometry(30, 12, 0.5);
    const wallB = new THREE.Mesh(wallBGeo, wallMat);
    wallB.name = 'Back Wall';
    wallB.position.set(0, 6, -15);
    wallB.receiveShadow = true;
    meshes.push(wallB);

    // Desk Table
    const tableTopGeo = new THREE.BoxGeometry(10, 0.4, 5);
    const tableTopMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.3 });
    const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
    tableTop.name = 'Desk Top';
    tableTop.position.set(0, 3, -10);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    meshes.push(tableTop);

    // Table legs (4)
    const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 3, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: metalColor, roughness: 0.2, metalness: 0.8 });
    const legOffsets = [
      { x: -4.5, z: -2 },
      { x: 4.5, z: -2 },
      { x: -4.5, z: 2 },
      { x: 4.5, z: 2 },
    ];

    legOffsets.forEach((offset, idx) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.name = `Desk Leg ${idx + 1}`;
      leg.position.set(offset.x, 1.5, -10 + offset.z);
      leg.castShadow = true;
      meshes.push(leg);
    });

    // Office Chair Seat
    const seatGeo = new THREE.BoxGeometry(2.4, 0.3, 2.4);
    const fabricMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.8 });
    const seat = new THREE.Mesh(seatGeo, fabricMat);
    seat.name = 'Chair Seat';
    seat.position.set(0, 1.8, -6);
    seat.castShadow = true;
    meshes.push(seat);

    // Chair Back
    const backGeo = new THREE.BoxGeometry(2.4, 2, 0.3);
    const back = new THREE.Mesh(backGeo, fabricMat);
    back.name = 'Chair Back';
    back.position.set(0, 2.8, -4.9);
    back.castShadow = true;
    meshes.push(back);

    // Chair Base
    const baseGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.8, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: metalColor, metalness: 0.9, roughness: 0.1 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.name = 'Chair Stem';
    base.position.set(0, 0.9, -6);
    base.castShadow = true;
    meshes.push(base);

    // Desktop Monitor
    const screenGeo = new THREE.BoxGeometry(4, 2.4, 0.15);
    const screenMat = new THREE.MeshStandardMaterial({ color: screenColor, roughness: 0.2 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.name = 'Monitor Screen';
    screen.position.set(0, 4.4, -11);
    screen.castShadow = true;
    meshes.push(screen);

    const standGeo = new THREE.CylinderGeometry(0.1, 0.15, 1, 8);
    const stand = new THREE.Mesh(standGeo, baseMat);
    stand.name = 'Monitor Stand';
    stand.position.set(0, 3.7, -11);
    stand.castShadow = true;
    meshes.push(stand);

    // Add everything to scene and register with history
    meshes.forEach((mesh) => {
      scene.add(mesh);
      historyAction(mesh);
    });
  }

  static createPlayground(scene: THREE.Scene, historyAction: (mesh: THREE.Mesh) => void) {
    const meshes: THREE.Mesh[] = [];

    // Colors
    const grassColor = 0x22c55e;
    const sandColor = 0xfef08a; // Light Yellow
    const woodColor = 0x854d0e; // Dark Yellowish Brown
    const primaryRed = 0xef4444;
    const primaryBlue = 0x3b82f6;

    // Ground
    const groundGeo = new THREE.BoxGeometry(50, 0.2, 50);
    const groundMat = new THREE.MeshStandardMaterial({ color: grassColor, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.name = 'Grass Ground';
    ground.position.set(0, -0.1, 0);
    ground.receiveShadow = true;
    meshes.push(ground);

    // Sandbox Frame
    const sandBoxGeo = new THREE.BoxGeometry(12, 0.6, 12);
    const frameMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.7 });
    const sandboxFrame = new THREE.Mesh(sandBoxGeo, frameMat);
    sandboxFrame.name = 'Sandbox Frame';
    sandboxFrame.position.set(-10, 0.3, -10);
    sandboxFrame.castShadow = true;
    meshes.push(sandboxFrame);

    // Sandbox Sand (Inside)
    const sandGeo = new THREE.BoxGeometry(11, 0.5, 11);
    const sandMat = new THREE.MeshStandardMaterial({ color: sandColor, roughness: 0.9 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.name = 'Golden Sand';
    sand.position.set(-10, 0.35, -10);
    sand.receiveShadow = true;
    meshes.push(sand);

    // Swing Frame Left A-Pole
    const aPoleGeo = new THREE.CylinderGeometry(0.15, 0.15, 8, 8);
    const swingFrameMat = new THREE.MeshStandardMaterial({ color: primaryRed, roughness: 0.5 });
    
    const pole1 = new THREE.Mesh(aPoleGeo, swingFrameMat);
    pole1.name = 'Swing Frame A1';
    pole1.position.set(8, 3.8, -2);
    pole1.rotation.z = 0.2;
    pole1.castShadow = true;
    meshes.push(pole1);

    const pole2 = new THREE.Mesh(aPoleGeo, swingFrameMat);
    pole2.name = 'Swing Frame A2';
    pole2.position.set(8, 3.8, 2);
    pole2.rotation.x = -0.25;
    pole2.castShadow = true;
    meshes.push(pole2);

    const pole3 = new THREE.Mesh(aPoleGeo, swingFrameMat);
    pole3.name = 'Swing Frame B1';
    pole3.position.set(18, 3.8, -2);
    pole3.rotation.z = -0.2;
    pole3.castShadow = true;
    meshes.push(pole3);

    const pole4 = new THREE.Mesh(aPoleGeo, swingFrameMat);
    pole4.name = 'Swing Frame B2';
    pole4.position.set(18, 3.8, 2);
    pole4.rotation.x = 0.25;
    pole4.castShadow = true;
    meshes.push(pole4);

    // Top beam
    const beamGeo = new THREE.CylinderGeometry(0.15, 0.15, 10.5, 8);
    const beam = new THREE.Mesh(beamGeo, swingFrameMat);
    beam.name = 'Swing Top Beam';
    beam.position.set(13, 7.5, 0);
    beam.rotation.z = Math.PI / 2;
    beam.castShadow = true;
    meshes.push(beam);

    // Swing Seat
    const seatGeo = new THREE.BoxGeometry(2, 0.1, 0.8);
    const seatMat = new THREE.MeshStandardMaterial({ color: primaryBlue, roughness: 0.6 });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.name = 'Swing Seat';
    seat.position.set(13, 1.8, 0);
    seat.castShadow = true;
    meshes.push(seat);

    // Add everything to scene and register with history
    meshes.forEach((mesh) => {
      scene.add(mesh);
      historyAction(mesh);
    });
  }
}
