// Post-processing chain for the viewer: HDR render (MSAA) → ground-truth ambient occlusion
// → subtle bloom for lights → tone mapping / sRGB output → (SMAA only when MSAA is unavailable).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/**
 * AO pass that renders its G-buffer at half resolution and leaves out things that should not
 * occlude: lines, sprites (light glows), the sky background, ghosted (isolate) and glass meshes.
 */
class SceneAOPass extends GTAOPass {
  constructor(scene, camera, w, h) {
    super(scene, camera, Math.max(1, w >> 1), Math.max(1, h >> 1));
    this._bg = null;
  }
  setSize(w, h) { super.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); }
  overrideVisibility() {
    const cache = this._visibilityCache;
    this._bg = this.scene.background;
    this.scene.background = null;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO) { o.visible = false; return; }
      const m = o.material;
      if (o.isMesh && m && !Array.isArray(m) && m.transparent && m.opacity < 0.5) o.visible = false;
    });
  }
  restoreVisibility() {
    super.restoreVisibility();
    this.scene.background = this._bg;
    this._bg = null;
  }
}

export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const maxSamples = renderer.capabilities.maxSamples || 0;
  const samples = Math.min(4, maxSamples);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const ao = new SceneAOPass(scene, camera, size.x, size.y);
  ao.blendIntensity = 1;
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, samples: 8, rings: 2 });
  composer.addPass(ao);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.28, 0.45, 1.6);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  const smaa = new SMAAPass(size.x, size.y);
  smaa.enabled = samples < 2;
  composer.addPass(smaa);

  return {
    composer, ao, bloom, smaa,
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
    },
    /** Scale AO to the scene: `r` is the world-space AO radius in metres. */
    setScale(r) {
      ao.updateGtaoMaterial({ radius: r, thickness: r * 1.5, distanceFallOff: 1, scale: 1, samples: 12, distanceExponent: 1 });
    },
    setBloom({ strength, threshold, radius } = {}) {
      if (strength !== undefined) bloom.strength = strength;
      if (threshold !== undefined) bloom.threshold = threshold;
      if (radius !== undefined) bloom.radius = radius;
    },
    render(dt) { composer.render(dt); },
    dispose() {
      composer.passes.forEach((p) => p.dispose?.());
      composer.dispose();
    },
  };
}
