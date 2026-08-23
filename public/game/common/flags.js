// Live debug toggles. Set in the console; apply on the next frame.
//
//   flags.instances = false   // hide InstancedMesh (NPC/player/rat/arm/pedestal/poster)
//   flags.pointLights = false // disable PointLights (sun/hemi stay)
//   flags.kit = false         // hide Kit:* room greybox
//   flags.help()

const flags = (typeof window !== 'undefined' && (window.flags ||= {})) || {}
if (flags.instances == null) flags.instances = true
if (flags.pointLights == null) flags.pointLights = true
if (flags.kit == null) flags.kit = true

flags.help = () => {
  const line = (k, note) => `  flags.${k} = ${flags[k]}  ${note}`
  const msg = [
    'window.flags (toggle in the console, next frame)',
    line('instances', 'InstancedMesh: characters, nametags, pedestals, posters, food, labels, holes'),
    line('pointLights', 'PointLight only (directional / hemi stay)'),
    line('kit', 'Kit:* room greybox (walls, counters, floors, roofs, glass)'),
  ].join('\n')
  console.log(msg)
  return flags
}

export { flags }

export function applyFlags(scene) {
  if (!scene) return
  const inst = flags.instances !== false
  const kitOn = flags.kit !== false
  const lights = flags.pointLights !== false
  scene.traverse(o => {
    if (o.isPointLight) {
      o.visible = lights
      return
    }
    if (!o.isInstancedMesh) return
    const isKit = (o.name || '').startsWith('Kit:')
    o.visible = isKit ? kitOn : inst
  })
}
