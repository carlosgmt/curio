"use client";

import React, { useEffect, useRef } from "react";
import type * as THREE_NS from "three";
import type { ArchetypeSpec, PressPalette, SpineMeta } from "@/lib/press/archetypes";
import {
  createBumpCanvas,
  createFrontCoverCanvas,
  createPageBlockCanvas,
  createSpineCanvas,
} from "@/lib/press/proceduralTextures";

export interface VirtualBookshelfItem {
  saveId: string;
  spec: ArchetypeSpec;
  meta: SpineMeta;
  palette: PressPalette;
  imageUrl: string | null;
}

export interface VirtualBookshelf3DProps {
  items: VirtualBookshelfItem[];
  activeIndex: number;
  inspectMode: "front" | "spine";
  onSelectIndex: (nextIndex: number) => void;
  onToggleInspectMode?: () => void;
  onWebglUnavailable?: () => void;
  compact?: boolean;
  resetSignal?: number;
}

const VIRTUAL_WINDOW = 8;
const BAY_SPACING = 1.06;
const SPOTLIGHT_SPREAD = 0.44;
const FLOOR_Y = -0.82;

interface VolumeEntry {
  saveId: string;
  index: number;
  signature: string;
  group: THREE_NS.Group;
  hitMesh: THREE_NS.Mesh;
  coverMat: THREE_NS.MeshStandardMaterial;
  spec: ArchetypeSpec;
  meta: SpineMeta;
  palette: PressPalette;
  imageUrl: string | null;
  disposables: { dispose: () => void }[];
  imageLoaded: boolean;
}

function loadCorsImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), 6500);
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

function targetBayX(idx: number, activeIdx: number): number {
  const base = idx * BAY_SPACING;
  if (idx < activeIdx) return base - SPOTLIGHT_SPREAD;
  if (idx > activeIdx) return base + SPOTLIGHT_SPREAD;
  return base;
}

export default function VirtualBookshelf3D({
  items,
  activeIndex,
  inspectMode,
  onSelectIndex,
  onToggleInspectMode,
  onWebglUnavailable,
  compact = false,
  resetSignal = 0,
}: VirtualBookshelf3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const inspectModeRef = useRef(inspectMode);
  inspectModeRef.current = inspectMode;
  const onSelectIndexRef = useRef(onSelectIndex);
  onSelectIndexRef.current = onSelectIndex;
  const onToggleInspectModeRef = useRef(onToggleInspectMode);
  onToggleInspectModeRef.current = onToggleInspectMode;
  const onWebglUnavailableRef = useRef(onWebglUnavailable);
  onWebglUnavailableRef.current = onWebglUnavailable;

  const sceneBundleRef = useRef<{
    THREE: typeof THREE_NS;
    scene: THREE_NS.Scene;
    sharedBumpTex: THREE_NS.CanvasTexture;
    sharedPageTex: THREE_NS.CanvasTexture;
    entries: Map<string, VolumeEntry>;
  } | null>(null);

  const activeOrbitRef = useRef<{ x: number; y: number }>({ x: 0.04, y: -0.22 });
  const hoveredSaveIdRef = useRef<string | null>(null);
  const cameraXRef = useRef<number>(activeIndex * BAY_SPACING);
  const scrollPanOffsetRef = useRef<number>(0);

  // Reset local orbit when changing active item, switching inspectMode, or external reset
  useEffect(() => {
    activeOrbitRef.current = {
      x: 0.04,
      y: inspectMode === "spine" ? 1.38 : -0.22,
    };
  }, [activeIndex, inspectMode, resetSignal]);

  // Helper to build or reuse one 3D shelf volume
  const syncWindowVolumes = useRef<() => void>(() => {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: THREE_NS.WebGLRenderer | null = null;
    const sharedDisposables: { dispose: () => void }[] = [];
    const entries = new Map<string, VolumeEntry>();

    const disposeEntry = (entry: VolumeEntry) => {
      if (sceneBundleRef.current) {
        sceneBundleRef.current.scene.remove(entry.group);
      }
      for (const d of entry.disposables) {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      }
    };

    const setup = async () => {
      const THREE = await import("three");
      if (cancelled || !host) return;

      const width = Math.max(280, host.clientWidth || 720);
      const height = compact ? 290 : 350;

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
      } catch {
        onWebglUnavailableRef.current?.();
        return;
      }

      if (!renderer || !renderer.getContext()) {
        onWebglUnavailableRef.current?.();
        return;
      }

      const canvas = renderer.domElement;
      const handleContextLost = (ev: Event) => {
        ev.preventDefault();
        onWebglUnavailableRef.current?.();
      };
      canvas.addEventListener("webglcontextlost", handleContextLost, false);

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      canvas.style.touchAction = "pan-y";
      canvas.style.cursor = "grab";
      canvas.setAttribute("data-testid", "press-shelf-webgl-canvas");

      host.replaceChildren(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 60);
      camera.position.set(activeIndexRef.current * BAY_SPACING, 0.34, compact ? 5.6 : 5.25);

      const hemi = new THREE.HemisphereLight(0xfffaf2, 0x181715, 1.0);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.05);
      keyLight.position.set(4.5, 5.2, 5.4);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 22;
      keyLight.shadow.camera.left = -8;
      keyLight.shadow.camera.right = 8;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -4;
      keyLight.shadow.bias = -0.0005;
      scene.add(keyLight);
      scene.add(keyLight.target);

      const rimLight = new THREE.DirectionalLight(0xdbe8ff, 0.72);
      rimLight.position.set(-4.5, 2.6, -2.5);
      scene.add(rimLight);

      // Architectural shelf plinth + shadow receiver
      const shelfLedgeGeom = new THREE.BoxGeometry(26, 0.12, 2.4);
      const shelfLedgeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#232427"),
        roughness: 0.78,
        metalness: 0.08,
      });
      const shelfLedgeMesh = new THREE.Mesh(shelfLedgeGeom, shelfLedgeMat);
      shelfLedgeMesh.position.set(cameraXRef.current, FLOOR_Y - 0.06, 0.25);
      shelfLedgeMesh.receiveShadow = true;
      scene.add(shelfLedgeMesh);

      const frontLipGeom = new THREE.BoxGeometry(26, 0.015, 0.04);
      const frontLipMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3b3d42"),
        roughness: 0.55,
        metalness: 0.2,
      });
      const frontLipMesh = new THREE.Mesh(frontLipGeom, frontLipMat);
      frontLipMesh.position.set(cameraXRef.current, FLOOR_Y + 0.004, 1.43);
      scene.add(frontLipMesh);

      const sharedBumpTex = new THREE.CanvasTexture(createBumpCanvas("buckram"));
      sharedBumpTex.wrapS = THREE.RepeatWrapping;
      sharedBumpTex.wrapT = THREE.RepeatWrapping;
      sharedBumpTex.repeat.set(2, 2);

      const sharedSleeveBumpTex = new THREE.CanvasTexture(createBumpCanvas("matte_vinyl"));
      sharedSleeveBumpTex.wrapS = THREE.RepeatWrapping;
      sharedSleeveBumpTex.wrapT = THREE.RepeatWrapping;
      sharedSleeveBumpTex.repeat.set(2, 2);

      const sharedPageTex = new THREE.CanvasTexture(createPageBlockCanvas());
      sharedPageTex.colorSpace = THREE.SRGBColorSpace;

      sharedDisposables.push(
        shelfLedgeGeom,
        shelfLedgeMat,
        frontLipGeom,
        frontLipMat,
        sharedBumpTex,
        sharedSleeveBumpTex,
        sharedPageTex
      );

      sceneBundleRef.current = {
        THREE,
        scene,
        sharedBumpTex,
        sharedPageTex,
        entries,
      };

      const buildEntry = (item: VirtualBookshelfItem, index: number): VolumeEntry => {
        const entryDisposables: { dispose: () => void }[] = [];
        const baseH = 1.42;
        const spec = item.spec;
        const aspect = spec.widthRatio / Math.max(0.4, spec.heightRatio);
        const objH = Math.min(1.56, Math.max(1.02, baseH * (spec.heightRatio / 1.42)));
        const objW = objH * aspect;
        const objD = Math.max(0.08, Math.min(0.46, baseH * spec.depthRatio));

        const coverCanvas = createFrontCoverCanvas(spec, item.meta, item.palette, null);
        const coverTex = new THREE.CanvasTexture(coverCanvas);
        coverTex.colorSpace = THREE.SRGBColorSpace;
        coverTex.anisotropy = 4;

        const spineCanvas = createSpineCanvas(spec, item.meta, item.palette);
        const spineTex = new THREE.CanvasTexture(spineCanvas);
        spineTex.colorSpace = THREE.SRGBColorSpace;
        spineTex.anisotropy = 4;

        const isSleeve = spec.materialKind === "matte_vinyl";
        const isCase = spec.materialKind === "satin" || spec.materialKind === "matte_vinyl";
        const bumpMap = isSleeve ? sharedSleeveBumpTex : sharedBumpTex;

        const coverMat = new THREE.MeshStandardMaterial({
          map: coverTex,
          bumpMap,
          bumpScale: isCase ? 0.004 : 0.015,
          roughness: isCase ? 0.28 : 0.72,
          metalness: isCase ? 0.08 : 0.04,
          transparent: Boolean(item.meta.isWishlist),
          opacity: item.meta.isWishlist ? 0.88 : 1,
        });

        const spineMat = new THREE.MeshStandardMaterial({
          map: spineTex,
          bumpMap,
          bumpScale: isCase ? 0.004 : 0.014,
          roughness: isCase ? 0.3 : 0.74,
          metalness: 0.04,
          transparent: Boolean(item.meta.isWishlist),
          opacity: item.meta.isWishlist ? 0.88 : 1,
        });

        const backMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(item.meta.isWishlist ? item.palette.surfaceSecondary : item.palette.coverBg),
          bumpMap: sharedBumpTex,
          bumpScale: 0.012,
          roughness: 0.82,
          metalness: 0.03,
        });

        let edgeMat = backMat;
        if (spec.hasPageBlock) {
          edgeMat = new THREE.MeshStandardMaterial({
            map: sharedPageTex,
            roughness: 0.9,
            metalness: 0.0,
          });
          entryDisposables.push(edgeMat);
        }

        const slabGeom = new THREE.BoxGeometry(objW, objH, objD);
        const slabMesh = new THREE.Mesh(slabGeom, [
          edgeMat,
          spineMat,
          edgeMat,
          edgeMat,
          spec.id === "archival_box" ? backMat : coverMat,
          backMat,
        ]);
        slabMesh.castShadow = true;
        slabMesh.receiveShadow = true;
        slabMesh.userData.saveId = item.saveId;

        const group = new THREE.Group();
        group.add(slabMesh);

        if (spec.id === "archival_box") {
          const lidGeom = new THREE.BoxGeometry(objW + 0.035, objH + 0.035, Math.max(0.06, objD * 0.28));
          const lidMesh = new THREE.Mesh(lidGeom, [
            backMat,
            backMat,
            backMat,
            backMat,
            coverMat,
            backMat,
          ]);
          lidMesh.position.z = objD * 0.39;
          lidMesh.castShadow = true;
          lidMesh.userData.saveId = item.saveId;
          entryDisposables.push(lidGeom);
          group.add(lidMesh);
        }

        if (spec.hasPeekingDisc) {
          const r = objW * 0.41;
          const discGeom = new THREE.CylinderGeometry(r, r, 0.018, 36);
          const discMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#141416"),
            roughness: 0.34,
            metalness: 0.42,
          });
          const discMesh = new THREE.Mesh(discGeom, discMat);
          discMesh.rotation.x = Math.PI / 2;
          discMesh.position.set(objW * 0.28, 0, -0.005);
          discMesh.castShadow = true;
          group.add(discMesh);
          entryDisposables.push(discGeom, discMat);
        }

        entryDisposables.push(coverTex, spineTex, coverMat, spineMat, backMat, slabGeom);

        // Seat flush on shelf plinth
        const restingY = FLOOR_Y + objH / 2 + 0.008;
        const initX = targetBayX(index, activeIndexRef.current);
        const isAct = index === activeIndexRef.current;
        group.position.set(initX, restingY + (isAct ? 0.06 : 0), isAct ? 1.05 : 0);
        group.rotation.set(
          isAct ? activeOrbitRef.current.x : 0.02,
          isAct ? activeOrbitRef.current.y : 0.78,
          0
        );
        group.userData = { saveId: item.saveId, restingY };
        scene.add(group);

        const entry: VolumeEntry = {
          saveId: item.saveId,
          index,
          signature: `${item.palette.coverBg}|${item.meta.title}|${Boolean(item.meta.isWishlist)}|${item.spec.id}|${item.imageUrl || ""}`,
          group,
          hitMesh: slabMesh,
          coverMat,
          spec,
          meta: item.meta,
          palette: item.palette,
          imageUrl: item.imageUrl,
          disposables: entryDisposables,
          imageLoaded: false,
        };

        if (item.imageUrl) {
          void loadCorsImage(item.imageUrl).then((img) => {
            if (cancelled || !img || !entries.has(item.saveId)) return;
            const current = entries.get(item.saveId)!;
            const updatedCanvas = createFrontCoverCanvas(
              current.spec,
              current.meta,
              current.palette,
              img
            );
            const nextTex = new THREE.CanvasTexture(updatedCanvas);
            nextTex.colorSpace = THREE.SRGBColorSpace;
            nextTex.anisotropy = 4;
            const oldMap = current.coverMat.map;
            current.coverMat.map = nextTex;
            current.coverMat.needsUpdate = true;
            current.disposables.push(nextTex);
            if (oldMap) {
              try {
                oldMap.dispose();
              } catch {
                // ignore
              }
            }
            current.imageLoaded = true;
          });
        }

        return entry;
      };

      syncWindowVolumes.current = () => {
        const currentItems = itemsRef.current;
        const actIdx = activeIndexRef.current;
        const start = Math.max(0, actIdx - VIRTUAL_WINDOW);
        const end = Math.min(currentItems.length - 1, actIdx + VIRTUAL_WINDOW);
        const desiredIds = new Set<string>();

        for (let i = start; i <= end; i++) {
          const it = currentItems[i];
          desiredIds.add(it.saveId);
          const sig = `${it.palette.coverBg}|${it.meta.title}|${Boolean(it.meta.isWishlist)}|${it.spec.id}|${it.imageUrl || ""}`;
          const existing = entries.get(it.saveId);
          if (existing) {
            if (existing.signature !== sig) {
              disposeEntry(existing);
              entries.delete(it.saveId);
              entries.set(it.saveId, buildEntry(it, i));
            } else {
              existing.index = i;
            }
          } else {
            entries.set(it.saveId, buildEntry(it, i));
          }
        }

        for (const [id, entry] of entries.entries()) {
          if (!desiredIds.has(id)) {
            disposeEntry(entry);
            entries.delete(id);
          }
        }
      };

      syncWindowVolumes.current();

      // Interaction handlers (Raycast click/hover + focus orbit + horizontal pan/wheel)
      const raycaster = new THREE.Raycaster();
      const pointerNdc = new THREE.Vector2();
      let pointerMode: "none" | "orbit" | "pan" = "none";
      let downX = 0;
      let downY = 0;
      let lastX = 0;
      let lastY = 0;
      let movedPx = 0;
      let hitSaveIdOnDown: string | null = null;

      const pickSaveId = (clientX: number, clientY: number): string | null => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const meshes = Array.from(entries.values()).map((e) => e.hitMesh);
        const hits = raycaster.intersectObjects(meshes, false);
        const sid = hits[0]?.object?.userData?.saveId;
        return typeof sid === "string" ? sid : null;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (pointerMode === "orbit") {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          movedPx += Math.abs(dx) + Math.abs(dy);
          lastX = e.clientX;
          lastY = e.clientY;
          activeOrbitRef.current.y += dx * 0.011;
          activeOrbitRef.current.x = Math.max(
            -0.35,
            Math.min(0.45, activeOrbitRef.current.x + dy * 0.008)
          );
          return;
        }
        if (pointerMode === "pan") {
          const dx = e.clientX - lastX;
          movedPx += Math.abs(dx) + Math.abs(e.clientY - lastY);
          lastX = e.clientX;
          lastY = e.clientY;
          scrollPanOffsetRef.current -= dx * 0.014;
          return;
        }
        const hovered = pickSaveId(e.clientX, e.clientY);
        hoveredSaveIdRef.current = hovered;
        canvas.style.cursor = hovered ? "pointer" : "grab";
      };

      const onPointerDown = (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
        lastX = e.clientX;
        lastY = e.clientY;
        movedPx = 0;
        hitSaveIdOnDown = pickSaveId(e.clientX, e.clientY);
        const activeSaveId = itemsRef.current[activeIndexRef.current]?.saveId;
        if (hitSaveIdOnDown && hitSaveIdOnDown === activeSaveId) {
          pointerMode = "orbit";
          canvas.style.cursor = "grabbing";
        } else {
          pointerMode = "pan";
          canvas.style.cursor = "grabbing";
        }
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      };

      const finishPointer = (e: PointerEvent) => {
        if (pointerMode === "none") return;
        const wasMode = pointerMode;
        pointerMode = "none";
        canvas.style.cursor = hoveredSaveIdRef.current ? "pointer" : "grab";

        if (movedPx < 7) {
          const tappedId = hitSaveIdOnDown || pickSaveId(downX, downY);
          if (tappedId) {
            const tappedIdx = itemsRef.current.findIndex((it) => it.saveId === tappedId);
            if (tappedIdx >= 0) {
              if (tappedIdx === activeIndexRef.current) {
                onToggleInspectModeRef.current?.();
              } else {
                scrollPanOffsetRef.current = 0;
                onSelectIndexRef.current(tappedIdx);
              }
            }
          }
        } else if (wasMode === "pan") {
          const currentIdx = Math.max(
            0,
            Math.min(
              itemsRef.current.length - 1,
              Math.round((activeIndexRef.current * BAY_SPACING + scrollPanOffsetRef.current) / BAY_SPACING)
            )
          );
          scrollPanOffsetRef.current = 0;
          if (currentIdx !== activeIndexRef.current) {
            onSelectIndexRef.current(currentIdx);
          }
        }

        try {
          if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {
          // ignore
        }
      };

      const onPointerLeave = () => {
        hoveredSaveIdRef.current = null;
      };

      let wheelAccum = 0;
      let lastWheelTrigger = 0;
      const onWheel = (e: WheelEvent) => {
        const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
        if (!horiz) return;
        const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(delta) < 3) return;
        e.preventDefault();
        const now = performance.now();
        wheelAccum += delta;
        if (now - lastWheelTrigger < 140) return;
        if (Math.abs(wheelAccum) >= 24) {
          const step = wheelAccum > 0 ? 1 : -1;
          wheelAccum = 0;
          lastWheelTrigger = now;
          const next = Math.max(0, Math.min(itemsRef.current.length - 1, activeIndexRef.current + step));
          if (next !== activeIndexRef.current) {
            onSelectIndexRef.current(next);
          }
        }
      };

      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointerup", finishPointer);
      canvas.addEventListener("pointercancel", finishPointer);
      canvas.addEventListener("pointerleave", onPointerLeave);
      canvas.addEventListener("wheel", onWheel, { passive: false });

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver((obs) => {
          const rect = obs[0]?.contentRect;
          if (!rect || !renderer || rect.width < 40) return;
          const nextH = compact ? 290 : 350;
          renderer.setSize(rect.width, nextH, false);
          camera.aspect = rect.width / nextH;
          camera.updateProjectionMatrix();
        });
        resizeObserver.observe(host);
      }

      const animate = () => {
        if (cancelled || !renderer) return;
        rafId = window.requestAnimationFrame(animate);

        const targetCamX = activeIndexRef.current * BAY_SPACING + scrollPanOffsetRef.current;
        cameraXRef.current += (targetCamX - cameraXRef.current) * 0.14;
        camera.position.x = cameraXRef.current;
        camera.lookAt(cameraXRef.current, 0.04, 0);

        shelfLedgeMesh.position.x = cameraXRef.current;
        frontLipMesh.position.x = cameraXRef.current;
        keyLight.position.x = cameraXRef.current + 3.2;
        keyLight.target.position.set(cameraXRef.current, -0.1, 0.4);
        keyLight.target.updateMatrixWorld();

        const actIdx = activeIndexRef.current;
        for (const entry of entries.values()) {
          const isAct = entry.index === actIdx;
          const isHov = entry.saveId === hoveredSaveIdRef.current;
          const restingY = Number(entry.group.userData?.restingY ?? -0.12);

          const tx = targetBayX(entry.index, actIdx);
          const ty = restingY + (isAct ? 0.07 : isHov ? 0.05 : 0);
          const tz = isAct ? 1.04 : isHov ? 0.34 : 0;
          const trx = isAct ? activeOrbitRef.current.x : isHov ? 0.03 : 0.015;
          const tryAngle = isAct ? activeOrbitRef.current.y : isHov ? 0.42 : 0.78;

          entry.group.position.x += (tx - entry.group.position.x) * 0.16;
          entry.group.position.y += (ty - entry.group.position.y) * 0.16;
          entry.group.position.z += (tz - entry.group.position.z) * 0.16;
          entry.group.rotation.x += (trx - entry.group.rotation.x) * 0.16;
          entry.group.rotation.y += (tryAngle - entry.group.rotation.y) * 0.16;
        }

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        canvas.removeEventListener("webglcontextlost", handleContextLost);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointerup", finishPointer);
        canvas.removeEventListener("pointercancel", finishPointer);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        canvas.removeEventListener("wheel", onWheel);
      };
    };

    let cleanupListeners: (() => void) | undefined;
    void setup().then((fn) => {
      if (cancelled) {
        fn?.();
      } else {
        cleanupListeners = fn;
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      cleanupListeners?.();
      for (const entry of entries.values()) {
        disposeEntry(entry);
      }
      entries.clear();
      for (const d of sharedDisposables) {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      }
      sceneBundleRef.current = null;
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
    };
  }, [compact]);

  // Synchronize visible window without rebuilding WebGL context when items or selection changes
  useEffect(() => {
    syncWindowVolumes.current();
  }, [items, activeIndex]);

  return (
    <div
      ref={hostRef}
      data-testid="virtual-bookshelf-3d"
      className="relative w-full select-none"
      style={{ height: compact ? 290 : 350 }}
    />
  );
}
