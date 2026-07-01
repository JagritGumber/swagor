import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export function createHexCoin(container: HTMLElement) {
  const scene = new THREE.Scene()
  
  const aspect = container.clientWidth / container.clientHeight
  const frustumSize = 10
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

  const labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(container.clientWidth, container.clientHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.left = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  container.appendChild(labelRenderer.domElement)
  
  // Draw a rounded hexagon onto a Shape or Path
  function addRoundedHex(
    api: { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void },
    R: number,
    cr: number,
    cw = false
  ) {
    const n = 6
    const verts: THREE.Vector2[] = []
    for (let i = 0; i < n; i++) {
      const idx = cw ? (n - i) % n : i
      const angle = (idx * Math.PI * 2) / n - Math.PI / 2
      verts.push(new THREE.Vector2(Math.cos(angle) * R, Math.sin(angle) * R))
    }
    const edges: THREE.Vector2[] = []
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector2().copy(verts[(i + 1) % n]).sub(verts[i]).normalize()
      edges.push(dir)
    }
    const offset = cr / Math.tan(Math.PI / 6)
    const start = new THREE.Vector2().copy(verts[0]).addScaledVector(edges[0], offset)
    api.moveTo(start.x, start.y)
    for (let i = 1; i < n; i++) {
      const lineEnd = new THREE.Vector2().copy(verts[i]).sub(edges[i - 1].clone().multiplyScalar(offset))
      api.lineTo(lineEnd.x, lineEnd.y)
      const curveEnd = new THREE.Vector2().copy(verts[i]).addScaledVector(edges[i], offset)
      api.quadraticCurveTo(verts[i].x, verts[i].y, curveEnd.x, curveEnd.y)
    }
    const lastLineEnd = new THREE.Vector2().copy(verts[0]).sub(edges[n - 1].clone().multiplyScalar(offset))
    api.lineTo(lastLineEnd.x, lastLineEnd.y)
    api.quadraticCurveTo(verts[0].x, verts[0].y, start.x, start.y)
  }

  // Hexagonal prism (coin) with rounded corners
  const hexShape = new THREE.Shape()
  addRoundedHex(hexShape, 2, 0.08)
  hexShape.closePath()
  
  const extrudeSettings = {
    depth: 0.8,
    bevelEnabled: false,
  }
  const geometry = new THREE.ExtrudeGeometry(hexShape, extrudeSettings)
  const coinMat = new THREE.MeshPhysicalMaterial({
    color: 0x081a2e,
    metalness: 0.85,
    roughness: 0.15,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    emissive: 0x004488,
    emissiveIntensity: 0.35,
  })
  const coin = new THREE.Mesh(geometry, coinMat)
  geometry.center()
  coin.position.set(0.4, 1, 0)
  coin.castShadow = true
  
  scene.add(coin)

  // Filtered edge outline: only edges on the top and bottom face (Z extremes)
  function addFaceOutline(mesh: THREE.Mesh, geom: THREE.BufferGeometry, depth: number, color: number, opacity: number) {
    const edges = new THREE.EdgesGeometry(geom, 1)
    const pos = edges.attributes.position
    const pts: number[] = []
    const half = depth / 2
    const eps = 0.01
    for (let i = 0; i < pos.count; i += 2) {
      const z0 = pos.array[i * 3 + 2]
      const z1 = pos.array[(i + 1) * 3 + 2]
      if ((Math.abs(z0 - half) < eps && Math.abs(z1 - half) < eps) ||
          (Math.abs(z0 + half) < eps && Math.abs(z1 + half) < eps)) {
        pts.push(pos.array[i * 3], pos.array[i * 3 + 1], pos.array[i * 3 + 2])
        pts.push(pos.array[(i + 1) * 3], pos.array[(i + 1) * 3 + 1], pos.array[(i + 1) * 3 + 2])
      }
    }
    const filtered = new THREE.BufferGeometry()
    filtered.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
    mesh.add(new THREE.LineSegments(filtered, mat))
  }

  addFaceOutline(coin, geometry, 0.8, 0x00ddff, 0.4)

  // Glowing panel on the left-facing side face (the "top" of the hex after rotation)
  const glowPanelMat = new THREE.MeshBasicMaterial({
    color: 0x88ffff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  })
  const panelGeom = new THREE.PlaneGeometry(0.8, 2)
  const glowPanel = new THREE.Mesh(panelGeom, glowPanelMat)
  // Face center in geometry space: (-1.732, 0, 0)
  // After rotation.x = -PI/2: (-1.732, 0, 0) - z=0 stays
  // Rotate plane normal (0,0,1) → (-1,0,0) to face left
  glowPanel.position.set(-1.732, 0, 0)
  glowPanel.rotation.y = Math.PI / 2
  coin.add(glowPanel)

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
      intensity: { value: 0.1 },
      baseAlpha: { value: 0.15 },
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
    emissiveIntensity: 0.1,
    alphaMap: alphaTexture,
    transparent: true,
    opacity: 0.15,
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

  // Glowing inner hex ring on the face (creates a ridge around the chart)
  const ringShape = new THREE.Shape()
  addRoundedHex(ringShape, 1.7, 0.06)
  ringShape.closePath()
  const holePath = new THREE.Path()
  addRoundedHex(holePath, 1.3, 0.06, true)
  ringShape.holes.push(holePath)
  const ringGeom = new THREE.ExtrudeGeometry(ringShape, { depth: 0.06, bevelEnabled: false })
  ringGeom.center()
  const ringMat = new THREE.MeshPhysicalMaterial({
    color: 0x00ddff,
    emissive: 0x00ddff,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.5,
    metalness: 0.3,
    roughness: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ringMesh = new THREE.Mesh(ringGeom, ringMat)
  ringMesh.position.z = 0.35
  coin.add(ringMesh)

  // Create a rounded rectangle shape
  function createRoundedRectShape(w: number, h: number, cr: number) {
    const shape = new THREE.Shape()
    const hw = w / 2
    const hh = h / 2
    shape.moveTo(-hw + cr, -hh)
    shape.lineTo(hw - cr, -hh)
    shape.quadraticCurveTo(hw, -hh, hw, -hh + cr)
    shape.lineTo(hw, hh - cr)
    shape.quadraticCurveTo(hw, hh, hw - cr, hh)
    shape.lineTo(-hw + cr, hh)
    shape.quadraticCurveTo(-hw, hh, -hw, hh - cr)
    shape.lineTo(-hw, -hh + cr)
    shape.quadraticCurveTo(-hw, -hh, -hw + cr, -hh)
    shape.closePath()
    return shape
  }

  // 4 extruded rectangles scattered around the coin

  const baseY = 1

  const rectMeta = [
    { icon: 'ph-magnifying-glass', label: 'Market Scan' },
    { icon: 'ph-brain', label: 'Decision' },
    { icon: 'ph-lightning', label: 'Execute Trade' },
    { icon: 'ph-shield-check', label: 'On-chain Record' },
  ]

  const rectPositions = [
    { x: -2.6, y: 3.5, z: 0 },
    { x: 3.4, y: 3.5, z: 0 },
    { x: -2.6, y: -1.5, z: 0 },
    { x: 3.4, y: -1.5, z: 0 },
  ]

  const rectAnims = rectPositions.map((_, i) => ({
    phase: i * Math.PI * 0.5,
    speed: 0.9 + (i % 2) * 0.3,
    amplitude: 0.08 + (i % 3) * 0.02,
  }))

  const rectMeshes: THREE.Mesh[] = []

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x00ddff,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
  })

  const lineCurves: {
    line: THREE.Line
    geom: THREE.BufferGeometry
    numPoints: number
    pts: THREE.Vector3[]
    rx: number
    toCenterY: number
    cx: number
  }[] = []

  for (let i = 0; i < rectPositions.length; i++) {
    const pos = rectPositions[i]

    // Rect mesh
    const rectGeom = new THREE.ExtrudeGeometry(
      createRoundedRectShape(1, 1, 0.08),
      { depth: 0.15, bevelEnabled: false }
    )
    rectGeom.center()
    const mesh = new THREE.Mesh(rectGeom, coinMat)
    mesh.position.set(pos.x, pos.y, pos.z)
    scene.add(mesh)
    rectMeshes.push(mesh)
    addFaceOutline(mesh, rectGeom, 0.15, 0x00ddff, 0.5)

    // CSS2D label attached to rect mesh
    const div = document.createElement('div')
    div.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;'

    const icon = document.createElement('i')
    icon.className = 'ph ' + rectMeta[i].icon
    icon.style.cssText = 'font-size:24px;color:#00d4ff;'

    const label = document.createElement('span')
    label.textContent = rectMeta[i].label
    label.style.cssText = 'font-size:11px;font-weight:500;color:#8892a4;letter-spacing:0.5px;white-space:nowrap;font-family:Inter,sans-serif;'

    div.appendChild(icon)
    div.appendChild(label)

    const labelObj = new CSS2DObject(div)
    labelObj.position.set(0, 0, 0.15)
    mesh.add(labelObj)

    // Curved connecting line
    const rx = pos.x
    const ry = pos.y
    const cx = 0.4
    const numPoints = 40

    const toCenter = new THREE.Vector2(0.5 - rx, 0.5 - ry).normalize().multiplyScalar(1.5)

    const pts = [
      new THREE.Vector3(rx, ry, 0),
      new THREE.Vector3(
        rx + (cx - rx) * 0.33 + toCenter.x,
        ry + (baseY - ry) * 0.33 + toCenter.y,
        0
      ),
      new THREE.Vector3(
        rx + (cx - rx) * 0.66 + toCenter.x,
        ry + (baseY - ry) * 0.66 + toCenter.y,
        0
      ),
      new THREE.Vector3(cx, baseY, 0),
    ]

    const positions = new Float32Array(numPoints * 3)
    const lineGeom = new THREE.BufferGeometry()
    lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const curve = new THREE.CatmullRomCurve3(pts)
    const curvePts = curve.getPoints(numPoints)
    for (let j = 0; j < numPoints; j++) {
      positions[j * 3] = curvePts[j].x
      positions[j * 3 + 1] = curvePts[j].y
      positions[j * 3 + 2] = curvePts[j].z
    }

    const line = new THREE.Line(lineGeom, lineMat)
    scene.add(line)
    lineCurves.push({ line, geom: lineGeom, numPoints, pts, rx, toCenterY: toCenter.y, cx })
  }

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

  // Top spotlight: bright center on top triangular walls, penumbra fade on adjacent walls
  const topSpotTarget = new THREE.Object3D()
  topSpotTarget.position.set(0.4, 1, 0)
  scene.add(topSpotTarget)
  const topSpot = new THREE.SpotLight(0x00ddff, 500)
  topSpot.position.set(0.4, 4, -2)
  topSpot.target = topSpotTarget
  topSpot.angle = 1.4
  topSpot.penumbra = 0.4
  topSpot.decay = 1
  topSpot.distance = 8
  scene.add(topSpot)
  
  // Levitate animation
  let animFrame: number
  let t = 0

  function tick() {
    t += 0.02
    const cy = baseY + Math.sin(t * 1.2) * 0.15
    coin.position.y = cy

    for (let i = 0; i < rectMeshes.length; i++) {
      const anim = rectAnims[i]
      rectMeshes[i].position.y = rectPositions[i].y + Math.sin(t * anim.speed + anim.phase) * anim.amplitude
    }

    for (let i = 0; i < lineCurves.length; i++) {
      const lc = lineCurves[i]
      const rectY = rectMeshes[i].position.y

      lc.pts[0].y = rectY
      lc.pts[1].y = rectY + (cy - rectY) * 0.33 + lc.toCenterY
      lc.pts[2].y = rectY + (cy - rectY) * 0.66 + lc.toCenterY
      lc.pts[3].y = cy

      const curve = new THREE.CatmullRomCurve3(lc.pts)
      const curvePts = curve.getPoints(lc.numPoints)
      const posArr = lc.geom.attributes.position.array as Float32Array
      for (let j = 0; j < lc.numPoints; j++) {
        posArr[j * 3] = curvePts[j].x
        posArr[j * 3 + 1] = curvePts[j].y
        posArr[j * 3 + 2] = curvePts[j].z
      }
      lc.geom.attributes.position.needsUpdate = true
    }

    platform.position.y = -2 + Math.sin(t * 0.8) * 0.05

    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
    animFrame = requestAnimationFrame(tick)
  }
  tick()

  // Handle resize
  const onResize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    const aspect = width / height
    renderer.setSize(width, height)
    labelRenderer.setSize(width, height)
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
      cancelAnimationFrame(animFrame)
      lineMat.dispose()
      for (const lc of lineCurves) {
        lc.geom.dispose()
      }
      labelRenderer.domElement.remove()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    },
  }
}
