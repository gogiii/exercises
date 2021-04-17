import * as THREE from "../lib/three.module.js";
import { GLTFLoader } from "../lib/GLTFLoader.js";
import { OrbitControls } from '../lib/OrbitControls.js';

const fullurl = new URL("../assets/full2.gltf", import.meta.url).pathname;
const envurl = new URL("../assets/1.jpg", import.meta.url).pathname;

// wrap gltf loading as async function

const loader = new GLTFLoader();
async function loadModel(url) {
    const promise = new Promise((resolve, reject)=>{
        loader.load(url, function(gltf) {
            resolve(gltf);
        }, null, (err)=>reject(err));
    });
    return promise;
}

const textureLoader = new THREE.TextureLoader();
async function loadTexture(url) {
    const promise = new Promise((resolve, reject)=>{
        textureLoader.load(url, function(texture) {
            resolve(texture);
        }, null, (err)=>reject(err));
    });
    return promise;
}

async function init() {
    const canvas = document.querySelector("canvas");
    if(!canvas) {
        console.error("no canvas found.");
        return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera( 45, canvas.width / canvas.height, 0.1, 1000 );
    const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
    renderer.setClearColor("lightgray");
    renderer.setSize(canvas.width, canvas.height);

    window.onresize = function(e) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.onresize();

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // initial camera position
    camera.position.set(5, 3, 0);

    // setup controls
    const controls = new OrbitControls(camera, canvas);
    controls.autoRotate = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 15;
    controls.minPolarAngle = Math.PI/6;
    controls.maxPolarAngle = Math.PI/2;
    controls.autoRotateSpeed = 3;
    controls.target.set(0,0,0);
    
    //const light = new THREE.AmbientLight( 0x404040 );
    //scene.add( light );

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.castShadow = true;
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
    
    /*let ring = await loadModel(ringurl);
    ring.scene.position.y += 1;
    ring.scene.castShadow = true;
    ring.scene.children[0].castShadow = true;
    scene.add(ring.scene);

    let podium = await loadModel(podiumurl);
    podium.scene.receiveShadow  = true;
    podium.scene.children[0].receiveShadow = true;
    podium.scene.position.y -= 3;
    podium.scene.scale.set(2,2,2);
    scene.add(podium.scene);*/

    let full = await loadModel(fullurl);
    full.scene.receiveShadow  = true;
    full.scene.children.forEach((o) => {
        //o.receiveShadow = true;
        o.castShadow = true;
    });
    full.scene.position.y -= 3;
    scene.add(full.scene);
    
    // simple cube
    //const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    //const cube = new THREE.Mesh(new THREE.BoxGeometry(), material);
    //scene.add( cube );

    // simple plane
    /*const planeMaterial = new THREE.MeshPhongMaterial( { color: 0xffb851 } );
    const ground = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), planeMaterial );
    ground.position.set( 0, -3, 0 );
    ground.rotation.x = - Math.PI / 2;
    ground.scale.set( 100, 100, 100 );
    ground.castShadow = false;
    ground.receiveShadow = true;
    scene.add( ground );*/

    // environment for pbr
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const tex = await loadTexture(envurl);
    const envMap = pmremGenerator.fromEquirectangular(tex).texture;
    scene.background = envMap;
    scene.environment = envMap;
    
    function animate() {
        requestAnimationFrame( animate );
        controls.update();
	    renderer.render(scene, camera);
    }

    animate();
}

init();