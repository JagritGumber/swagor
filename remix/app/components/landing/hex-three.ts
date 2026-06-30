import * as THREE from 'three'

export function createHexCoin(container: HTMLElement) {
  const scene = new THREE.Scene()
  
  const aspect = 1
  const frustumSize = 4
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
  const radius = 1
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
  coin.position.y = 1.5
  coin.castShadow = true
  
  scene.add(coin)
  
  // Platform
  const platformGeometry = new THREE.BoxGeometry(4, 0.2, 4)
  const platformMaterial = new THREE.MeshPhongMaterial({
    color: 0x0a1018,
    emissive: 0x050810,
    emissiveIntensity: 0.1,
    shininess: 50,
  })
  const platform = new THREE.Mesh(platformGeometry, platformMaterial)
  platform.position.y = 0
  platform.receiveShadow = true
  
  scene.add(platform)
  
  // Edge glow
  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.6,
  })
  const wireframe = new THREE.LineSegments(edges, lineMaterial)
  coin.add(wireframe)
  
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0x00d4ff, 0.8)
  directionalLight.position.set(5, 5, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 1024
  directionalLight.shadow.mapSize.height = 1024
  scene.add(directionalLight)
  
  const backLight = new THREE.DirectionalLight(0x0066cc, 0.3)
  backLight.position.set(-5, -3, -5)
  scene.add(backLight)
  
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
