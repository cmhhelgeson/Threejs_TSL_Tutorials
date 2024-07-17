import * as THREE from 'three';
// NOTE: WebGPU Build is forthcoming
import WebGPURenderer from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
import StorageBufferAttribute from 'three/examples/jsm/renderers/common/StorageBufferAttribute.js';
import { MeshBasicNodeMaterial, modelViewProjection, timerLocal, uniform, cameraViewMatrix, temp, MeshStandardNodeMaterial, storage, If } from 'three/examples/jsm/nodes/Nodes.js';
import { positionGeometry, float, tslFn, vec3, vec4, rotate, PI2, sin, cos, instanceIndex, uv } from 'three/examples/jsm/nodes/Nodes.js';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import StorageInstancedBufferAttribute from 'three/examples/jsm/renderers/common/StorageInstancedBufferAttribute.js';

let camera, scene, renderer;
let mesh;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.z = 15;

	scene = new THREE.Scene();

	const geometry = new THREE.SphereGeometry(0.1, 0.1, 0.1);
	const material = new MeshBasicNodeMaterial( { color: "red" });

	const texture = new THREE.TextureLoader().load( 'textures/crate.gif' );
	texture.colorSpace = THREE.SRGBColorSpace;

	const numParticles = 200;
	const uBoundsX = uniform(10);
	const uBoundsY = uniform(10);
	const uBoundsZ = uniform(10);

	const instancedSphere = new THREE.InstancedMesh( geometry, material );

	// Position of each particle
	const positionBufferAttribute = new StorageInstancedBufferAttribute( numParticles, 3 );
	// Velocity of each particle
	const velocityBufferAttribute = new StorageInstancedBufferAttribute( numParticles, 3 );
	// Scale of each particle
	const scaleBufferAttribute = new StorageInstancedBufferAttribute( numParticles, 1 );

	const positionStorage = storage( positionBufferAttribute, 'vec3', numParticles );
	const velocityStorage = storage( velocityBufferAttribute , 'vec3', numParticles );
	const scaleStorage = storage( scaleBufferAttribute, 'float', numParticles );

	// Two ways to initialize the values of a storage buffer
	// 1. Directly access the array ( good for populating buffers with randomized data, as seen below )
	// 2. Write a computeInit function ( good for quickly populating buffers with large amounts of pre-calculated data )
	for ( let i = 0; i < velocityBuffer.array.length; i += 3 ) {

		// Assign each component of velocity within range of [ -3, 3 ]
		const x = Math.random() * 6 - 3;
		const y = Math.random() * 6 - 3;
		const z = Math.random() * 6 - 3;

		const s = Math.random() * 5;

		velocityBufferAttribute.array[ i ] = x;
		velocityBufferAttribute.array[ i + 1 ] = y;
		velocityBufferAttribute.array[ i + 2 ] = z;

		scaleBufferAttribute.array[ i / 3 ] = s;

	}
	// 2. Run an initial compute pass over each value of the array

	const computeParticleFn = tslFn(() => {
		const vel = velocityStorage.element( instanceIndex );
		const pos = positionStorage.element( instanceIndex );
		const newPosX = pos.x.add( vel.x );
		const newPosY = pos.y.add( vel.y );
		const newPosZ = pos.z.add( vel.z );

		If( newPosX.lessThan( negate(uBoundsX) ).or( newPosX.greaterThan( uBoundX ) ), () => {

			const reverseVel = negate( vel.x );
			newPosX.assign( pos.x.add( reverseVel ) ) ;
			vel.x.assign( reverseVel );

		})

		If( newPosY.lessThan( negate(uBoundsY) ).or( newPosY.greaterThan( uBoundY ) ), () => {

			const reverseVel = negate( vel.y );
			newPosY.assign( pos.y.add( reverseVel ) ) ;
			vel.y.assign( reverseVel );

		});

		If( newPosZ.lessThan( negate(uBoundsZ) ).or( newPosZ.greaterThan( uBoundZ ) ), () => {

			const reverseVel = negate( vel.z );
			newPosZ.assign( pos.z.add( reverseVel ) ) ;
			vel.z.assign( reverseVel );

		});

		position.assign( vec3( newPosX, newPosY, newPosZ ) );

	});

	const computeParticle = computeParticleFn().compute(numParticles);

	/* material.positionNode = tslFn(() => {
		
		const readScale = scaleStorage.toReadOnly();
		const readPos = positionStorage.toReadOnly();

		return positionLocal.mul( readScale ).add( readPos );
	//}) */
	
	material.positionNode = positionLocal.add(scaleStorage.toAttribute()).add(positionStorage.toAttribute());

	
	mesh = new THREE.InstancedMesh( geometry, material, numParticles );
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
	gui.add( uBoundX, 'value', 5, 10, 0.1 ).name( 'Bounds X' );
	gui.add( uBoundsY, 'value', 5, 10, 0.1 ).name( 'Bounds Y' );
	gui.add( uBoundZ, 'value', 5, 10, 0.1 ).name( 'Bounds Z' );

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