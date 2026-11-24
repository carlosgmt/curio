"use client";

import React, { useEffect, useRef, useState } from "react";
import { RotateCcw, RefreshCw } from "lucide-react";
import type { ArchetypeSpec, PressPalette, SpineMeta } from "@/lib/press/archetypes";
import {
  createBumpCanvas,
  createFrontCoverCanvas,
  createPageBlockCanvas,
  createSpineCanvas,
} from "@/lib/press/proceduralTextures";

export interface Hero3DInspectorProps {
  spec: ArchetypeSpec;
  meta: SpineMeta;
  palette: PressPalette;
  imageUrl: string | null;
}

function loadCorsImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

export default function Hero3DInspector({
  spec,
  meta,
  palette,
  imageUrl,
}: Hero3DInspectorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const targetRotRef = useRef<{ x: number; y: number }>({ x: 0.08, y: -0.36 });
  const isDraggingRef = useRef<boolean>(false);
  const lastPtrRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewingSpine, setViewingSpine] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const handleResetView = () => {
    targetRotRef.current = { x: 0.08, y: -0.36 };
    setViewingSpine(false);
  };

  const handleToggleSpine = () => {
    setViewingSpine((prev) => {
      const next = !prev;
      targetRotRef.current = next ? { x: 0.04, y: 1.38 } : { x: 0.08, y: -0.36 };
      return next;
    });
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    const disposables: { dispose: () => void }[] = [];

    const setup = async () => {
      const [THREE, loadedImage] = await Promise.all([
        import("three"),
        loadCorsImage(imageUrl),
      ]);
      if (cancelled || !host) return;

      const width = Math.max(240, host.clientWidth || 380);
      const height = Math.max(260, host.clientHeight || 420);

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
      } catch {
        setWebglUnavailable(true);
        return;
      }

      if (!renderer || !renderer.getContext()) {
        setWebglUnavailable(true);
        return;
      }

      setWebglUnavailable(false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";

      host.replaceChildren(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
      camera.position.set(0, 0.25, 5.4);

      const hemi = new THREE.HemisphereLight(0xfffaf2, 0x1a1816, 0.95);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.05);
      keyLight.position.set(3.2, 4.4, 4.6);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 16;
      keyLight.shadow.camera.left = -2.5;
      keyLight.shadow.camera.right = 2.5;
      keyLight.shadow.camera.top = 2.5;
      keyLight.shadow.camera.bottom = -2.5;
      keyLight.shadow.radius = 4;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xdbe8ff, 0.72);
      rimLight.position.set(-3.4, 1.8, -3.2);
      scene.add(rimLight);

      // Build procedural CanvasTextures
      const frontCanvas = createFrontCoverCanvas(spec, meta, palette, loadedImage);
      const spineCanvas = createSpineCanvas(spec, meta, palette);
      const bumpCanvas = createBumpCanvas(spec.materialKind);

      const frontTex = new THREE.CanvasTexture(frontCanvas);
      frontTex.colorSpace = THREE.SRGBColorSpace;
      frontTex.anisotropy = 4;

      const spineTex = new THREE.CanvasTexture(spineCanvas);
      spineTex.colorSpace = THREE.SRGBColorSpace;
      spineTex.anisotropy = 4;

      const bumpTex = new THREE.CanvasTexture(bumpCanvas);
      bumpTex.wrapS = THREE.RepeatWrapping;
      bumpTex.wrapT = THREE.RepeatWrapping;
      bumpTex.repeat.set(3, 3);

      disposables.push(frontTex, spineTex, bumpTex);

      const roughness =
        spec.materialKind === "satin"
          ? 0.38
          : spec.materialKind === "matte_vinyl"
          ? 0.58
          : 0.78;

      const frontMat = new THREE.MeshStandardMaterial({
        map: frontTex,
        bumpMap: bumpTex,
        bumpScale: spec.materialKind === "buckram" ? 0.014 : 0.008,
        roughness,
        metalness: 0.05,
      });

      const spineMat = new THREE.MeshStandardMaterial({
        map: spineTex,
        bumpMap: bumpTex,
        bumpScale: 0.012,
        roughness,
        metalness: 0.06,
      });

      const clothBackMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.coverBg),
        bumpMap: bumpTex,
        bumpScale: 0.012,
        roughness: 0.8,
        metalness: 0.04,
      });

      disposables.push(frontMat, spineMat, clothBackMat);

      let edgeMat = clothBackMat;
      if (spec.hasPageBlock) {
        const pageTex = new THREE.CanvasTexture(createPageBlockCanvas());
        pageTex.colorSpace = THREE.SRGBColorSpace;
        disposables.push(pageTex);
        edgeMat = new THREE.MeshStandardMaterial({
          map: pageTex,
          roughness: 0.9,
          metalness: 0.0,
        });
        disposables.push(edgeMat);
      }

      const baseW = 1.65;
      const objW = baseW * spec.widthRatio;
      const objH = baseW * spec.heightRatio;
      const objD = Math.max(0.08, baseW * spec.depthRatio);

      const pivot = new THREE.Group();
      scene.add(pivot);

      const slabGeom = new THREE.BoxGeometry(objW, objH, objD);
      disposables.push(slabGeom);

      // Face order in BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
      const slabMesh = new THREE.Mesh(slabGeom, [
        edgeMat,
        spineMat,
        edgeMat,
        edgeMat,
        spec.id === "archival_box" ? clothBackMat : frontMat,
        clothBackMat,
      ]);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      pivot.add(slabMesh);

      if (spec.id === "archival_box") {
        const lidGeom = new THREE.BoxGeometry(
          objW + 0.04,
          objH + 0.04,
          Math.max(0.08, objD * 0.28)
        );
        const lidMesh = new THREE.Mesh(lidGeom, [
          clothBackMat,
          clothBackMat,
          clothBackMat,
          clothBackMat,
          frontMat,
          clothBackMat,
        ]);
        lidMesh.position.z = objD * 0.39;
        lidMesh.castShadow = true;
        disposables.push(lidGeom);
        pivot.add(lidMesh);
      }

      if (spec.hasPeekingDisc) {
        const discRadius = objW * 0.44;
        const discGeom = new THREE.CylinderGeometry(
          discRadius,
          discRadius,
          0.022,
          48
        );
        const discMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#141416"),
          roughness: 0.32,
          metalness: 0.45,
        });
        const discMesh = new THREE.Mesh(discGeom, discMat);
        discMesh.rotation.x = Math.PI / 2;
        discMesh.position.set(objW * 0.3, 0, -0.005);
        discMesh.castShadow = true;
        pivot.add(discMesh);

        const labelGeom = new THREE.CylinderGeometry(
          discRadius * 0.34,
          discRadius * 0.34,
          0.025,
          36
        );
        const labelMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(palette.accent),
          roughness: 0.65,
        });
        const labelMesh = new THREE.Mesh(labelGeom, labelMat);
        labelMesh.rotation.x = Math.PI / 2;
        labelMesh.position.set(objW * 0.3, 0, -0.005);
        pivot.add(labelMesh);

        disposables.push(discGeom, discMat, labelGeom, labelMat);
      }

      const groundGeom = new THREE.PlaneGeometry(8, 8);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.32 });
      const groundMesh = new THREE.Mesh(groundGeom, groundMat);
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.y = -objH / 2 - 0.16;
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);
      disposables.push(groundGeom, groundMat);

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      pivot.rotation.set(targetRotRef.current.x, targetRotRef.current.y, 0);

      let elapsed = 0;
      let lastTs = performance.now();

      const renderFrame = (now: number) => {
        if (cancelled || !renderer) return;
        const dt = Math.min(0.05, (now - lastTs) / 1000);
        lastTs = now;
        elapsed += dt;

        if (reducedMotion) {
          pivot.rotation.x = targetRotRef.current.x;
          pivot.rotation.y = targetRotRef.current.y;
          pivot.position.y = 0;
        } else {
          pivot.rotation.x += (targetRotRef.current.x - pivot.rotation.x) * 0.14;
          pivot.rotation.y += (targetRotRef.current.y - pivot.rotation.y) * 0.14;
          pivot.position.y = isDraggingRef.current
            ? pivot.position.y * 0.9
            : Math.sin(elapsed * 1.15) * 0.032;
        }

        renderer.render(scene, camera);
        rafId = window.requestAnimationFrame(renderFrame);
      };

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !renderer) return;
        const w = Math.max(200, Math.round(entry.contentRect.width));
        const h = Math.max(220, Math.round(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      });
      resizeObserver.observe(host);

      rafId = window.requestAnimationFrame(renderFrame);
    };

    void setup();

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      for (const item of disposables) {
        try {
          item.dispose();
        } catch {
          // Ignore disposal errors on context loss
        }
      }
      if (renderer) {
        try {
          renderer.dispose();
          renderer.domElement.remove();
        } catch {
          // Ignore teardown errors
        }
      }
    };
  }, [spec, meta, palette, imageUrl]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    lastPtrRef.current = { x: e.clientX, y: e.clientY };
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer already captured
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPtrRef.current.x;
    const dy = e.clientY - lastPtrRef.current.y;
    lastPtrRef.current = { x: e.clientX, y: e.clientY };
    targetRotRef.current = {
      x: Math.max(-0.55, Math.min(0.55, targetRotRef.current.x + dy * 0.008)),
      y: targetRotRef.current.y + dx * 0.01,
    };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  if (webglUnavailable) {
    return (
      <div
        className="relative flex h-full min-h-[300px] w-full flex-col items-center justify-center p-6"
        style={{
          backgroundColor: palette.surfaceSecondary,
          color: palette.coverInk,
        }}
      >
        <div
          className="relative w-52 sm:w-60 rounded-r-md overflow-hidden shadow-2xl border p-5 flex flex-col justify-between"
          style={{
            aspectRatio: `1 / ${spec.heightRatio}`,
            backgroundColor: palette.coverBg,
            borderColor: palette.rule,
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={meta.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: palette.accent }}
              >
                {spec.label}
              </span>
              <h3 className="font-serif-editorial text-2xl leading-tight">
                {meta.title}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
                {meta.creator}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-[300px] sm:min-h-[420px] w-full flex-col select-none"
      style={{ backgroundColor: palette.surfaceSecondary }}
    >
      <div
        ref={hostRef}
        data-testid="press-hero-3d-canvas-host"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative flex-1 w-full cursor-grab active:cursor-grabbing"
        aria-label={`Interactive 3D view of ${meta.title}`}
      />

      {/* Minimal corner controls */}
      <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center justify-between gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-75"
          style={{ color: palette.muted }}
        >
          Drag to orbit · {spec.label}
        </span>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleSpine}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider cursor-pointer transition-opacity hover:opacity-85"
            style={{
              borderColor: palette.rule,
              backgroundColor: `${palette.surface}E6`,
              color: palette.ink,
            }}
          >
            <RefreshCw className="h-3 w-3" />
            {viewingSpine ? "Cover" : "Spine"}
          </button>
          <button
            type="button"
            aria-label="Reset 3D camera"
            onClick={handleResetView}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider cursor-pointer transition-opacity hover:opacity-85"
            style={{
              borderColor: palette.rule,
              backgroundColor: `${palette.surface}E6`,
              color: palette.ink,
            }}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
