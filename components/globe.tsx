"use client";

/**
 * 3D Globe — the visual kill-shot.
 *
 * A minimal three.js sphere with glowing points at lat/lon pairs. Designed
 * to be dropped in as a single dashboard widget; agent supplies points via
 * props. Rotates slowly on its own. Mouse drag to spin.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface GlobeProps {
  title?: string;
  points?: { lat: number; lon: number; label?: string; weight?: number }[];
  accent?: string; // hex color
}

export default function Globe({ title = "Activity", points = [], accent = "#7c3aed" }: GlobeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 3.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const sphereGeom = new THREE.SphereGeometry(1, 64, 48);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a0b,
      transparent: true,
      opacity: 0.85,
      wireframe: false,
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    scene.add(sphere);

    // Wireframe overlay
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.SphereGeometry(1.001, 32, 24)),
      new THREE.LineBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.18 }),
    );
    scene.add(wire);

    // Glowing points
    const accentColor = new THREE.Color(accent);
    const pointGroup = new THREE.Group();
    points.forEach((p) => {
      const pos = latLonToVec3(p.lat, p.lon, 1.015);
      const g = new THREE.SphereGeometry(0.018 + (p.weight ?? 0) * 0.015, 12, 12);
      const m = new THREE.MeshBasicMaterial({ color: accentColor });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(pos);
      pointGroup.add(mesh);

      // Glow halo
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ color: accentColor, transparent: true, opacity: 0.5 }),
      );
      halo.scale.setScalar(0.12 + (p.weight ?? 0) * 0.1);
      halo.position.copy(pos);
      pointGroup.add(halo);
    });
    scene.add(pointGroup);

    let raf = 0;
    let dragX = 0, dragY = 0, dragging = false, lx = 0, ly = 0;
    let rotX = 0, rotY = 0;

    const tick = () => {
      if (!dragging) rotY += 0.0025;
      sphere.rotation.set(rotX, rotY, 0);
      wire.rotation.set(rotX, rotY, 0);
      pointGroup.rotation.set(rotX, rotY, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dragX = e.clientX - lx; dragY = e.clientY - ly;
      rotY += dragX * 0.005;
      rotX += dragY * 0.005;
      lx = e.clientX; ly = e.clientY;
    };
    const onUp = () => { dragging = false; };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const ro = new ResizeObserver(() => {
      if (!el) return;
      const w2 = el.clientWidth, h2 = el.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.dispose();
      sphereGeom.dispose();
      sphereMat.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [accent, points]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="text-[11px] uppercase tracking-widest text-white/50 mb-1">{title}</div>
      <div ref={ref} className="flex-1 w-full min-h-[220px]" />
    </div>
  );
}

function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}
