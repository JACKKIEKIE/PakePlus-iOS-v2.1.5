import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CNCOutput, MachineOperationType } from '../types';

interface SimulationPanelProps {
  data: CNCOutput | null;
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const toolRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Animation now tracks curve progress
  const animationState = useRef<{
      curve: THREE.CurvePath<THREE.Vector3> | null;
      progress: number;
      speed: number;
      isPlaying: boolean;
  }>({ curve: null, progress: 0, speed: 0.002, isPlaying: true });

  useEffect(() => {
    if (!containerRef.current) return;
    if (rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
    }
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null; 
    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
    camera.position.set(100, -120, 100); 
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, -50, 100);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-50, 50, 50);
    scene.add(backLight);

    const gridHelper = new THREE.GridHelper(200, 20, 0x94a3b8, 0xe2e8f0);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
    const axesHelper = new THREE.AxesHelper(20);
    scene.add(axesHelper);

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      const state = animationState.current;
      if (toolRef.current && state.curve && state.isPlaying) {
          state.progress += state.speed;
          if (state.progress >= 1) state.progress = 0;
          
          const point = state.curve.getPoint(state.progress);
          if (point) {
            toolRef.current.position.copy(point);
            toolRef.current.rotation.z += 0.5; 
          }
      }
    };
    animate();

    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (cameraRef.current && rendererRef.current) {
                const { width, height } = entry.contentRect;
                cameraRef.current.aspect = width / height;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(width, height);
            }
        }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    scene.children.forEach(c => { if (c.userData.isDynamic) scene.remove(c); });
    if (!data) return;

    // 1. Stock (Semi-transparent)
    const { stock } = data;
    const stockGroup = new THREE.Group();
    stockGroup.userData.isDynamic = true;
    const stockMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x94a3b8, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.15, transmission: 0.2, side: THREE.DoubleSide, depthWrite: false 
    });
    let stockMesh;
    if (stock.shape === 'CYLINDRICAL') {
        const r = stock.diameter / 2;
        const h = stock.height;
        const geometry = new THREE.CylinderGeometry(r, r, h, 64);
        geometry.rotateX(Math.PI / 2); 
        geometry.translate(0, 0, -h/2);
        stockMesh = new THREE.Mesh(geometry, stockMaterial);
    } else {
        const geometry = new THREE.BoxGeometry(stock.width, stock.length, stock.height);
        geometry.translate(0, 0, -stock.height/2);
        stockMesh = new THREE.Mesh(geometry, stockMaterial);
    }
    const edges = new THREE.EdgesGeometry(stockMesh.geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 }));
    stockGroup.add(stockMesh);
    stockGroup.add(line);
    scene.add(stockGroup);

    // 2. Paths (Segments)
    const colors = [0xd97706, 0x059669, 0x2563eb, 0xdb2777, 0x7c3aed];
    const globalCurvePath = new THREE.CurvePath<THREE.Vector3>();

    if (data.operations) {
        data.operations.forEach((op, idx) => {
            const color = colors[idx % colors.length];
            const toolRadius = (op.tool_diameter || 10) / 2;
            const safeZ = 5;
            
            // Build the curve for this operation
            const opCurvePath = new THREE.CurvePath<THREE.Vector3>();
            
            // Start Point
            let currentPoint = new THREE.Vector3(op.x, op.y, safeZ);
            
            // Plunge
            const plungeEnd = new THREE.Vector3(op.x, op.y, -op.z_depth);
            opCurvePath.add(new THREE.LineCurve3(currentPoint, plungeEnd));
            currentPoint = plungeEnd;

            // Follow Segments
            if (op.type === MachineOperationType.CONTOUR && op.path_segments) {
                op.path_segments.forEach(seg => {
                    const endPoint = new THREE.Vector3(seg.x, seg.y, -op.z_depth);
                    
                    if (seg.type === 'LINE') {
                        opCurvePath.add(new THREE.LineCurve3(currentPoint, endPoint));
                    } else if ((seg.type === 'ARC_CW' || seg.type === 'ARC_CCW') && seg.cx !== undefined && seg.cy !== undefined) {
                         // Math for Arc
                         const center = new THREE.Vector3(seg.cx, seg.cy, -op.z_depth);
                         const startVec = new THREE.Vector3().subVectors(currentPoint, center);
                         const endVec = new THREE.Vector3().subVectors(endPoint, center);
                         
                         const radius = startVec.length();
                         const startAngle = Math.atan2(startVec.y, startVec.x);
                         let endAngle = Math.atan2(endVec.y, endVec.x);
                         
                         // Adjust angles for CW/CCW
                         const isClockwise = seg.type === 'ARC_CW';
                         
                         if (isClockwise && endAngle > startAngle) endAngle -= Math.PI * 2;
                         if (!isClockwise && endAngle < startAngle) endAngle += Math.PI * 2;

                         const curve = new THREE.EllipseCurve(
                             center.x, center.y,
                             radius, radius,
                             startAngle, endAngle,
                             isClockwise,
                             0
                         );
                         // Convert 2D EllipseCurve to 3D Points
                         const pts = curve.getPoints(50).map(v => new THREE.Vector3(v.x, v.y, -op.z_depth));
                         // Three.js doesn't have a simple ArcCurve3, so we fake it with Catmull or just LineSegments
                         const arcGeometryCurve = new THREE.CatmullRomCurve3(pts);
                         opCurvePath.add(arcGeometryCurve);
                    }
                    currentPoint = endPoint;
                });
            } 
            // Handle simple Pockets/Drills if needed (omitted for brevity, they work similarly)

            // Retract
            const retractEnd = new THREE.Vector3(currentPoint.x, currentPoint.y, safeZ);
            opCurvePath.add(new THREE.LineCurve3(currentPoint, retractEnd));
            
            // Add to Global (for animation)
            opCurvePath.curves.forEach(c => globalCurvePath.add(c));

            // Render Tube
            if (opCurvePath.curves.length > 0) {
                 const tubeGeo = new THREE.TubeGeometry(opCurvePath, 200, toolRadius, 8, false);
                 const tubeMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.6, side: THREE.FrontSide });
                 const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
                 tubeMesh.userData.isDynamic = true;
                 scene.add(tubeMesh);
            }
        });
    }

    // 3. Tool
    const toolGroup = new THREE.Group();
    toolGroup.userData.isDynamic = true;
    const holderGeom = new THREE.CylinderGeometry(5, 7, 12, 16);
    holderGeom.rotateX(Math.PI/2);
    holderGeom.translate(0, 0, 20); 
    const holderMesh = new THREE.Mesh(holderGeom, new THREE.MeshStandardMaterial({ color: 0x334155 }));
    toolGroup.add(holderMesh);
    const cutterGeom = new THREE.CylinderGeometry(2, 2, 30, 16);
    cutterGeom.rotateX(Math.PI/2);
    cutterGeom.translate(0, 0, 5);
    const cutterMesh = new THREE.Mesh(cutterGeom, new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 }));
    toolGroup.add(cutterMesh);
    scene.add(toolGroup);
    toolRef.current = toolGroup;

    animationState.current = {
        curve: globalCurvePath.curves.length > 0 ? globalCurvePath : null,
        progress: 0,
        speed: 0.002,
        isPlaying: true
    };

  }, [data]);

  return (
    <div className="glass-panel h-full w-full flex flex-col rounded-3xl overflow-hidden shadow-xl shadow-slate-200/40 bg-white/40 relative group">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-white/80 px-3 py-1.5 rounded-lg border border-slate-100 backdrop-blur-sm shadow-sm flex items-center gap-3">
            <h3 className="font-medium text-slate-700 text-xs flex items-center gap-2">
                <i className="fa-solid fa-cubes text-blue-500"></i>
                3D 高精度仿真 (Arc Support)
            </h3>
        </div>
      </div>
      <div className="flex-1 w-full h-full relative" ref={containerRef}></div>
      {!data && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-slate-400 bg-white/20 backdrop-blur-[2px]">
             <i className="fa-solid fa-cube text-5xl mb-4 opacity-40"></i>
             <p className="font-medium tracking-wide text-sm opacity-80">等待加工数据生成...</p>
        </div>
      )}
    </div>
  );
};

export default SimulationPanel;