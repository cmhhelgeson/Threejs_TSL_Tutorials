import * as THREE from 'three';
// NOTE: WebGPU Build is forthcoming
import WebGPURenderer from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
import { MeshBasicNodeMaterial, modelViewProjection, timerLocal, uniform, cameraViewMatrix, temp, MeshStandardNodeMaterial } from 'three/examples/jsm/nodes/Nodes.js';
import { positionGeometry, float, tslFn, abs, vec3, vec4, rotate, PI2, sin, cos, instanceIndex, uv } from 'three/examples/jsm/nodes/Nodes.js';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';

let camera, scene, renderer;
let mesh;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.z = 15;

	scene = new THREE.Scene();

	const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);

	const texture = new THREE.TextureLoader().load( 'textures/crate.gif' );
	texture.colorSpace = THREE.SRGBColorSpace;

	// 1. Standard Three.js Material: const material = new THREE.MeshBasicMaterial( { map: texture } );
	// 2: Basic Three.js Node Material: const material = new MeshBasicNodeMaterial( { map: texture } );
	// 3. Three.js Node Material which accounts for lighting
	const material = new MeshStandardNodeMaterial( {map: texture});


	const uCircleRadius = uniform(1.0);
	const uCircleSpeed = uniform( 0.5 );
	const size = uniform(20);
	const instanceCount = 80;
	const numCircles = 4;
	const meshesPerCirlce = instanceCount / numCircles;

	material.positionNode = tslFn(() => {
		const time = timerLocal().mul( uCircleSpeed );

		const instanceWithinCircle = instanceIndex.remainder(meshesPerCirlce);

		const circleIndex = instanceIndex.div(meshesPerCirlce).add(1);

		const circleRadius = uCircleRadius.mul(circleIndex);

		// Normalize instanceIndex to range [0, 2*PI]
		const angle = float(instanceWithinCircle).div(meshesPerCirlce).mul(PI2).add( time ); 
		const circleX = sin( angle ).mul( circleRadius );
		const circleY = cos( angle ).mul( circleRadius );

		const scalePosition = positionGeometry.mul( circleIndex );
		

		const rotatePosition = rotate(scalePosition, vec3( timerLocal() , timerLocal(), 0.0));


		const newPosition = rotatePosition.add( vec3( circleX, circleY, 0.0 ));
		return vec4( newPosition, 1.0 );
	})(); 

	console.log(geometry)

	//material.fragmentNode = uv();
	material.colorNode = uv();

	console.log(material.outputNode)
	
	mesh = new THREE.InstancedMesh( geometry, material, instanceCount);
	scene.add( mesh );

	const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(5, 3, -7.5);
	scene.add(directionalLight);
	//renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer = new WebGPURenderer({ antialias: false })
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	document.body.appendChild( renderer.domElement );
	//
	
	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 1;
	controls.maxDistance = 20;

	const gui = new GUI();
	gui.add( uCircleRadius, 'value', 0.1, 3.0, 0.1 ).name( 'Circle Radius' );
	gui.add( uCircleSpeed, 'value', 0.1, 3.0, 0.1 ).name( 'Circle Speed' );

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {
	
	//mesh.rotation.y += 0.01;

	renderer.render( scene, camera );

}