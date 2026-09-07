/* 3D-схеми (three.js): набір із file *.glb показується як модель, яку можна крутити; точки (items[].p3) —
   ті самі піни, що й на картинках, тож усі режими тренажера працюють без змін.
   Модуль підмінює Viewer.load / renderPins / centerOn / fit: якщо завантажено .glb — працює 3D, інакше — звичайна картинка.
   Моделі: Z-Anatomy (CC BY-SA 4.0), експорт tools/z3d_export.py. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const V3 = {
  active: false, set: null, renderer: null, scene: null, camera: null, controls: null, root: null, meshes: [],
  pins: [], pinEls: [], box: null, raf: 0, ray: new THREE.Raycaster(), container: null, canvas: null, pinsEl: null, dirty: true, dist: 1.9,
  loader: new GLTFLoader(),
  css: getComputedStyle(document.documentElement),

  ensure(container) {
    if (this.renderer && this.container === container && container.contains(this.canvas)) return;
    this.container = container;
    const stage = container.querySelector('#stage'); if (stage) stage.style.display = 'none';
    const old = container.querySelector('#stage3d'); if (old) old.remove();
    const wrap = document.createElement('div'); wrap.id = 'stage3d';
    wrap.innerHTML = '<div id="pins3d"></div><div class="hint3d">крутити — перетягування · зум — колесо/пінч</div>';
    container.appendChild(wrap);
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f6a, 1.15));
      const d = new THREE.DirectionalLight(0xffffff, 1.3); d.position.set(2, 3, 4); this.scene.add(d);
      const d2 = new THREE.DirectionalLight(0xffffff, 0.5); d2.position.set(-3, -1, -2); this.scene.add(d2);
    }
    this.canvas = this.renderer.domElement; wrap.insertBefore(this.canvas, wrap.firstChild);
    this.pinsEl = wrap.querySelector('#pins3d');
    if (this.controls) this.controls.dispose();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.12; this.controls.enablePan = false;
    this.controls.minDistance = 0.9; this.controls.maxDistance = 6; this.controls.rotateSpeed = 0.8;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.canvas.addEventListener('pointerdown', e => e.stopPropagation(), true);   // не віддавати жест 2D-в’юверу
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); }, { passive: false, capture: true });
    if (this.ro) this.ro.disconnect(); this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container);
    this.resize();
    const zc = container.querySelector('.zoomctl');
    if (zc) { zc.querySelector('#zin').onclick = () => this.zoom(0.75); zc.querySelector('#zout').onclick = () => this.zoom(1.33); zc.querySelector('#zfit').onclick = () => this.fit(); }
    const hb = container.querySelector('.hintbar'); if (hb) hb.style.display = 'none';
  },
  resize() {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth, h = this.container.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true;
  },
  zoom(f) { const c = this.controls; const d = Math.min(c.maxDistance, Math.max(c.minDistance, this.camera.position.length() * f)); this.camera.position.setLength(d); this.dirty = true; },
  fit() { this.camera.position.set(0.55, 0.9, 1.0).normalize().multiplyScalar(this.dist); this.controls.target.set(0, 0, 0); this.controls.update(); this.dirty = true; },   // косий вид зверху-спереду
  bg() { const c = this.css.getPropertyValue('--canvas').trim() || '#f6f4ee'; try { this.scene.background = new THREE.Color(c); } catch (e) { this.scene.background = null; } },

  async load(src, container) {
    try { this.ensure(container); }
    catch (e) { console.error('webgl', e); this.active = false; const w = container.querySelector('#stage3d'); if (w) w.innerHTML = '<div class="empty" style="margin:16px">3D-модель не відкривається: у цьому браузері немає WebGL. Спробуйте інший браузер або оновіть систему.</div>'; return false; }
    this.set = (window.ATLAS ? ATLAS.sets : []).find(s => src.indexOf(s.file) >= 0) || null;
    if (this.root) { this.scene.remove(this.root); this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.root = null; }
    this.meshes = []; this.pins = []; this.pinsEl.innerHTML = '';
    let gltf; try { gltf = await this.loader.loadAsync(src); } catch (e) { console.error('glb', e); this.active = false; return false; }
    const root = gltf.scene; const bone = new THREE.MeshStandardMaterial({ color: 0xe9e2d1, roughness: 0.78, metalness: 0.0 });
    const colored = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 });
    root.traverse(o => { if (o.isMesh) { o.material = o.geometry.getAttribute('color') ? colored : bone; o.geometry.computeVertexNormals(); this.meshes.push(o); } });   // колір із GLB: кістка / м'яз / сухожилок
    // центр і масштаб уже нормалізовані при експорті (найбільший розмір = 1), але про всяк випадок
    const box = new THREE.Box3().setFromObject(root); const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    root.position.sub(c); const k = 1 / Math.max(size.x, size.y, size.z); root.scale.setScalar(k); root.position.multiplyScalar(k);
    this.scene.add(root); this.root = root; this.box = box;
    this.active = true; this.bg(); this.fit();
    if (!this.raf) this.loop();
    return true;
  },
  deactivate() {
    this.active = false;
    const wrap = this.container && this.container.querySelector('#stage3d'); if (wrap) wrap.remove();
    const stage = this.container && this.container.querySelector('#stage'); if (stage) stage.style.display = '';
    const hb = this.container && this.container.querySelector('.hintbar'); if (hb) hb.style.display = '';
  },
  p3(id) { if (!this.set) return null; const key = String(id).split(':')[0]; const it = this.set.items.find(i => String(i.pid || i.n) === key); /* id тренажера — 'n:індекс точки' */ return it && it.p3 ? new THREE.Vector3(it.p3[0], it.p3[1], it.p3[2]) : null; },
  renderPins(list) {
    this.pinsEl.innerHTML = ''; this.pins = []; this.pinEls = [];
    for (const p of list) {
      const v = this.p3(p.id); if (!v) continue;
      const el = document.createElement('div'); el.className = 'pin ' + (p.cls || ''); el.dataset.id = p.id; el.textContent = p.label ?? ''; if (p.title) el.title = p.title;
      el.addEventListener('pointerdown', e => { e.stopPropagation(); });
      el.addEventListener('click', e => { e.stopPropagation(); const H = typeof Viewer !== 'undefined' && Viewer.handlers; if (H && H.onPinClick) H.onPinClick(p.id); });
      this.pinsEl.appendChild(el); this.pins.push(v); this.pinEls.push(el);
    }
    this.dirty = true;
  },
  centerOn(x, y) {
    // x,y — відсотки з pts[0]; знаходимо пін з такими ж pts і повертаємо камеру до нього
    if (!this.set) return; const it = this.set.items.find(i => i.pts && i.pts[0] && Math.abs(i.pts[0][0] - x) < 0.01 && Math.abs(i.pts[0][1] - y) < 0.01);
    const v = it && it.p3 ? new THREE.Vector3(...it.p3) : null; if (!v) return;
    const dir = v.clone().normalize(); if (dir.length() < 1e-3) return;
    const d = this.camera.position.length(); this.camera.position.copy(dir.multiplyScalar(d)); this.controls.update(); this.dirty = true;
  },
  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    if (!this.active || !this.container || !this.container.isConnected) { if (!this.container || !this.container.isConnected) { cancelAnimationFrame(this.raf); this.raf = 0; } return; }
    const moved = this.controls.update();
    if (!this.dirty && !moved) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
    this.projectPins();
  },
  projectPins() {
    const w = this.container.clientWidth, h = this.container.clientHeight; const cam = this.camera; cam.updateMatrixWorld();
    const camPos = cam.position;
    for (let i = 0; i < this.pins.length; i++) {
      const p = this.pins[i], el = this.pinEls[i];
      const s = p.clone().project(cam);
      const x = (s.x + 1) / 2 * w, y = (1 - s.y) / 2 * h;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      // прихована точка: між камерою і точкою є поверхня моделі
      const dir = p.clone().sub(camPos); const dist = dir.length(); dir.normalize();
      this.ray.set(camPos, dir); this.ray.far = dist - 0.004;
      const hit = this.ray.intersectObjects(this.meshes, false);
      el.classList.toggle('occ', hit.length > 0);
    }
  }
};
window.Viewer3D = V3;

// ---- підміна методів 2D-в’ювера ----
(function patch() {
  if (typeof Viewer === 'undefined') return;   // Viewer — глобальний const із app.js (не властивість window)
  const V = Viewer, is3d = src => typeof src === 'string' && /\.glb(\?|$)/.test(src);
  const load = V.load.bind(V), renderPins = V.renderPins.bind(V), centerOn = V.centerOn.bind(V), fit = V.fit.bind(V), layout = V.layout.bind(V), mount = V.mount.bind(V);
  V.mount = (container, opts) => { V3.active = false; mount(container, opts); };
  V.load = async (src, w, h) => { if (is3d(src)) { V.V.ready = false; return V3.load(src, V.el); } V3.deactivate(); return load(src, w, h); };
  V.renderPins = list => V3.active ? V3.renderPins(list) : renderPins(list);
  V.centerOn = (x, y, zoom) => V3.active ? V3.centerOn(x, y) : centerOn(x, y, zoom);
  V.fit = () => V3.active ? V3.fit() : fit();
  V.layout = () => V3.active ? V3.resize() : layout();
  new MutationObserver(() => { if (V3.active) V3.bg(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
