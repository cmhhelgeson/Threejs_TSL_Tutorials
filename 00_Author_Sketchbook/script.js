import * as THREE from 'three';
import { positionGeometry, cameraProjectionMatrix, modelViewMatrix, storage, attribute, float, timerLocal, uniform, tslFn, vec3, vec4, rotate, PI2, sin, cos, instanceIndex, negate, texture, uv, vec2, positionLocal } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import GUI from 'three/addons/libs/lil-gui.module.min.js';


let camera, scene, renderer;
let mesh;

function init() {

	// Create a PerspectiveCamera with an FOV of 70.
	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
	// Set the camera back so it's position does not intersect with the center of the cube mesh
	camera.position.z = 2;

	scene = new THREE.Scene();

	const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
	directionalLight.position.set(5, 3, 3.5);
	scene.add(directionalLight);

	const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
	fillLight.position.set(-5, 3, 3.5);
	scene.add(fillLight);

 	// Access texture via the relative path to the texture's file.
	const crateTexture = new THREE.TextureLoader().load( 'textures/crate.gif' );
	crateTexture.colorSpace = THREE.SRGBColorSpace;
	crateTexture.wrapS = THREE.RepeatWrapping;
	crateTexture.wrapT = THREE.RepeatWrapping;

	// Unlike the old shader system, uniforms only have to be defined once, 
  // and then can be used anywhere as they are.
  const effectController = {
    // uniform() function creates a UniformNode
    uCircleRadius: uniform( 1.0 ),
    uCircleSpeed: uniform( 0.5 ),
    uSeparationStart: uniform( 1.0 ),
    uSeparationEnd: uniform( 2.0 ),
    uCircleBounce: uniform( 0.02 ),
  };

	const instanceCount = 80;
	const numCircles = 4;
	const meshesPerCircle = instanceCount / numCircles;

	// Apply a texture map to the material.
 	const material = new THREE.MeshStandardNodeMaterial();

	/*material.positionNode = tslFn(() => {

		// Within a positionNode, acts as the position of the vertex in world space.
  	const position = positionLocal;

  	// Oscillate back and forth along the x-axis
  	const moveX = sin( timerLocal() );

		// Equivalent of mesh.position.x += Math.sin(time) in plain Javascript
  	position.x.addAssign( moveX );

		return positionLocal;

	})(); */

	material.vertexNode = tslFn(() => {

		const position = positionLocal;

		position.x.addAssign( sin( timerLocal() ) );

		return cameraProjectionMatrix.mul( modelViewMatrix ).mul( position );

	})();
	material.colorNode = texture( crateTexture, uv().add( vec2( timerLocal(), negate( timerLocal()) ) ));

	// Define the geometry of our mesh
	const geometry = new THREE.BoxGeometry( 0.1 , 0.1 , 0.1 );

 	// Create a mesh with the specified geometry and material
 	mesh = new THREE.InstancedMesh( geometry, material, instanceCount );
 	scene.add( mesh );

 	// Create a renderer and set it's animation loop.
 	renderer = new THREE.WebGPURenderer({ antialias: false })
 	renderer.setPixelRatio( window.devicePixelRatio );
 	renderer.setSize( window.innerWidth, window.innerHeight );
 	renderer.setAnimationLoop( animate );
 	document.body.appendChild( renderer.domElement );

 	const controls = new OrbitControls( camera, renderer.domElement );
 	controls.minDistance = 1;
 	controls.maxDistance = 20;

 	// Define the application's behavior upon window resize.
 	window.addEventListener( 'resize', onWindowResize );

	const gui = new GUI();
	gui.add( effectController.uCircleRadius, 'value', 0.1, 3.0, 0.1 ).name( 'Circle Radius' );
	gui.add( effectController.uCircleSpeed, 'value', 0.1, 3.0, 0.1 ).name( 'Circle Speed' );
	gui.add( effectController.uSeparationStart, 'value', 0.5, 4, 0.1 ).name( 'Separation Start' );
	gui.add( effectController.uSeparationEnd, 'value', 1.0, 5.0, 0.1 ).name( 'Separation End' );
	gui.add( effectController.uCircleBounce, 'value', 0.01, 0.2, 0.001 ).name( 'Circle Bounce' );

}

function onWindowResize() {

	// Update the camera's aspect ratio and the renderer's size to reflect
 	// the new screen dimensions.
 	camera.aspect = window.innerWidth / window.innerHeight;
 	camera.updateProjectionMatrix();
 	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {
	// Render one frame
 	renderer.render( scene, camera );

}

init();