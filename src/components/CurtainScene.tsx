import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, MeshDistortMaterial, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Fabric } from './FabricPicker';

type ClothProps = {
  fabric: Fabric;
};

const Cloth: React.FC<ClothProps> = ({ fabric }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const map = useTexture(fabric.textureUrl);

  const color = useMemo(() => new THREE.Color(fabric.tint), [fabric.tint]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const mesh = meshRef.current;
    if (mesh) {
      mesh.rotation.y = Math.sin(t * 0.15) * 0.05;
      mesh.position.x = Math.sin(t * 0.2) * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[0, -0.2, 0]} position={[0, -0.25, 0]}>
      <planeGeometry args={[1.8, 2.4, 64, 64]} />
      <MeshDistortMaterial
        map={map}
        transparent
        opacity={fabric.translucency}
        distort={0.12}
        speed={1.2}
        color={color}
        roughness={0.38}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

type SceneProps = {
  fabric: Fabric;
};

const Scene: React.FC<SceneProps> = ({ fabric }) => {
  return (
    <Canvas camera={{ position: [0, 0.9, 3.4], fov: 36 }} dpr={[1, 1.8]}>
      <color attach="background" args={[0.95, 0.97, 1]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 2.5, 2]} intensity={1.4} castShadow />
      <directionalLight position={[-2, 1.5, -1]} intensity={0.45} />
      <Suspense fallback={null}>
        <Cloth fabric={fabric} />
        <Environment preset="city" />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 2} />
    </Canvas>
  );
};

export type CurtainSceneProps = {
  fabric: Fabric;
};

const CurtainScene: React.FC<CurtainSceneProps> = ({ fabric }) => {
  return (
    <div className="canvas-frame">
      <Scene fabric={fabric} />
    </div>
  );
};

export default CurtainScene;
