// Aircraft-agnostic 3D viewer: scene, camera, picking, highlighting,
// camera flights, isolate mode and hotspot markers.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export class Viewer {
  constructor(container, { onHover = () => {}, onSelect = () => {}, onInteract = () => {} } = {}) {
    this.container = container;
    this.onHover = onHover;
    this.onSelect = onSelect;
    this.onInteract = onInteract;
    this.tickers = [];
    this.partMeshes = new Map();
    this.pickables = [];
    this.hoverId = null;
    this.selectedId = null;
    this.highlightSet = new Set();
    this.isolate = false;
    this.showHotspots = true;
    this.colors = { accent: new THREE.Color('#e4572e'), hover: new THREE.Color('#127fbf') };

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0x000000, 0);
    container.appendChild(r.domElement);
    r.domElement.classList.add('viewer-canvas');

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.fog = new THREE.Fog(0xe9ebe4, 90, 260);
    this.scene.fog = this.fog;
    this.envGround = true;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 800);
    this.camera.position.set(70, 32, -80);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 140;
    this.controls.target.set(0, 2.6, 0);
    this.controls.zoomToCursor = true;

    // lights
    const hemi = (this.hemi = new THREE.HemisphereLight(0xffffff, 0x6d737b, 0.55));
    this.scene.add(hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xfff8ee, 2.6));
    sun.position.set(30, 50, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);

    // ground
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(220, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(240, 120, 0x9aa3ab, 0xc9ced2);
    this.grid.position.y = 0.002;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.55;
    this.scene.add(this.grid);

    // picking
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerPx = { x: 0, y: 0 };
    this.downAt = null;
    const el = r.domElement;
    el.addEventListener('pointermove', (e) => this._pointerMove(e));
    el.addEventListener('pointerdown', (e) => { this.downAt = { x: e.clientX, y: e.clientY }; this._cancelFlight(); });
    el.addEventListener('pointerup', (e) => this._pointerUp(e));
    el.addEventListener('pointerleave', () => this._setHover(null));
    el.addEventListener('wheel', () => this._cancelFlight(), { passive: true });
    // Scroll over a control that accepts the wheel (e.g. an MCP knob) turns it instead of zooming.
    container.addEventListener('wheel', (e) => {
      if (e.target !== el) return;
      const hit = this._hit(e.clientX, e.clientY);
      const wheel = hit?.object.userData.wheel;
      if (!wheel) return;
      const r = wheel({ uv: hit.uv, dir: e.deltaY < 0 ? 1 : -1 });
      if (r?.handled) { e.preventDefault(); e.stopPropagation(); }
    }, { capture: true, passive: false });

    // overlay layers
    this.markerLayer = document.createElement('div');
    this.markerLayer.className = 'marker-layer';
    container.appendChild(this.markerLayer);
    this.routeLayer = document.createElement('div');
    this.routeLayer.className = 'route-layer';
    container.appendChild(this.routeLayer);
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    container.appendChild(this.tooltip);

    new ResizeObserver(() => this._resize()).observe(container);
    this._resize();
    this.clock = new THREE.Clock();
    this._lastOcclusion = 0;
    r.setAnimationLoop(() => this._frame());
  }

  // ------------------------------------------------------------------ setup
  load(root, partsMeta, cameraCfg) {
    if (this.root) this.scene.remove(this.root);
    this.root = root;
    this.partsMeta = new Map(partsMeta.map((p) => [p.id, p]));
    this.cameraCfg = cameraCfg;
    this.scene.add(root);
    this.partMeshes.clear();
    this.pickables = [];
    this.hoverId = null;
    this.selectedId = null;
    this.highlightSet = new Set();
    this._applyCameraConfig(cameraCfg || {});
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o.isMesh && o.userData.partId)) return;
      if (!o.userData._ownMaterial) {
        o.material = o.material.clone();
        o.userData._ownMaterial = true;
        o.userData.baseEmissive = o.userData.baseEmissive || o.material.emissive.clone();
        o.userData.baseOpacity = o.material.opacity;
      }
      o.userData.hl = false;
      o.material.emissive.copy(o.userData.baseEmissive);
      o.castShadow = !o.userData.bulb;
      o.receiveShadow = true;
      const id = o.userData.partId;
      if (!this.partMeshes.has(id)) this.partMeshes.set(id, []);
      this.partMeshes.get(id).push(o);
      this.pickables.push(o);
    });
    this._buildMarkers();
  }

  addTicker(fn) { this.tickers.push(fn); }

  _applyCameraConfig(cfg) {
    const env = cfg.env || {};
    this.envGround = env.ground !== false;
    this.scene.fog = env.fog === false ? null : this.fog;
    const lim = { minDistance: 2.5, maxDistance: 140, near: 0.5, fov: 38, ...(cfg.limits || {}) };
    this.controls.minDistance = lim.minDistance;
    this.controls.maxDistance = lim.maxDistance;
    this.camera.near = lim.near;
    this.camera.fov = lim.fov;
    this.baseFov = lim.fov;
    this.camera.updateProjectionMatrix();
    this.bounds = cfg.bounds ? { min: new THREE.Vector3(...cfg.bounds.min), max: new THREE.Vector3(...cfg.bounds.max) } : null;
    this.focusCfg = { scale: 1.85, add: 3, min: 5, max: 66, ...(cfg.focus || {}) };
    this.flight = null;
  }

  setTheme({ fog, gridMajor, gridMinor, gridOpacity, shadow, accent, hover, exposure }) {
    this.fog.color.set(fog);
    this.grid.material.dispose();
    this.scene.remove(this.grid);
    this.grid = new THREE.GridHelper(240, 120, gridMajor, gridMinor);
    this.grid.position.y = 0.002;
    this.grid.material.transparent = true;
    this.grid.material.opacity = gridOpacity;
    this.scene.add(this.grid);
    this.ground.material.opacity = shadow;
    this.colors.accent.set(accent);
    this.colors.hover.set(hover);
    if (this.routeLine) this.routeLine.material.color.set(accent);
    this.renderer.toneMappingExposure = exposure;
    this._refreshHighlights(true);
  }

  // ------------------------------------------------------------------ selection
  select(id, { focus = true } = {}) {
    const prev = this.selectedId;
    this.selectedId = id;
    this._refreshHighlights(true, prev);
    this._applyIsolate();
    if (id && focus) this.focusPart(id);
    this.markers?.forEach((m, pid) => m.el.classList.toggle('is-selected', pid === id));
  }

  setIsolate(on) { this.isolate = on; this._applyIsolate(); }
  setHotspots(on) { this.showHotspots = on; this.markerLayer.classList.toggle('is-hidden', !on); }

  focusPart(id) {
    const meshes = this.partMeshes.get(id);
    if (!meshes?.length) return;
    const preferred = meshes.filter((m) => m.userData.side !== 'R');
    const set = preferred.length ? preferred : meshes;
    const box = new THREE.Box3();
    set.forEach((m) => box.expandByObject(m));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const fc = this.focusCfg;
    const dist = THREE.MathUtils.clamp(size * fc.scale + fc.add, fc.min, fc.max);
    const hint = this.partsMeta.get(id)?.view;
    let dir;
    if (hint) dir = new THREE.Vector3(...hint).normalize();
    else {
      dir = this.camera.position.clone().sub(this.controls.target).normalize();
      if (center.z < -0.5 && dir.z > 0) dir.z *= -1; // look at the left side from the left
      dir.y = Math.max(dir.y, 0.3);
      dir.normalize();
    }
    this.flyTo(center.clone().addScaledVector(dir, dist), center);
  }

  setView(view) {
    if (!view) return;
    this.flyTo(new THREE.Vector3(...view.position), new THREE.Vector3(...view.target));
  }

  flyTo(position, target, duration = 1.1, { arc = 0 } = {}) {
    this.tooltip.classList.remove('is-visible');
    this.flight = {
      p0: this.camera.position.clone(), t0: this.controls.target.clone(),
      p1: position.clone(), t1: target.clone(), time: 0, duration, arc,
    };
  }

  /** Highlight several parts at once (e.g. everything to check at a walkaround station). */
  setHighlightSet(ids = []) {
    const next = new Set(ids);
    this.highlightSet.forEach((id) => {
      if (!next.has(id) && id !== this.hoverId && id !== this.selectedId) {
        this.partMeshes.get(id)?.forEach((m) => { m.userData.hl = false; m.material.emissive.copy(m.userData.baseEmissive); });
      }
    });
    this.highlightSet = next;
  }

  /** Draw a walking route on the ground with numbered pins. points: [[x, z], ...] */
  setRoute(points, { onPick } = {}) {
    this.clearRoute();
    if (!points?.length) return;
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0.03, z)), true, 'centripetal');
    const geom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(points.length * 24));
    const line = new THREE.Line(geom, new THREE.LineDashedMaterial({
      color: this.colors.accent, dashSize: 0.6, gapSize: 0.45, transparent: true, opacity: 0.9,
    }));
    line.computeLineDistances();
    line.raycast = () => {};
    this.routeLine = line;
    this.scene.add(line);
    this.routePins = points.map(([x, z], i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'route-pin';
      el.textContent = String(i + 1);
      el.addEventListener('click', (e) => { e.stopPropagation(); onPick?.(i); });
      this.routeLayer.appendChild(el);
      return { el, world: new THREE.Vector3(x, 0.05, z) };
    });
  }

  setRouteState(active, done = new Set()) {
    this.routePins?.forEach((p, i) => {
      p.el.classList.toggle('is-active', i === active);
      p.el.classList.toggle('is-done', done.has(i));
    });
  }

  clearRoute() {
    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      this.routeLine.material.dispose();
      this.routeLine = null;
    }
    this.routeLayer.innerHTML = '';
    this.routePins = null;
  }

  _updateRoute() {
    if (!this.routePins) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const p = new THREE.Vector3();
    for (const pin of this.routePins) {
      p.copy(pin.world).project(this.camera);
      const vis = p.z < 1 && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.15;
      pin.el.style.transform = `translate3d(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px, 0)`;
      pin.el.classList.toggle('is-offscreen', !vis);
    }
  }

  _cancelFlight() { this.flight = null; }

  // ------------------------------------------------------------------ internals
  setFov(deg) { this.camera.fov = deg; this.camera.updateProjectionMatrix(); }

  /** Stop rendering (tickers keep running) while another view covers the 3D scene. */
  setPaused(p) { this.paused = p; }

  /** Scale the global lights (1 = normal daylight). Used for night scenes. */
  setLightScale(k) {
    this.hemi.intensity = 0.55 * k;
    this.sun.intensity = 2.6 * k;
    this.scene.environmentIntensity = Math.max(0.15, k);
  }

  /** Keep the visual center clear of overlay panels (px covered on the right / bottom). */
  setInsets({ right = 0, bottom = 0 }) { this.insetTarget = { right, bottom }; }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this._applyInsets();
  }

  _applyInsets() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const { right, bottom } = this.inset || { right: 0, bottom: 0 };
    if (right < 0.5 && bottom < 0.5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w + right, h + bottom, right, bottom, w, h);
    this.camera.updateProjectionMatrix();
  }

  _stepInsets(dt) {
    if (!this.insetTarget) return;
    this.inset = this.inset || { right: 0, bottom: 0 };
    const k = 1 - Math.exp(-dt * 7);
    let changed = false;
    for (const key of ['right', 'bottom']) {
      const d = this.insetTarget[key] - this.inset[key];
      if (Math.abs(d) > 0.3) { this.inset[key] += d * k; changed = true; } else if (d !== 0) { this.inset[key] = this.insetTarget[key]; changed = true; }
    }
    if (changed) this._applyInsets();
  }

  _hit(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (const h of hits) {
      if (h.object.visible && !(this.isolate && this.selectedId && h.object.userData.partId !== this.selectedId && h.object.material.opacity < 0.5)) {
        return h;
      }
    }
    return null;
  }

  _pick(clientX, clientY) { return this._hit(clientX, clientY)?.object.userData.partId ?? null; }

  _pointerMove(e) {
    const rect = this.container.getBoundingClientRect();
    this.pointerPx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (e.buttons) { this._setHover(null); return; }
    this._pendingHover = { x: e.clientX, y: e.clientY };
  }

  _pointerUp(e) {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > 5 || e.button !== 0) return;
    const hit = this._hit(e.clientX, e.clientY);
    const interact = hit?.object.userData.interact;
    if (interact) {
      const r = interact({ uv: hit.uv, shift: e.shiftKey });
      if (r?.handled) {
        this.onInteract(r, hit.object.userData.partId);
        this._lastHover = null; // refresh the hint (switch positions change)
        this._pendingHover = { x: e.clientX, y: e.clientY };
        return;
      }
    }
    this.onSelect(hit?.object.userData.partId ?? null);
  }

  _setHover(id) {
    if (id === this.hoverId) return;
    const prev = this.hoverId;
    this.hoverId = id;
    this._refreshHighlights(true, prev);
    this.renderer.domElement.style.cursor = id ? 'pointer' : '';
    const meta = id && this.partsMeta.get(id);
    this.tooltip.textContent = meta ? meta.name : '';
    this.tooltip.classList.toggle('is-visible', !!meta);
    this.onHover(id);
  }

  _refreshHighlights(force = false, prevId = null) {
    if (prevId && prevId !== this.hoverId && prevId !== this.selectedId && !this.highlightSet.has(prevId)) {
      this.partMeshes.get(prevId)?.forEach((m) => { m.userData.hl = false; m.material.emissive.copy(m.userData.baseEmissive); });
    }
    if (!force) return;
  }

  _paintHighlights(time) {
    const apply = (id, color, k) => {
      this.partMeshes.get(id)?.forEach((m) => {
        m.userData.hl = true;
        m.material.emissive.copy(m.userData.baseEmissive).lerp(color, k);
      });
    };
    const pulse = 0.26 + 0.12 * Math.sin(time * 3.2);
    this.highlightSet.forEach((id) => { if (id !== this.selectedId && id !== this.hoverId) apply(id, this.colors.accent, pulse); });
    if (this.selectedId) apply(this.selectedId, this.colors.accent, 0.42 + 0.16 * Math.sin(time * 3.2));
    if (this.hoverId && this.hoverId !== this.selectedId) apply(this.hoverId, this.colors.hover, 0.38);
  }

  _applyIsolate() {
    const on = this.isolate && this.selectedId;
    this.partMeshes.forEach((meshes, id) => {
      const ghost = on && id !== this.selectedId;
      meshes.forEach((m) => {
        const wantT = ghost || m.userData.baseOpacity < 1;
        if (m.material.transparent !== wantT) { m.material.transparent = wantT; m.material.needsUpdate = true; }
        m.material.opacity = ghost ? 0.08 : m.userData.baseOpacity;
        m.material.depthWrite = !ghost;
        m.castShadow = !ghost && !m.userData.bulb;
      });
    });
  }

  _buildMarkers() {
    this.markerLayer.innerHTML = '';
    this.markers = new Map();
    const tmpBox = new THREE.Box3();
    const tmp = new THREE.Vector3();
    this.partMeshes.forEach((meshes, id) => {
      const meta = this.partsMeta.get(id);
      if (!meta) return;
      const candidates = meshes.filter((m) => !m.isInstancedMesh && m.userData.side !== 'R');
      const pool = candidates.length ? candidates : meshes.filter((m) => !m.isInstancedMesh);
      if (!pool.length) return;
      // representative mesh: the largest one
      let best = pool[0], bestSize = -1;
      pool.forEach((m) => {
        tmpBox.setFromObject(m);
        const s = tmpBox.getSize(tmp).lengthSq();
        if (s > bestSize) { bestSize = s; best = m; }
      });
      const g = best.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new THREE.Vector3());
      const pos = g.attributes.position;
      let nearest = new THREE.Vector3(), nd = Infinity;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 600))) {
        v.fromBufferAttribute(pos, i);
        const d = v.distanceToSquared(c);
        if (d < nd) { nd = d; nearest.copy(v); }
      }
      const el = document.createElement('button');
      el.className = 'marker';
      el.type = 'button';
      el.dataset.category = meta.category;
      el.setAttribute('aria-label', meta.name);
      el.innerHTML = `<span class="marker-dot"></span><span class="marker-label">${meta.name}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onSelect(id); });
      el.addEventListener('pointerenter', () => this._setHover(id));
      el.addEventListener('pointerleave', () => this._setHover(null));
      this.markerLayer.appendChild(el);
      this.markers.set(id, { el, mesh: best, local: nearest, occluded: false, world: new THREE.Vector3() });
    });
  }

  setMarkerFilter(filterFn) {
    this.markers?.forEach((m, id) => m.el.classList.toggle('is-filtered', !filterFn(id)));
  }

  _updateMarkers(now) {
    if (!this.markers || !this.showHotspots) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const doOcclusion = now - this._lastOcclusion > 0.25;
    if (doOcclusion) this._lastOcclusion = now;
    const camPos = this.camera.position;
    const p = new THREE.Vector3();
    this.markers.forEach((m, id) => {
      m.world.copy(m.local);
      m.mesh.localToWorld(m.world);
      p.copy(m.world).project(this.camera);
      const visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      if (doOcclusion && visible) {
        const dir = m.world.clone().sub(camPos);
        const dist = dir.length();
        this.raycaster.set(camPos, dir.normalize());
        this.raycaster.far = dist;
        const hit = this.raycaster.intersectObjects(this.pickables, false).find((x) => x.object.visible && x.object.material.opacity > 0.5);
        m.occluded = !!hit && hit.distance < dist - 0.25 && hit.object.userData.partId !== id;
        this.raycaster.far = Infinity;
      }
      const ghosted = this.isolate && this.selectedId && this.selectedId !== id;
      m.el.style.transform = `translate3d(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px, 0)`;
      m.el.classList.toggle('is-offscreen', !visible || ghosted);
      m.el.classList.toggle('is-occluded', m.occluded);
    });
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = this.clock.elapsedTime;
    for (const t of this.tickers) t(dt, now);
    if (this.paused) return;
    this._stepInsets(dt);

    if (this._pendingHover) {
      const { x, y } = this._pendingHover;
      this._pendingHover = null;
      const hit = this._hit(x, y);
      const id = hit?.object.userData.partId ?? null;
      this._setHover(id);
      const hint = hit?.object.userData.hint?.(hit.uv);
      if (id) {
        this.tooltip.textContent = hint || this.partsMeta.get(id)?.name || '';
        this.tooltip.classList.toggle('is-hint', !!hint);
        this.renderer.domElement.style.cursor = 'pointer';
      }
    }
    if (this.tooltip.classList.contains('is-visible')) {
      this.tooltip.style.transform = `translate3d(${this.pointerPx.x + 14}px, ${this.pointerPx.y + 16}px, 0)`;
    }

    if (this.flight) {
      const f = this.flight;
      f.time += dt;
      const k = ease(Math.min(1, f.time / f.duration));
      this.camera.position.lerpVectors(f.p0, f.p1, k);
      if (f.arc) this.camera.position.y += Math.sin(Math.PI * k) * f.arc;
      this.controls.target.lerpVectors(f.t0, f.t1, k);
      if (k >= 1) this.flight = null;
    }
    this.controls.update();
    if (this.bounds) this.camera.position.clamp(this.bounds.min, this.bounds.max);
    const above = this.camera.position.y > 0.05 && this.envGround;
    this.grid.visible = above;
    this.ground.visible = above;
    this._paintHighlights(now);
    this._updateMarkers(now);
    this._updateRoute();
    this.renderer.render(this.scene, this.camera);
  }
}
