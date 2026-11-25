"use client";

import React, { useEffect, useRef } from "react";
import type * as THREE_NS from "three";
import type { PressPalette } from "@/lib/press/archetypes";

export interface VirtualPosterItem {
  saveId: string;
  title: string;
  director: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  rating?: number | null;
  watchStatus?: string;
  rewatch?: boolean;
  isOwned?: boolean;
  posterUrl: string | null;
  palette: PressPalette;
}

export interface VirtualPosterWall3DProps {
  items: VirtualPosterItem[];
  activeIndex: number;
  wallMode?: "gallery" | "marquee";
  inspectBack?: boolean;
  onSelectIndex: (nextIndex: number) => void;
  onActivateActiveItem?: (activeIndex: number) => void;
  onWebglUnavailable?: () => void;
  compact?: boolean;
  resetSignal?: number;
}

const VIRTUAL_WINDOW = 12;
const FLOOR_Y = -0.88;

interface PosterEntry {
  saveId: string;
  index: number;
  signature: string;
  group: THREE_NS.Group;
  hitMesh: THREE_NS.Mesh;
  frontMat: THREE_NS.MeshStandardMaterial;
  item: VirtualPosterItem;
  disposables: { dispose: () => void }[];
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

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const iw = img.naturalWidth || dw;
  const ih = img.naturalHeight || dh;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let lineCount = 0;
  let curY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lineCount++;
      if (lineCount >= maxLines) {
        ctx.fillText(line.slice(0, Math.max(3, line.length - 1)) + "…", x, curY);
        return curY + lineHeight;
      }
      ctx.fillText(line, x, curY);
      curY += lineHeight;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, curY);
    curY += lineHeight;
  }
  return curY;
}

function createPosterFrontCanvas(
  item: VirtualPosterItem,
  posterImg: HTMLImageElement | null
): HTMLCanvasElement {
  const w = 640;
  const h = 960;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = item.palette.surfaceSecondary;
  ctx.fillRect(0, 0, w, h);

  const frameInset = 10;
  const innerW = w - frameInset * 2;
  const innerH = h - frameInset * 2;

  if (posterImg && posterImg.naturalWidth > 0 && posterImg.naturalHeight > 0) {
    drawImageCover(ctx, posterImg, frameInset, frameInset, innerW, innerH);
    const vig = ctx.createLinearGradient(0, h - 180, 0, h - frameInset);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.46)");
    ctx.fillStyle = vig;
    ctx.fillRect(frameInset, h - 180, innerW, 180 - frameInset);
  } else {
    // Minimalist Criterion-inspired typographic poster when no artwork is stored yet
    ctx.fillStyle = item.palette.coverBg;
    ctx.fillRect(frameInset, frameInset, innerW, innerH);

    ctx.strokeStyle = item.palette.accent;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 3;
    ctx.strokeRect(52, 52, w - 104, h - 104);
    ctx.globalAlpha = 1;

    ctx.fillStyle = item.palette.accent;
    ctx.font = '600 18px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(
      item.year ? `FILM · ${item.year}` : "CURIO CINEMA",
      76,
      104
    );

    ctx.fillStyle = item.palette.coverInk;
    ctx.font = '500 52px "Newsreader", Georgia, serif';
    drawWrappedText(ctx, item.title, 76, 220, w - 152, 64, 5);

    ctx.fillStyle = item.palette.accent;
    ctx.fillRect(76, h - 148, 84, 3);

    ctx.fillStyle = item.palette.coverInk;
    ctx.font = '500 22px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(item.director.toUpperCase().slice(0, 32), 76, h - 98);
  }

  // Crisp subtle theatrical frame hairline
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 3;
  ctx.strokeRect(frameInset, frameInset, innerW, innerH);

  return canvas;
}

function createPosterBackCanvas(item: VirtualPosterItem): HTMLCanvasElement {
  const w = 640;
  const h = 960;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = item.palette.surface;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = item.palette.rule;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, w - 72, h - 72);

  ctx.fillStyle = item.palette.accent;
  ctx.font = '600 18px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillText("CURIO CINEMA · PROGRAM CREDITS", 68, 96);

  ctx.fillStyle = item.palette.ink;
  ctx.font = '500 46px "Newsreader", Georgia, serif';
  const nextY = drawWrappedText(ctx, item.title, 68, 178, w - 136, 56, 4);

  ctx.fillStyle = item.palette.muted;
  ctx.font = 'italic 28px "Newsreader", Georgia, serif';
  drawWrappedText(ctx, `Directed by ${item.director}`, 68, nextY + 24, w - 136, 38, 2);

  const metaRows = [
    item.year ? `RELEASE YEAR     ${item.year}` : null,
    item.runtimeMinutes ? `RUNTIME          ${item.runtimeMinutes} MIN` : null,
    item.rating ? `RATING           ${item.rating} ★` : null,
    item.watchStatus ? `STATUS           ${item.watchStatus}` : null,
    item.rewatch ? "SCREENING        REWATCH" : null,
    item.isOwned ? "EDITION          OWNED DISC / DIGITAL" : null,
  ].filter(Boolean) as string[];

  ctx.font = '500 18px "IBM Plex Mono", ui-monospace, monospace';
  let rowY = h - 88 - metaRows.length * 36;
  ctx.fillStyle = item.palette.rule;
  ctx.fillRect(68, rowY - 24, w - 136, 2);
  ctx.fillStyle = item.palette.ink;
  for (const row of metaRows) {
    ctx.fillText(row, 68, rowY);
    rowY += 36;
  }

  return canvas;
}

function computePosterPositions(
  count: number,
  activeIdx: number,
  wallMode: "gallery" | "marquee"
): number[] {
  if (count === 0) return [];
  const positions = new Array<number>(count).fill(0);
  const clampedActive = Math.max(0, Math.min(count - 1, activeIdx));
  const step = wallMode === "marquee" ? 1.24 : 0.94;
  const activeClearance = wallMode === "marquee" ? 1.38 : 1.32;

  for (let i = clampedActive - 1; i >= 0; i--) {
    positions[i] =
      i === clampedActive - 1
        ? positions[clampedActive] - activeClearance
        : positions[i + 1] - step;
  }
  for (let i = clampedActive + 1; i < count; i++) {
    positions[i] =
      i === clampedActive + 1
        ? positions[clampedActive] + activeClearance
        : positions[i - 1] + step;
  }

  const shift = -positions[0];
  for (let i = 0; i < count; i++) positions[i] += shift;
  return positions;
}

export default function VirtualPosterWall3D({
  items,
  activeIndex,
  wallMode = "gallery",
  inspectBack = false,
  onSelectIndex,
  onActivateActiveItem,
  onWebglUnavailable,
  compact = false,
  resetSignal = 0,
}: VirtualPosterWall3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef(items);
  const activeIndexRef = useRef(activeIndex);
  const wallModeRef = useRef(wallMode);
  const inspectBackRef = useRef(inspectBack);
  const onSelectIndexRef = useRef(onSelectIndex);
  const onActivateActiveItemRef = useRef(onActivateActiveItem);
  const onWebglUnavailableRef = useRef(onWebglUnavailable);

  const bayPositionsRef = useRef<number[]>(
    computePosterPositions(items.length, activeIndex, wallMode)
  );

  const sceneBundleRef = useRef<{
    THREE: typeof THREE_NS;
    scene: THREE_NS.Scene;
    entries: Map<string, PosterEntry>;
  } | null>(null);

  const activeOrbitRef = useRef<{ x: number; y: number }>({ x: 0.02, y: -0.1 });
  const hoveredSaveIdRef = useRef<string | null>(null);
  const cameraXRef = useRef<number>(0);
  const scrollPanOffsetRef = useRef<number>(0);

  useEffect(() => {
    itemsRef.current = items;
    activeIndexRef.current = activeIndex;
    wallModeRef.current = wallMode;
    inspectBackRef.current = inspectBack;
    onSelectIndexRef.current = onSelectIndex;
    onActivateActiveItemRef.current = onActivateActiveItem;
    onWebglUnavailableRef.current = onWebglUnavailable;
    bayPositionsRef.current = computePosterPositions(items.length, activeIndex, wallMode);
  }, [
    items,
    activeIndex,
    wallMode,
    inspectBack,
    onSelectIndex,
    onActivateActiveItem,
    onWebglUnavailable,
  ]);

  useEffect(() => {
    activeOrbitRef.current = {
      x: 0.02,
      y: inspectBack ? Math.PI - 0.08 : -0.1,
    };
  }, [activeIndex, inspectBack, resetSignal]);

  const syncWallRef = useRef<() => void>(() => {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: THREE_NS.WebGLRenderer | null = null;
    const sharedDisposables: { dispose: () => void }[] = [];
    const entries = new Map<string, PosterEntry>();

    const disposeEntry = (entry: PosterEntry) => {
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
      const height = compact ? 310 : 390;

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
      renderer.toneMappingExposure = 1.08;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      canvas.style.touchAction = "pan-y";
      canvas.style.cursor = "grab";
      canvas.setAttribute("data-testid", "poster-wall-webgl-canvas");

      host.replaceChildren(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 60);
      const initCamX = bayPositionsRef.current[activeIndexRef.current] ?? 0;
      cameraXRef.current = initCamX;
      camera.position.set(initCamX, 0.18, compact ? 5.3 : 5.05);

      const hemi = new THREE.HemisphereLight(0xfff6ea, 0x121318, 1.08);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.05);
      keyLight.position.set(initCamX + 3.2, 4.8, 5.4);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 22;
      keyLight.shadow.camera.left = -9;
      keyLight.shadow.camera.right = 9;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -4;
      keyLight.shadow.bias = -0.0005;
      scene.add(keyLight);
      scene.add(keyLight.target);

      const rimLight = new THREE.DirectionalLight(0xcddcff, 0.72);
      rimLight.position.set(-4.2, 2.2, -3.0);
      scene.add(rimLight);

      const spotHalo = new THREE.SpotLight(0xffe6ba, 1.45, 9, Math.PI / 5, 0.55);
      spotHalo.position.set(initCamX, 2.5, 2.4);
      scene.add(spotHalo);
      scene.add(spotHalo.target);

      // Theater floor plinth + brushed gallery rail
      const floorGeom = new THREE.BoxGeometry(40, 0.12, 2.6);
      const floorMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#16171a"),
        roughness: 0.72,
        metalness: 0.14,
      });
      const floorMesh = new THREE.Mesh(floorGeom, floorMat);
      floorMesh.position.set(cameraXRef.current, FLOOR_Y - 0.06, 0.2);
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      const railGeom = new THREE.BoxGeometry(40, 0.02, 0.05);
      const railMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3b3e45"),
        roughness: 0.42,
        metalness: 0.35,
      });
      const railMesh = new THREE.Mesh(railGeom, railMat);
      railMesh.position.set(cameraXRef.current, FLOOR_Y + 0.008, 1.44);
      scene.add(railMesh);

      sharedDisposables.push(floorGeom, floorMat, railGeom, railMat);
      sceneBundleRef.current = { THREE, scene, entries };

      const posterH = compact ? 1.48 : 1.72;
      const posterW = posterH * (2 / 3);
      const posterD = 0.02;

      const buildSignature = (it: VirtualPosterItem) =>
        `${it.title}|${it.director}|${it.year || ""}|${it.posterUrl || ""}|${it.palette.coverBg}|${it.rating || ""}|${it.watchStatus || ""}`;

      const buildEntry = (item: VirtualPosterItem, index: number): PosterEntry => {
        const entryDisposables: { dispose: () => void }[] = [];

        const frontCanvas = createPosterFrontCanvas(item, null);
        const frontTex = new THREE.CanvasTexture(frontCanvas);
        frontTex.colorSpace = THREE.SRGBColorSpace;
        frontTex.anisotropy = 4;

        const backCanvas = createPosterBackCanvas(item);
        const backTex = new THREE.CanvasTexture(backCanvas);
        backTex.colorSpace = THREE.SRGBColorSpace;
        backTex.anisotropy = 4;

        const frontMat = new THREE.MeshStandardMaterial({
          map: frontTex,
          roughness: 0.24,
          metalness: 0.06,
        });
        const backMat = new THREE.MeshStandardMaterial({
          map: backTex,
          roughness: 0.65,
          metalness: 0.04,
        });
        const frameMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#18191d"),
          roughness: 0.38,
          metalness: 0.32,
        });

        const geom = new THREE.BoxGeometry(posterW, posterH, posterD);
        const mesh = new THREE.Mesh(geom, [
          frameMat,
          frameMat,
          frameMat,
          frameMat,
          frontMat,
          backMat,
        ]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.saveId = item.saveId;

        const group = new THREE.Group();
        group.add(mesh);

        const restingY = FLOOR_Y + posterH / 2 + 0.08;
        const initX = bayPositionsRef.current[index] ?? index * 1.1;
        const isAct = index === activeIndexRef.current;
        const restAngle =
          wallModeRef.current === "marquee"
            ? 0.02
            : index < activeIndexRef.current
            ? 0.34
            : -0.34;
        group.position.set(initX, restingY + (isAct ? 0.06 : 0), isAct ? 1.04 : 0);
        group.rotation.set(
          isAct ? activeOrbitRef.current.x : 0.01,
          isAct ? activeOrbitRef.current.y : restAngle,
          0
        );
        group.userData = { saveId: item.saveId, restingY };
        scene.add(group);

        entryDisposables.push(
          frontTex,
          backTex,
          frontMat,
          backMat,
          frameMat,
          geom
        );

        const entry: PosterEntry = {
          saveId: item.saveId,
          index,
          signature: buildSignature(item),
          group,
          hitMesh: mesh,
          frontMat,
          item,
          disposables: entryDisposables,
        };

        if (item.posterUrl) {
          void loadCorsImage(item.posterUrl).then((img) => {
            if (cancelled || !img || !entries.has(item.saveId)) return;
            const current = entries.get(item.saveId)!;
            const nextCanvas = createPosterFrontCanvas(current.item, img);
            const nextTex = new THREE.CanvasTexture(nextCanvas);
            nextTex.colorSpace = THREE.SRGBColorSpace;
            nextTex.anisotropy = 4;
            const oldMap = current.frontMat.map;
            current.frontMat.map = nextTex;
            current.frontMat.needsUpdate = true;
            current.disposables.push(nextTex);
            if (oldMap) {
              try {
                oldMap.dispose();
              } catch {
                // ignore
              }
            }
          });
        }

        return entry;
      };

      syncWallRef.current = () => {
        const currentItems = itemsRef.current;
        const actIdx = activeIndexRef.current;
        const start = Math.max(0, actIdx - VIRTUAL_WINDOW);
        const end = Math.min(currentItems.length - 1, actIdx + VIRTUAL_WINDOW);
        const desiredIds = new Set<string>();

        for (let i = start; i <= end; i++) {
          const it = currentItems[i];
          desiredIds.add(it.saveId);
          const sig = buildSignature(it);
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

      syncWallRef.current();

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
            -0.32,
            Math.min(0.32, activeOrbitRef.current.x + dy * 0.008)
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
        pointerMode = hitSaveIdOnDown && hitSaveIdOnDown === activeSaveId ? "orbit" : "pan";
        canvas.style.cursor = "grabbing";
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
                onActivateActiveItemRef.current?.(tappedIdx);
              } else {
                scrollPanOffsetRef.current = 0;
                onSelectIndexRef.current(tappedIdx);
              }
            }
          }
        } else if (wasMode === "pan") {
          const positions = bayPositionsRef.current;
          const activeX = positions[activeIndexRef.current] ?? 0;
          const targetWorldX = activeX + scrollPanOffsetRef.current;
          let closestIdx = activeIndexRef.current;
          let bestDist = Infinity;
          for (let i = 0; i < positions.length; i++) {
            const d = Math.abs(positions[i] - targetWorldX);
            if (d < bestDist) {
              bestDist = d;
              closestIdx = i;
            }
          }
          scrollPanOffsetRef.current = 0;
          if (closestIdx !== activeIndexRef.current) {
            onSelectIndexRef.current(closestIdx);
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
          const next = Math.max(
            0,
            Math.min(itemsRef.current.length - 1, activeIndexRef.current + step)
          );
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
          const nextH = compact ? 310 : 390;
          renderer.setSize(rect.width, nextH, false);
          camera.aspect = rect.width / nextH;
          camera.updateProjectionMatrix();
        });
        resizeObserver.observe(host);
      }

      const animate = () => {
        if (cancelled || !renderer) return;
        rafId = window.requestAnimationFrame(animate);

        const positions = bayPositionsRef.current;
        const targetCamX =
          (positions[activeIndexRef.current] ?? 0) + scrollPanOffsetRef.current;
        cameraXRef.current += (targetCamX - cameraXRef.current) * 0.14;
        camera.position.x = cameraXRef.current;
        camera.lookAt(cameraXRef.current, 0.04, 0);

        floorMesh.position.x = cameraXRef.current;
        railMesh.position.x = cameraXRef.current;
        keyLight.position.x = cameraXRef.current + 3.0;
        keyLight.target.position.set(cameraXRef.current, -0.05, 0.4);
        keyLight.target.updateMatrixWorld();
        spotHalo.position.x = cameraXRef.current;
        spotHalo.target.position.set(cameraXRef.current, 0, 0.4);
        spotHalo.target.updateMatrixWorld();

        const actIdx = activeIndexRef.current;
        const mode = wallModeRef.current;

        for (const entry of entries.values()) {
          const isAct = entry.index === actIdx;
          const isHov = entry.saveId === hoveredSaveIdRef.current;
          const restingY = Number(entry.group.userData?.restingY ?? 0);
          const restAngle =
            mode === "marquee"
              ? 0.02
              : entry.index < actIdx
              ? 0.36
              : -0.36;

          const tx = positions[entry.index] ?? entry.index * 1.1;
          const ty = restingY + (isAct ? 0.06 : isHov ? 0.04 : 0);
          const tz = isAct ? 1.04 : isHov ? 0.36 : 0;
          const trx = isAct ? activeOrbitRef.current.x : isHov ? 0.02 : 0.01;
          const tryAngle = isAct
            ? activeOrbitRef.current.y
            : isHov
            ? restAngle * 0.45
            : restAngle;

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
      if (cancelled) fn?.();
      else cleanupListeners = fn;
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      cleanupListeners?.();
      for (const entry of entries.values()) disposeEntry(entry);
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

  useEffect(() => {
    syncWallRef.current();
  }, [items, activeIndex, wallMode]);

  return (
    <div
      ref={hostRef}
      data-testid="virtual-poster-wall-3d"
      className="relative w-full select-none"
      style={{ height: compact ? 310 : 390 }}
    />
  );
}
