// 3D wave-grid background: a 40 × 40 field of blocks, lifted by ripples that
// spread from the pointer (or from random points when the pointer is idle).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const root = document.documentElement;
const wrap = document.querySelector(".site-wave");
const canvas = document.getElementById("wave");
const coarse = matchMedia("(pointer: coarse)").matches;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = !!navigator.connection?.saveData;

if (coarse || reduce || saveData) {
  wrap.classList.add("fallback");
} else {
  try { start(); } catch (e) { wrap.classList.add("fallback"); }
}

function start() {
  const GRID = 40, STEP = 0.81, SIZE = STEP * GRID;
  const MAX_TRAIL = 128;
  const opts = { waveSpeed: 3.6, waveFreq: 1.2, waveWidth: 3.4, amplitude: 0.5, maxHeight: 0.7, jitter: 0.2 };
  const palette = () => root.classList.contains("dark")
    ? { base: "#0E0A1C", high: "#5FE3CF", vignette: true }
    : { base: "#EEE8F8", high: "#3B0F8A", vignette: false };

  const size = () => ({ w: wrap.clientWidth || 1, h: wrap.clientHeight || 1, pr: Math.min(devicePixelRatio, 2) });
  let s = size();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, s.w / s.h, 0.1, 500);
  let dist = 12;
  const fit = () => {
    const v = (camera.fov * Math.PI) / 360;
    const hz = Math.atan(Math.tan(v) * camera.aspect);
    const half = SIZE / 2;
    dist = 0.9 * Math.min(half / Math.tan(v), half / Math.tan(hz)) + 1.5;
  };
  const TILT_X = 0.03 * Math.PI, TILT_Y = 0.05 * Math.PI;
  const aim = (x, y) => {
    const a = y * TILT_X, b = x * TILT_Y;
    camera.position.set(-dist * Math.cos(a) * Math.sin(b), dist * Math.cos(a) * Math.cos(b), dist * Math.sin(a));
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
  };
  fit(); aim(0, 0);

  scene.add(new THREE.AmbientLight("#ffffff", 0.5));
  const sun = new THREE.DirectionalLight("#ffffff", 4);
  sun.position.set(-20, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 6;
  Object.assign(sun.shadow.camera, { near: 0.1, far: 60, left: -22, right: 22, top: 22, bottom: -22 });
  sun.shadow.bias = 1e-4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#ffffff", 1);
  fill.position.set(10, 5, -3);
  scene.add(fill);

  // Trail of ripple sources, packed into a 128 × 1 float texture: x, z, age, strength.
  const trailData = new Float32Array(MAX_TRAIL * 4);
  const trailTex = new THREE.DataTexture(trailData, MAX_TRAIL, 1, THREE.RGBAFormat, THREE.FloatType);
  trailTex.needsUpdate = true;
  const U = {
    uTrailTexture: { value: trailTex }, uTrailCount: { value: 0 }, uFadeTime: { value: 2 },
    uWaveSpeed: { value: opts.waveSpeed }, uWaveFreq: { value: opts.waveFreq }, uWaveWidth: { value: opts.waveWidth },
    uAmplitude: { value: opts.amplitude }, uJitter: { value: opts.jitter }, uMaxHeight: { value: opts.maxHeight },
  };
  const C = { uColorBase: { value: new THREE.Color() }, uColorHigh: { value: new THREE.Color() } };

  const vertexPatch = (src) => src
    .replace("#include <common>", `#include <common>
      varying float vHeight;
      attribute vec2 aOffset;
      uniform sampler2D uTrailTexture;
      uniform int uTrailCount;
      uniform float uWaveSpeed, uWaveFreq, uWaveWidth, uFadeTime, uAmplitude, uJitter, uMaxHeight;
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453123) - 0.5;
      }`)
    .replace("#include <begin_vertex>", `#include <begin_vertex>
      vHeight = 0.0;
      if (position.y > 0.0) {
        vec2 worldXZ = aOffset + hash2(aOffset) * uJitter;
        float waveHeight = 0.0, totalWeight = 0.0;
        for (int i = 0; i < ${MAX_TRAIL}; i++) {
          if (i >= uTrailCount) break;
          vec4 td = texture2D(uTrailTexture, vec2((float(i) + 0.5) / ${MAX_TRAIL}.0, 0.5));
          float d = length(worldXZ - td.rg);
          float rel = d - uWaveSpeed * td.b;
          float window = exp(-(rel * rel) / (uWaveWidth * uWaveWidth));
          float fade = exp(-td.b / uFadeTime);
          float atten = 1.0 / (1.0 + d * 0.1);
          float w = fade * window * atten * td.a;
          waveHeight += w * cos(uWaveFreq * rel);
          totalWeight += w;
        }
        waveHeight /= max(totalWeight, 1.0);
        float disp = clamp(waveHeight * uAmplitude, -uMaxHeight, uMaxHeight);
        transformed.y += disp;
        vHeight = disp;
      }`);

  const geo = new THREE.BoxGeometry(0.8, 3, 0.8);
  const offsets = new THREE.InstancedBufferAttribute(new Float32Array(GRID * GRID * 2), 2);
  geo.setAttribute("aOffset", offsets);

  const mat = new THREE.MeshPhongMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, C);
    sh.vertexShader = vertexPatch(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying float vHeight;
        uniform vec3 uColorBase;
        uniform vec3 uColorHigh;
        uniform float uMaxHeight;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float tt = clamp(vHeight / uMaxHeight, 0.0, 1.0);
        diffuseColor.rgb = mix(uColorBase, uColorHigh, tt);`);
  };
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); sh.vertexShader = vertexPatch(sh.vertexShader); };

  const mesh = new THREE.InstancedMesh(geo, mat, GRID * GRID);
  mesh.customDepthMaterial = depthMat;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const half = ((GRID - 1) * STEP) / 2;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const n = i * GRID + j, x = STEP * i - half, z = STEP * j - half;
    dummy.position.set(x, 0, z);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    offsets.setXY(n, x, z);
  }
  mesh.instanceMatrix.needsUpdate = true;
  offsets.needsUpdate = true;
  scene.add(mesh);

  // Invisible plane the pointer ray hits, to turn screen position into grid x/z.
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, visible: false }));
  plane.rotation.x = -Math.PI / 2;
  plane.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const target = new THREE.Vector2(), tilt = new THREE.Vector2();

  const trail = [];
  let last = null, idle = 0, autoT = 0, auto = true;
  const push = (x, z, strength) => {
    if (trail.length >= MAX_TRAIL) trail.shift();
    trail.push({ x, z, age: 0, k: strength });
  };
  addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    target.copy(ndc);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(plane);
    if (!hit.length) return;
    const { x, z } = hit[0].point;
    let d = 0;
    if (last) { d = Math.hypot(x - last.x, z - last.z); if (d < 0.1) return; }
    push(x, z, d);
    last = { x, z };
    idle = 0; auto = false; autoT = 0;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { target.set(0, 0); last = null; });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor("#808080");
  renderer.setSize(s.w, s.h, false);
  renderer.setPixelRatio(s.pr);

  // Chromatic edge shift + vignette (dark theme only).
  const vignette = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, shiftAmount: { value: 0.005 }, vignetteRadius: { value: 0.3 }, vignetteSoftness: { value: 0.3 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float shiftAmount, vignetteRadius, vignetteSoftness; varying vec2 vUv;
      void main() {
        vec2 c = vec2(0.5);
        float d = distance(vUv, c);
        vec2 q = vec2(sign(vUv.x - c.x), sign(vUv.y - c.y));
        float v = smoothstep(vignetteRadius, vignetteRadius + vignetteSoftness, d);
        float sh = shiftAmount * v;
        float r = texture2D(tDiffuse, vUv + sh * q).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - sh * q).b;
        gl_FragColor = vec4(vec3(r, g, b) * (1.0 - v * 0.5), 1.0);
      }`,
  });
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(vignette);
  composer.addPass(new OutputPass());
  composer.setSize(s.w, s.h);
  composer.setPixelRatio(s.pr);

  const applyTheme = () => {
    const p = palette();
    C.uColorBase.value.set(p.base);
    C.uColorHigh.value.set(p.high);
    scene.background = new THREE.Color(p.base).multiplyScalar(0.5);
    vignette.enabled = p.vignette;
  };
  applyTheme();
  new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ["class"] });

  const onResize = () => {
    s = size();
    camera.aspect = s.w / s.h;
    camera.updateProjectionMatrix();
    fit(); aim(tilt.x, tilt.y);
    renderer.setSize(s.w, s.h, false);
    renderer.setPixelRatio(s.pr);
    composer.setSize(s.w, s.h);
    composer.setPixelRatio(s.pr);
  };
  addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    for (let i = trail.length - 1; i >= 0; i--) { trail[i].age += dt; if (trail[i].age > 8) trail.splice(i, 1); }
    // After 3 s without pointer movement, drop a random ripple every 1.5 s.
    idle += dt;
    if (idle >= 3 && !auto) { auto = true; autoT = 0; }
    if (auto && (autoT += dt) >= 1.5) {
      push((Math.random() * 0.5 - 0.25) * SIZE, (Math.random() * 0.5 - 0.25) * SIZE, 0.8 + Math.random() * 0.2);
      autoT = 0;
    }
    const n = Math.min(trail.length, MAX_TRAIL);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      trailData[k] = trail[i].x; trailData[k + 1] = trail[i].z; trailData[k + 2] = trail[i].age; trailData[k + 3] = trail[i].k;
    }
    trailTex.needsUpdate = true;
    U.uTrailCount.value = n;
    tilt.x += (target.x - tilt.x) * 0.04;
    tilt.y += (target.y - tilt.y) * 0.04;
    aim(tilt.x, tilt.y);
    composer.render();
  });
  wrap.classList.add("live");
}
