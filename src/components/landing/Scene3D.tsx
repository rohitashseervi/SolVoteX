import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Scene3D() {
  const mountRef = useRef(null);

  useEffect(() => {
    const W = window.innerWidth, H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 300);
    camera.position.set(0, 0, 40);

    const blobVert = `
      uniform float uTime;
      uniform float uFreq;
      uniform float uAmp;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normal;
        vec3 d = vec3(
          sin(position.x * uFreq + uTime) * cos(position.y * uFreq * 0.9),
          sin(position.y * uFreq + uTime * 0.8) * cos(position.z * uFreq * 1.1),
          sin(position.z * uFreq * 1.2 + uTime * 1.2) * cos(position.x * uFreq * 0.7)
        );
        vec3 displaced = position + normal * dot(d, vec3(1.0)) * uAmp;
        vPos = displaced;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `;
    const blobFrag = `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
        rim = pow(rim, 1.8);
        vec3 col = mix(uColor1, uColor2, rim);
        float core = smoothstep(0.6, 0.0, length(vPos) * 0.06);
        col = mix(col, uColor2 * 1.6, core * 0.4);
        gl_FragColor = vec4(col, (rim * 0.75 + core * 0.25) * uOpacity);
      }
    `;

    const BLOBS = [
      { pos:[  6,  4,  0], r:14, freq:0.42, amp:1.9, speed:0.18, c1:[1.0, 0.60, 0.12], c2:[1.0, 0.38, 0.06], op:0.62 },
      { pos:[-10, -5,  4], r:12, freq:0.38, amp:1.6, speed:0.14, c1:[0.05, 0.68, 0.10], c2:[0.02, 0.45, 0.06], op:0.55 },
      { pos:[  2, -8, -5], r:10, freq:0.50, amp:1.4, speed:0.22, c1:[0.12, 0.22, 0.88], c2:[0.04, 0.45, 1.00], op:0.50 },
      { pos:[ -6,  9, -3], r: 9, freq:0.35, amp:1.2, speed:0.10, c1:[1.0, 0.85, 0.18], c2:[1.0, 0.55, 0.10], op:0.40 },
      { pos:[ 14, -3,  2], r: 8, freq:0.55, amp:1.0, speed:0.26, c1:[0.00, 0.75, 0.65], c2:[0.05, 0.38, 0.55], op:0.38 },
    ];

    const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';

    const blobs = BLOBS.map(cfg => {
      const light = isLight();
      const geo = new THREE.SphereGeometry(cfg.r, 64, 64);
      const mat = new THREE.ShaderMaterial({
        vertexShader: blobVert, fragmentShader: blobFrag,
        uniforms: {
          uTime:    { value: 0 }, uFreq: { value: cfg.freq }, uAmp: { value: cfg.amp },
          uOpacity: { value: light ? cfg.op * 0.55 : cfg.op },
          uColor1:  { value: new THREE.Color(...cfg.c1) },
          uColor2:  { value: new THREE.Color(...cfg.c2) },
        },
        transparent: true, depthWrite: false,
        blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...cfg.pos);
      mesh.userData = { speed: cfg.speed, ox: cfg.pos[0], oy: cfg.pos[1] };
      scene.add(mesh);
      return mesh;
    });

    const N = 800;
    const pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3);
    const pal = [[1,0.6,0.1],[0.1,0.7,0.1],[0.2,0.3,0.9],[1,0.85,0.2]];
    for (let i = 0; i < N; i++) {
      pPos[i*3]=(Math.random()-0.5)*100; pPos[i*3+1]=(Math.random()-0.5)*60; pPos[i*3+2]=(Math.random()-0.5)*50-10;
      const c=pal[Math.floor(Math.random()*4)]; pCol[i*3]=c[0]; pCol[i*3+1]=c[1]; pCol[i*3+2]=c[2];
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size:0.18, vertexColors:true, transparent:true, opacity:0.55, depthWrite:false, blending:THREE.AdditiveBlending })));

    const mouse = { x:0, y:0 };
    const onMouse = e => { mouse.x=(e.clientX/W-0.5)*2; mouse.y=-(e.clientY/H-0.5)*2; };
    window.addEventListener('mousemove', onMouse);
    const onResize = () => { const w=window.innerWidth,h=window.innerHeight; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h); };
    window.addEventListener('resize', onResize);

    let raf;
    const tick = t => {
      raf = requestAnimationFrame(tick);
      const e = t * 0.001;
      blobs.forEach((m, i) => {
        m.material.uniforms.uTime.value = e * m.userData.speed * 2.2;
        m.position.x = m.userData.ox + Math.sin(e * m.userData.speed + i) * 3.5;
        m.position.y = m.userData.oy + Math.cos(e * m.userData.speed * 0.7 + i * 1.2) * 2.5;
        m.rotation.y = e * m.userData.speed * 0.3;
        m.rotation.z = e * m.userData.speed * 0.2;
      });
      camera.position.x += (mouse.x * 3 - camera.position.x) * 0.035;
      camera.position.y += (mouse.y * 2 - camera.position.y) * 0.035;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="scene-mount"/>;
}