import * as THREE from 'three'

export function createHexCoin(container: HTMLElement) {
  const scene = new THREE.Scene()
  
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
  camera.position.set(-4, 1.8, 3)
  camera.lookAt(0, 0, 0)
  
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)
  
  // Hexagonal prism (coin)
  const geometry = new THREE.CylinderGeometry(1, 1, 0.2, 6)
  const material = new THREE.MeshPhongMaterial({
    color: 0x0d2535,
    emissive: 0x1e4050,
    emissiveIntensity: 0.3,
    shininess: 100,
  })
  const coin = new THREE.Mesh(geometry, material)
  
  // Rotate to show hex face on left
  coin.rotation.x = -0.5
  coin.rotation.y = 2.5
  
  scene.add(coin)
  
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
  scene.add(directionalLight)
  
  const backLight = new THREE.DirectionalLight(0x0066cc, 0.3)
  backLight.position.set(-5, -3, -5)
  scene.add(backLight)
  
  // Animation loop
  let animating = true
  
  function animate() {
    if (!animating) return
    requestAnimationFrame(animate)
    coin.rotation.y += 0.003
    renderer.render(scene, camera)
  }
  
  animate()
  
  // Handle resize
  const onResize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  
  window.addEventListener('resize', onResize)
  
  return {
    destroy() {
      animating = false
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    },
  }
}
