import * as THREE from 'three'

export function createHexCoin(container: HTMLElement) {
  const scene = new THREE.Scene()
  
  const aspect = 1
  const frustumSize = 8
  const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
  )
  camera.position.set(3, 4, 4)
  camera.lookAt(0, 1, 0)
  
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)
  
  // Hexagonal prism (coin)
  const hexShape = new THREE.Shape()
  const radius = 2
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6 - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) {
      hexShape.moveTo(x, y)
    } else {
      hexShape.lineTo(x, y)
    }
  }
  hexShape.closePath()
  
  const extrudeSettings = {
    depth: 0.8,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 3,
  }
  const geometry = new THREE.ExtrudeGeometry(hexShape, extrudeSettings)
  const material = new THREE.MeshPhongMaterial({
    color: 0x0d2535,
    emissive: 0x1e4050,
    emissiveIntensity: 0.3,
    shininess: 100,
  })
  const coin = new THREE.Mesh(geometry, material)
  geometry.center()
  coin.position.set(0, 1, 0)
  coin.castShadow = true
  
  scene.add(coin)
  
  // Square platform with rounded corners
  const platformShape = new THREE.Shape()
  const s = 1.5
  const r = 0.3
  
  platformShape.moveTo(-s + r, -s)
  platformShape.lineTo(s - r, -s)
  platformShape.quadraticCurveTo(s, -s, s, -s + r)
  platformShape.lineTo(s, s - r)
  platformShape.quadraticCurveTo(s, s, s - r, s)
  platformShape.lineTo(-s + r, s)
  platformShape.quadraticCurveTo(-s, s, -s, s - r)
  platformShape.lineTo(-s, -s + r)
  platformShape.quadraticCurveTo(-s, -s, -s + r, -s)
  platformShape.closePath()
  
  const platformDepth = 0.8
  const platformGeometry = new THREE.ExtrudeGeometry(platformShape, {
    depth: platformDepth,
    bevelEnabled: false,
    material: 0,
    extrudeMaterialIndex: 1,
  } as THREE.ExtrudeGeometryOptions & { material: number; extrudeMaterialIndex: number })

  // Alpha map: vertical fade for side faces (black=transparent at bottom, white=opaque at top)
  const alphaCanvas = document.createElement('canvas')
  alphaCanvas.width = 1
  alphaCanvas.height = 64
  const actx = alphaCanvas.getContext('2d')!
  const aGrad = actx.createLinearGradient(0, 0, 0, 64)
  aGrad.addColorStop(0, '#000')   // top of image → V=1 → top → transparent
  aGrad.addColorStop(0.4, '#666')
  aGrad.addColorStop(1, '#fff')   // bottom of image → V=0 → bottom → opaque
  actx.fillStyle = aGrad
  actx.fillRect(0, 0, 1, 64)
  const alphaTexture = new THREE.CanvasTexture(alphaCanvas)

  const holoColor = 0x00ddff

  // Top/bottom faces: ShaderMaterial with world-Y alpha (bottom invisible)
  const faceMat = new THREE.ShaderMaterial({
    uniforms: {
      holoColor: { value: new THREE.Color(holoColor) },
      intensity: { value: 0.25 },
      baseAlpha: { value: 0.35 },
    },
    vertexShader: `
      varying float vWorldY;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldY = worldPos.y;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 holoColor;
      uniform float intensity;
      uniform float baseAlpha;
      varying float vWorldY;
      void main() {
        float alpha = smoothstep(-2.5, -1.6, vWorldY) * baseAlpha;
        gl_FragColor = vec4(holoColor + holoColor * intensity, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  // Side faces: same + vertical alpha fade
  const sideMat = new THREE.MeshPhongMaterial({
    color: holoColor,
    emissive: holoColor,
    emissiveIntensity: 0.25,
    alphaMap: alphaTexture,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const platform = new THREE.Mesh(platformGeometry, [faceMat, sideMat])
  platformGeometry.center()
  platform.rotation.x = -Math.PI / 2
  platform.position.y = -2
  
  scene.add(platform)

  // Smooth top-edge glow via geometry-sampled curve + TubeGeometry
  {
    const allEdges = new THREE.EdgesGeometry(platformGeometry, 30)
    const pos = allEdges.attributes.position
    const eps = 0.01
    const topZ = platformDepth / 2

    const verts: THREE.Vector3[] = []
    const keyed = new Set<string>()
    for (let i = 0; i < pos.count - 1; i += 2) {
      const i0 = i * 3
      const i1 = (i + 1) * 3
      const z0 = pos.array[i0 + 2]
      const z1 = pos.array[i1 + 2]
      if (Math.abs(z0 - topZ) < eps && Math.abs(z1 - topZ) < eps) {
        for (const idx of [i0, i1]) {
          const k = `${pos.array[idx].toFixed(4)},${pos.array[idx + 1].toFixed(4)}`
          if (!keyed.has(k)) {
            keyed.add(k)
            verts.push(new THREE.Vector3(pos.array[idx], pos.array[idx + 1], pos.array[idx + 2]))
          }
        }
      }
    }

    verts.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x))

    const curve = new THREE.CatmullRomCurve3(verts, true)
    const tubeGeom = new THREE.TubeGeometry(curve, 64, 0.025, 6, true)
    const glowMat = new THREE.MeshPhongMaterial({
      color: 0x00eeff,
      emissive: 0x00eeff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    platform.add(new THREE.Mesh(tubeGeom, glowMat))
  }

  // Hex coin edge glow
  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.6,
  })
  const wireframe = new THREE.LineSegments(edges, lineMaterial)
  coin.add(wireframe)
  
  // Trend chart on hex face
  const chartPoints = [
    new THREE.Vector3(-0.5, -0.2, 0.5),
    new THREE.Vector3(-0.3, 0.1, 0.5),
    new THREE.Vector3(-0.1, -0.1, 0.5),
    new THREE.Vector3(0.1, 0.3, 0.5),
    new THREE.Vector3(0.3, 0.0, 0.5),
    new THREE.Vector3(0.5, 0.4, 0.5),
  ]
  
  const sCurve = new THREE.CatmullRomCurve3(chartPoints)
  const sTubeGeometry = new THREE.TubeGeometry(sCurve, 64, 0.03, 8, false)
  const sMaterial = new THREE.MeshPhongMaterial({
    color: 0x00d4ff,
    emissive: 0x00d4ff,
    emissiveIntensity: 0.5,
    shininess: 100,
  })
  const sMesh = new THREE.Mesh(sTubeGeometry, sMaterial)
  sMesh.castShadow = true
  
  coin.add(sMesh)
  
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 8, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 1024
  directionalLight.shadow.mapSize.height = 1024
  scene.add(directionalLight)
  
  const backLight = new THREE.DirectionalLight(0x00d4ff, 0.4)
  backLight.position.set(-5, 3, -5)
  scene.add(backLight)
  
  const fillLight = new THREE.DirectionalLight(0x0066cc, 0.3)
  fillLight.position.set(-3, 2, 3)
  scene.add(fillLight)
  
  // Render once
  renderer.render(scene, camera)
  
  // Handle resize
  const onResize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    const aspect = width / height
    renderer.setSize(width, height)
    camera.left = frustumSize * aspect / -2
    camera.right = frustumSize * aspect / 2
    camera.top = frustumSize / 2
    camera.bottom = frustumSize / -2
    camera.updateProjectionMatrix()
  }
  
  window.addEventListener('resize', onResize)
  
  return {
    destroy() {
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    },
  }
}
