import * as THREE from 'three';
// NOTE: WebGPU Build is forthcoming
import WebGPURenderer from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
import StorageBufferAttribute from 'three/examples/jsm/renderers/common/StorageBufferAttribute.js';
import { MeshBasicNodeMaterial, modelViewProjection, timerLocal, uniform, cameraViewMatrix, temp, MeshStandardNodeMaterial, storage, If, positionGeometry, float, tslFn, vec3, vec4, rotate, PI2, sin, cos, instanceIndex, uv, positionLocal, negate, abs, LineBasicNodeMaterial } from 'three/examples/jsm/nodes/Nodes.js';
import {  } from 'three/examples/jsm/nodes/Nodes.js';
import { LineSegments2, OrbitControls } from 'three/examples/jsm/Addons.js';

import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import StorageInstancedBufferAttribute from 'three/examples/jsm/renderers/common/StorageInstancedBufferAttribute.js';

let camera, scene, renderer;
let computeParticle;
let params;

init();

function init() {

	// Since we need the WebGPURenderer to perform some calculations, we go against convention by initializing the renderer first.
	renderer = new WebGPURenderer({ antialias: false })
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	document.body.appendChild( renderer.domElement );

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.z = 15;

	const geometry = new THREE.SphereGeometry(0.1, 10, 10);
	const material = new MeshStandardNodeMaterial( { color: "red" });

	// Define necessary values for compute calculation
	const numParticles = 200;
	// Bounds are from [ -10, 10 ] in all directions
	const maxBoundSize = 10;
	const uBoundsX = uniform( maxBoundSize );
	const uBoundsY = uniform( maxBoundSize );
	const uBoundsZ = uniform( maxBoundSize );

	// Position of each particle
	const positionBufferAttribute = new StorageInstancedBufferAttribute( numParticles, 3 );
	// Velocity of each particle
	const velocityBufferAttribute = new StorageInstancedBufferAttribute( numParticles, 3 );
	// Scale of each particle
	const scaleBufferAttribute = new StorageInstancedBufferAttribute( numParticles, 1 );

	// Pass buffer attributes as arguments to a new StorageBufferNode.
	// Storage buffer nodes allow us to access buffer attribute data within our compute shader.
	const positionStorage = storage( positionBufferAttribute, 'vec3', numParticles );
	const velocityStorage = storage( velocityBufferAttribute , 'vec3', numParticles );
	const scaleStorage = storage( scaleBufferAttribute, 'float', numParticles );

	const positionInitFn = tslFn(() => {
		
		// Initialize all particles at position ( 0, 0, 0 )
		positionStorage.element( instanceIndex ).assign( vec3( 0, 0, 0 ) );
		
	})

	const positionInit = positionInitFn().compute( numParticles );
	renderer.compute(positionInit);

	console.log(positionBufferAttribute)

	// Two ways to initialize the values of a storage buffer
	// 1. Directly access the array ( good for populating buffers with randomized data, as seen below )
	for ( let i = 0; i < velocityBufferAttribute.array.length; i += 3 ) {

		// Assign each component of velocity within range of [ -3, 3 ]
		const x = Math.random() * .5 - .25;
		const y = Math.random() * .5 - .25;
		const z = Math.random() * .5 - .25;

		const s = Math.random() * 5;

		velocityBufferAttribute.array[ i ] = x;
		velocityBufferAttribute.array[ i + 1 ] = y;
		velocityBufferAttribute.array[ i + 2 ] = z;

		scaleBufferAttribute.array[ i / 3 ] = s;

	}
	// 2. Run an initial compute pass over each value of the array

	const getSign = ( valueNode ) => {
		
		return valueNode.div( abs( valueNode ) );

	}

	const computeParticleFn = tslFn(() => {
		const vel = velocityStorage.element( instanceIndex );
		const pos = positionStorage.element( instanceIndex );
		const newPosX = temp( pos.x.add( vel.x ), 'newPosX' );
		const newPosY = temp( pos.y.add( vel.y ), 'newPosY' );
		const newPosZ = temp( pos.z.add( vel.z ), 'newPosZ' );

		If( abs( newPosX ).greaterThan( uBoundsX ), () => {

			const reverseVel = negate( vel.x );
			const rescuePos = uBoundsX.mul( getSign( newPosX ) );
			newPosX.assign( rescuePos.add( reverseVel ) ) ;
			vel.x.assign( negate(vel.x) );

		})

		If( abs( newPosY ).greaterThan( uBoundsY ), () => {

			const reverseVel = negate( vel.y );
			const rescuePos = uBoundsY.mul( getSign( newPosY ) );
			newPosY.assign( rescuePos.add( reverseVel ) ) ;
			vel.y.assign( reverseVel );

		});

		If( abs( newPosZ ).greaterThan( uBoundsZ ), () => {

			const reverseVel = negate( vel.z );
			const rescuePos = uBoundsZ.mul( getSign( newPosZ ) );
			newPosZ.assign( rescuePos.add( reverseVel ) ) ;
			vel.z.assign( reverseVel );

		});

		pos.assign( vec3( newPosX, newPosY, newPosZ ) );

	});

	computeParticle = computeParticleFn().compute(numParticles);

	/* material.positionNode = tslFn(() => {
		
		const readScale = scaleStorage.toReadOnly();
		const readPos = positionStorage.toReadOnly();

		return positionLocal.mul( readScale ).add( readPos );
	//}) */
	
	material.positionNode = positionLocal.add(positionStorage.toAttribute());
	material.colorNode = tslFn(() => {

		const velocity = velocityStorage.element(instanceIndex)

		return vec3(velocity.x, velocity.y, 0.0);

	})();

	const instancedSphere = new THREE.InstancedMesh( geometry, material, 100 );
	console.log(instancedSphere)
	scene.add( instancedSphere );

	// Add bounds helper
	const boxGeometry = new THREE.BoxGeometry(20, 20, 20);
	const wireframe = new THREE.WireframeGeometry( boxGeometry );
	const wireframeMaterial = new MeshBasicNodeMaterial({color: 0xffffff});
	const line = new LineSegments2( wireframe );
	line.material.depthTest = false;
	line.material.opacity = 0.25;
	line.material.transparent = true;
	const boundsHelper = new THREE.BoxHelper( line, 0xffffff );
	scene.add( boundsHelper );
	console.log( boundsHelper );

	// Existing implementation of bounds helper doesn't use new features like StorageBufferAttributes
	// Needs to be modified
	const positionBaseAttribute = boundsHelper.geometry.attributes.position;

	const positionStorageBufferAttribute = new StorageBufferAttribute( 
		positionBaseAttribute.array, 
		positionBaseAttribute.itemSize 
	);

	console.log(positionStorageBufferAttribute)

	boundsHelper.geometry.setAttribute( 'position', positionStorageBufferAttribute );

	boundsHelper.material = new LineBasicNodeMaterial({
		positionNode: tslFn(() => {
			const size = float(maxBoundSize);
			const ratio = vec3( size.div(uBoundsX), size.div(uBoundsY), size.div(uBoundsZ));
			return positionLocal.div(ratio);
		})()
	});

	const directionalLight = new THREE.DirectionalLight(0xffffff, 20);
	const directionalLight2 = new THREE.DirectionalLight(0xffffff, 20);
	directionalLight.position.set(5, 3, 7);
	directionalLight2.position.set(5, 3, -7);
	scene.add(directionalLight);
	scene.add(directionalLight2);
	//
	
	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 1;
	controls.maxDistance = 40;

	params = {
		pauseSim: false,
	}

	const updateBoxHelper = () => {

		boundsHelper.scale.set(5, uBoundsY.value, uBoundsZ.value);

	}

	const gui = new GUI();
	gui.add( uBoundsX, 'value', 5, 10, 0.1 ).name( 'Bounds X' ).onChange( updateBoxHelper );
	gui.add( uBoundsY, 'value', 5, 10, 0.1 ).name( 'Bounds Y' );
	gui.add( uBoundsZ, 'value', 5, 10, 0.1 ).name( 'Bounds Z' );
	gui.add( params, 'pauseSim' );

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {
	
	if ( !params.pauseSim ) {

		renderer.compute( computeParticle );

	}

	renderer.render( scene, camera );

}