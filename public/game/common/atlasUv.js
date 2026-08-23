// Shared atlas UV instancing. Per-instance vec4 (u, v, du, dv) scales
// vMapUv so one InstancedMesh can show many cells of one texture.

import * as THREE from 'three'

export function atlasUvMaterial(map, {
  basic = false,
  transparent = false,
  roughness = 0.72,
  metalness = 0.02,
  side = THREE.FrontSide,
  key = 'atlas-uv',
} = {}) {
  const mat = basic
    ? new THREE.MeshBasicMaterial({ map, transparent, side, depthWrite: !transparent })
    : new THREE.MeshStandardMaterial({
      map, color: 0xffffff, roughness, metalness, side, transparent,
      depthWrite: !transparent,
    })
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 instanceUv;
varying vec4 vInstanceUv;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vInstanceUv = instanceUv;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec4 vInstanceUv;`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv * vInstanceUv.zw + vInstanceUv.xy );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,
      )
  }
  mat.customProgramCacheKey = () => key
  return mat
}
