import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, fb) => cs.getPropertyValue(n).trim() || fb;
  return {
    good: get('--good', '#22b14c'),
    warning: get('--warning', '#fab219'),
    critical: get('--critical', '#e05252'),
    neutral: get('--muted', '#727d92'),
    accent: get('--accent', '#5b8cff'),
    accent2: get('--accent-2', '#a56bff'),
    ring: get('--chart-axis', '#3a4252'),
    theme: document.documentElement.dataset.theme || 'dark',
  };
}

const ORBIT_RADIUS = 4.3;
const DEFAULT_CAM = new THREE.Vector3(0, 4.6, 12.4);
const COMPACT_CAM = new THREE.Vector3(0, 6.2, 13.2);
const CORE_LABEL_OFFSET = new THREE.Vector3(0, -1.75, 0);

const nodeSize = (key) => (key === 'academics' || key === 'goals' ? 0.48 : 0.4);

function nodePosition(index, count) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(Math.cos(angle) * ORBIT_RADIUS, Math.sin(angle * 2) * 0.45, Math.sin(angle) * ORBIT_RADIUS);
}

function AreaNode({ area, position, colors, selected, hovered, onHover, onSelect, nodeRefs }) {
  const group = useRef();
  const mesh = useRef();
  const color = colors[area.tone] || colors.neutral;
  const size = nodeSize(area.key);
  const score = Math.max(0, Math.min(100, area.score ?? 0));

  useEffect(() => {
    const refs = nodeRefs.current;
    refs[area.key] = group.current;
    return () => {
      delete refs[area.key];
    };
  }, [area.key, nodeRefs]);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += dt * 0.5;
    mesh.current.rotation.x += dt * 0.15;
    const target = selected ? 1.35 : hovered ? 1.2 : 1;
    mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, target, Math.min(1, dt * 8)));
  });

  return (
    <group ref={group} position={position}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(area.key);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = '';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(area.key);
        }}
      >
        <icosahedronGeometry args={[size, 3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.85 : hovered ? 0.65 : 0.38} roughness={0.32} metalness={0.25} />
      </mesh>
      <Billboard>
        <mesh>
          <torusGeometry args={[size + 0.2, 0.012, 8, 72]} />
          <meshBasicMaterial color={colors.ring} transparent opacity={0.5} />
        </mesh>
        {area.score != null && score > 0 && (
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[size + 0.2, 0.035, 10, 96, (Math.PI * 2 * score) / 100]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        )}
      </Billboard>
    </group>
  );
}

function Core({ colors }) {
  const shell = useRef();
  const inner = useRef();
  useFrame((state, dt) => {
    if (shell.current) {
      shell.current.rotation.y += dt * 0.2;
      shell.current.rotation.z += dt * 0.05;
    }
    if (inner.current) inner.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.035);
  });
  return (
    <group>
      <mesh ref={inner}>
        <sphereGeometry args={[0.95, 48, 48]} />
        <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.7} roughness={0.25} metalness={0.3} />
      </mesh>
      <mesh ref={shell}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color={colors.accent2} wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function OrbitRings({ colors }) {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 160; i += 1) {
      const a = (i / 160) * Math.PI * 2 - Math.PI / 2;
      pts.push([Math.cos(a) * ORBIT_RADIUS, Math.sin(a * 2) * 0.45, Math.sin(a) * ORBIT_RADIUS]);
    }
    return pts;
  }, []);
  return (
    <>
      <Line points={points} color={colors.ring} lineWidth={1} transparent opacity={0.6} />
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ORBIT_RADIUS + 1.4, ORBIT_RADIUS + 1.42, 128]} />
        <meshBasicMaterial color={colors.ring} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function CameraRig({ selected, nodeRefs, controls, home }) {
  const { camera, size } = useThree();
  const animating = useRef(false);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    animating.current = true;
  }, [selected, size.width, size.height]);

  useFrame(() => {
    if (!animating.current || !controls.current) return;
    if (selected && nodeRefs.current[selected]) {
      nodeRefs.current[selected].getWorldPosition(tmp);
      desired.copy(tmp).setY(0).normalize().multiplyScalar(ORBIT_RADIUS + 3.6).setY(tmp.y + 1.6);
    } else {
      tmp.set(0, 0, 0);
      // Narrow (portrait) canvases need more distance to fit the whole orbit.
      const aspect = size.width / Math.max(1, size.height);
      desired.copy(home).multiplyScalar(aspect < 1.25 ? Math.min(2, 1.3 / aspect) : 1);
    }
    controls.current.target.lerp(tmp, 0.08);
    camera.position.lerp(desired, 0.06);
    controls.current.update();
    if (camera.position.distanceTo(desired) < 0.03 && controls.current.target.distanceTo(tmp) < 0.03) animating.current = false;
  });
  return null;
}

/**
 * Positions the DOM labels (rendered outside the canvas) over their 3D nodes
 * every frame, without React re-renders.
 */
function LabelProjector({ nodeRefs, labelRefs }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const [key, el] of Object.entries(labelRefs.current)) {
      if (!el) continue;
      if (key === '__core') v.copy(CORE_LABEL_OFFSET);
      else {
        const node = nodeRefs.current[key];
        if (!node) continue;
        node.getWorldPosition(v);
        v.y -= nodeSize(key) + 0.5;
      }
      const dist = camera.position.distanceTo(v);
      v.project(camera);
      if (v.z > 1) {
        el.style.opacity = '0';
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const scale = Math.min(1.15, Math.max(0.8, 12 / dist));
      el.style.opacity = key !== '__core' && dist > camera.position.length() + 0.6 ? '0.55' : '1';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, 0) scale(${scale.toFixed(3)})`;
      el.style.zIndex = String(Math.round((1 - v.z) * 1000));
    }
  });
  return null;
}

function Revolver({ paused, children }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!paused && ref.current) ref.current.rotation.y += dt * 0.06;
  });
  return <group ref={ref}>{children}</group>;
}

function Scene({ areas, selected, onSelect, hovered, onHover, colors, reduceMotion, compact, nodeRefs, labelRefs }) {
  const controls = useRef();
  return (
    <>
      <ambientLight intensity={colors.theme === 'light' ? 0.9 : 0.55} />
      <pointLight position={[0, 0, 0]} intensity={30} color={colors.accent} distance={14} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      {!compact && colors.theme !== 'light' && <Stars radius={60} depth={30} count={1400} factor={3} saturation={0} fade speed={reduceMotion ? 0 : 0.6} />}
      <Core colors={colors} />
      <Revolver paused={reduceMotion || Boolean(selected) || Boolean(hovered)}>
        <OrbitRings colors={colors} />
        {areas.map((area, i) => {
          const pos = nodePosition(i, areas.length);
          return (
            <group key={area.key}>
              <Line points={[[0, 0, 0], pos.toArray()]} color={colors[area.tone] || colors.neutral} lineWidth={1} transparent opacity={selected === area.key ? 0.8 : 0.18} />
              <AreaNode area={area} position={pos} colors={colors} selected={selected === area.key} hovered={hovered === area.key} onHover={onHover} onSelect={onSelect} nodeRefs={nodeRefs} />
            </group>
          );
        })}
      </Revolver>
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={5} maxDistance={30} maxPolarAngle={Math.PI * 0.85} />
      <CameraRig selected={selected} nodeRefs={nodeRefs} controls={controls} home={compact ? COMPACT_CAM : DEFAULT_CAM} />
      <LabelProjector nodeRefs={nodeRefs} labelRefs={labelRefs} />
    </>
  );
}

export default function LifeOrbit({ areas, selected, onSelect, height = 520, reduceMotion = false, compact = false, themeKey }) {
  const [hovered, setHovered] = useState(null);
  const [colors, setColors] = useState(readColors);
  const nodeRefs = useRef({});
  const labelRefs = useRef({});

  useEffect(() => {
    // Re-read CSS tokens after theme/accent changes have been applied.
    const id = requestAnimationFrame(() => setColors(readColors()));
    return () => cancelAnimationFrame(id);
  }, [themeKey]);

  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    []
  );

  const scored = areas.filter((a) => a.score != null);
  const overall = scored.length ? scored.reduce((s, a) => s + a.score, 0) / scored.length : null;

  return (
    <div className={`orbit-canvas ${compact ? 'compact' : ''}`} style={{ height }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: (compact ? COMPACT_CAM : DEFAULT_CAM).toArray(), fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => onSelect(null)}
        aria-label="Interactive 3D view of your life areas"
        role="img"
      >
        <Scene areas={areas} selected={selected} onSelect={onSelect} hovered={hovered} onHover={setHovered} colors={colors} reduceMotion={reduceMotion} compact={compact} nodeRefs={nodeRefs} labelRefs={labelRefs} />
      </Canvas>
      <div className="orbit-labels" aria-hidden>
        <div className="orbit-label core" ref={(el) => {
            labelRefs.current.__core = el;
          }}>
          <strong>You</strong>
          <span>{overall != null ? `Life score ${Math.round(overall)}` : 'Start tracking'}</span>
        </div>
        {areas.map((area) => (
          <div key={area.key} className={`orbit-label ${selected === area.key ? 'selected' : ''} ${hovered === area.key ? 'hovered' : ''}`} ref={(el) => {
              labelRefs.current[area.key] = el;
            }}>
            <strong>{area.label}</strong>
            <span>{area.score != null ? Math.round(area.score) : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
