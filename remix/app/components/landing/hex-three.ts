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
  
  // Platform - simple box
  const platformGeometry = new THREE.BoxGeometry(3, 0.3, 3)
  const platformMaterial = new THREE.MeshPhongMaterial({
    color: 0x0d1b2a,
    emissive: 0x060f18,
    emissiveIntensity: 0.1,
    shininess: 20,
    specular: 0x1a3050,
  })
  const platform = new THREE.Mesh(platformGeometry, platformMaterial)
  platform.position.y = -1
  platform.receiveShadow = true
  
  // Rounded edges on 4 sides
  const edgeGeometry = new THREE.CylinderGeometry(0.08, 0.08, 3, 8)
  const edgeMaterial = new THREE.MeshPhongMaterial({
    color: 0x1a3050,
    emissive: 0x0a1828,
    emissiveIntensity: 0.2,
    shininess: 40,
  })
  
  // 4 side edges
  const platformEdges = [
    { pos: [0, -1, 1.5] as const, rot: [0, 0, Math.PI / 2] as const },
    { pos: [0, -1, -1.5] as const, rot: [0, 0, Math.PI / 2] as const },
    { pos: [1.5, -1, 0] as const, rot: [Math.PI / 2, 0, 0] as const },
    { pos: [-1.5, -1, 0] as const, rot: [Math.PI / 2, 0, 0] as const },
  ]
  
  platformEdges.forEach(({ pos, rot }) => {
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial)
    edge.position.set(pos[0], pos[1], pos[2])
    edge.rotation.set(rot[0], rot[1], rot[2])
    edge.castShadow = true
    scene.add(edge)
  })
  
  scene.add(platform)
  
  scene.add(platform)
  
  // Edge glow
  const hexEdges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.6,
  })
  const wireframe = new THREE.LineSegments(hexEdges, lineMaterial)
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
