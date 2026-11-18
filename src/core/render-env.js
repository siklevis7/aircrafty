// Physically based outdoor environment: a procedural Preetham sky (three's Sky.js) rendered
// into a PMREM cube map that serves as both the visible background and the reflection/IBL source.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

const PRESETS = {
  // clear midday, light haze
  day: { turbidity: 2.4, rayleigh: 1.7, mie: 0.0035, mieG: 0.8, ground: '#8d8f8c' },
  // blue hour: sun just below the horizon (used for the dark theme)
  dusk: { turbidity: 4.5, rayleigh: 2.6, mie: 0.006, mieG: 0.85, ground: '#2a2d33', elevation: -1.5 },
};

/**
 * Build PMREM environment maps for a sun direction.
 * Returns { day: { env, bg }, dusk: { env, bg } }: env = PMREM texture for scene.environment,
 * bg = a crisp 512 px half-float cube texture for scene.background (the 256 px PMREM would band).
 */
export function createSkyEnvironments(renderer, sunDir) {
  // Built lazily: the blue-hour sky is only rendered the first time the dark theme needs it.
  const cache = {};
  const out = {};
  for (const key of Object.keys(PRESETS)) {
    Object.defineProperty(out, key, { enumerable: true, get: () => (cache[key] ||= buildSky(renderer, sunDir, PRESETS[key])) });
  }
  return out;
}

function buildSky(renderer, sunDir, p) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const scene = new THREE.Scene();
    const sky = new Sky();
    sky.scale.setScalar(50);
    const u = sky.material.uniforms;
    u.turbidity.value = p.turbidity;
    u.rayleigh.value = p.rayleigh;
    u.mieCoefficient.value = p.mie;
    u.mieDirectionalG.value = p.mieG;
    const dir = sunDir.clone().normalize();
    if (p.elevation !== undefined) {
      const az = Math.atan2(dir.z, dir.x);
      const el = THREE.MathUtils.degToRad(p.elevation);
      dir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    }
    u.sunPosition.value.copy(dir);
    scene.add(sky);
    // A large ground disc below the horizon so reflections of the lower hemisphere read as apron, not void.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 48),
      new THREE.MeshBasicMaterial({ color: p.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    scene.add(ground);
    const env = pmrem.fromScene(scene, 0, 0.1, 100).texture;
    const cubeRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: false });
    new THREE.CubeCamera(0.1, 100, cubeRT).update(renderer, scene);
    sky.geometry.dispose(); sky.material.dispose();
    ground.geometry.dispose(); ground.material.dispose();
    pmrem.dispose();
    return { env, bg: cubeRT.texture };
  }
}
