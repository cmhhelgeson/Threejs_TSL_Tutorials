import * as THREE from 'three';
import { modelViewProjection, timerLocal, uniform, cameraViewMatrix, temp, storage, If, positionGeometry, float, tslFn, vec3, vec4, rotate, PI2, sin, cos, instanceIndex, uv, positionLocal, negate, abs } from 'three/tsl';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import GUI from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer;
let computeParticle;
let params;

function init() {

	// Since we need the WebGPURenderer to perform some calculations, we go against convention by initializing the renderer first.
	renderer = new THREE.WebGPURenderer({ antialias: false })
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	document.body.appendChild( renderer.domElement );

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.z = 15;

	const geometry = new THREE.SphereGeometry(0.1, 10, 10);
	const material = new THREE.MeshStandardNodeMaterial( { color: "red" });

	// Define necessary values for compute calculation
	const numParticles = 10000;
	// Bounds are from [ -10, 10 ] in all directions
	const maxBoundSize = 10;
	const uBoundsX = uniform( maxBoundSize );
	const uBoundsY = uniform( maxBoundSize );
	const uBoundsZ = uniform( maxBoundSize );

	const positionArray = new Float32Array( numParticles * 3 );
	const velocityArray = new Float32Array( numParticles * 3);


	// Two ways to initialize the values of a storage buffer
	// 1. Directly access the array ( good for populating buffers with randomized data, as seen below )
	for ( let i = 0; i < numParticles * 3; i += 3 ) {

		// Assign each component of velocity within range of [ -3, 3 ]
		const x = Math.random() * 2 - 1;
		const y = Math.random() * 2 - 1;
		const z = Math.random() * 2 - 1;

		positionArray[ i ] = 0;
		positionArray[ i + 1] = 0;
		positionArray[ i + 2] = 0;

		velocityArray[ i ] = x;
		velocityArray[ i + 1 ] = y;
		velocityArray[ i + 2 ] = z;

	}

	// Position of each particle
	const positionBufferAttribute = new THREE.StorageInstancedBufferAttribute( positionArray, 3 );
	// Velocity of each particle
	const velocityBufferAttribute = new THREE.StorageInstancedBufferAttribute( velocityArray, 3 );


	// Pass buffer attributes as arguments to a new StorageBufferNode.
	// Storage buffer nodes allow us to access buffer attribute data within our compute shader.
	const positionStorage = storage( positionBufferAttribute, 'vec3', positionBufferAttribute.count );
	const velocityStorage = storage( velocityBufferAttribute , 'vec3', velocityBufferAttribute.count );

	const positionInitFn = tslFn(() => {
		
		// Initialize all particles at position ( 0, 0, 0 )
		positionStorage.element( instanceIndex ).assign( vec3( 0, 0, 0 ) );
		
	})

	const positionInit = positionInitFn().compute( numParticles );
	renderer.compute( positionInit );

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

	computeParticle = computeParticleFn().compute( numParticles );

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
	const wireframeMaterial = new THREE.MeshBasicNodeMaterial({color: 0xffffff});
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

	const positionStorageBufferAttribute = new THREE.StorageBufferAttribute( 
		positionBaseAttribute.array, 
		positionBaseAttribute.itemSize 
	);

	console.log(positionStorageBufferAttribute)

	boundsHelper.geometry.setAttribute( 'position', positionStorageBufferAttribute );

	boundsHelper.material = new THREE.LineBasicNodeMaterial({
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

	const updateBoxHelper = () => {

		boundsHelper.scale.set(5, uBoundsY.value, uBoundsZ.value);

	}

	const gui = new GUI();
	gui.add( uBoundsX, 'value', 5, 10, 0.1 ).name( 'Bounds X' ).onChange( updateBoxHelper );
	gui.add( uBoundsY, 'value', 5, 10, 0.1 ).name( 'Bounds Y' );
	gui.add( uBoundsZ, 'value', 5, 10, 0.1 ).name( 'Bounds Z' );

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {
	
	renderer.compute( computeParticle );

	renderer.render( scene, camera );

}

init();