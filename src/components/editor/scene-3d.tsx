// @ts-nocheck -- third-party types are incomplete
"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef } from "react";

const Canvas = dynamic(() => import("@react-three/fiber").then((m) => m.Canvas), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export interface Scene3DProps {
  className?: string;
  children?: React.ReactNode;
  cameraPosition?: [number, number, number];
}

export function Scene3D({ className, children, cameraPosition = [0, 0, 5] }: Scene3DProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        shadows
        camera={{ position: cameraPosition, fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0d1117"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        <gridHelper args={[20, 20, "#666", "#333"]} />
        {children}
      </Canvas>
    </div>
  );
}

export function Cube({ position = [0, 0, 0], color = "orange" }: { position?: [number, number, number]; color?: string }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function Sphere({ position = [0, 0, 0], color = "hotpink" }: { position?: [number, number, number]; color?: string }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[0.7, 32, 32]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
