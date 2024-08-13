import * as THREE from 'three';
import { positionGeometry, storage, attribute, float, timerLocal, uniform, tslFn, vec3, vec4, rotate, PI2, sin, cos, instanceIndex, negate } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import GUI from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, computeColor;
let mesh;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.z = 15;

	scene = new THREE.Scene();

	const geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );

	const texture = new THREE.TextureLoader().load( 'textures/crate.gif' );
	texture.colorSpace = THREE.SRGBColorSpace;

	// 1. Standard Three.js Material: const material = new THREE.MeshBasicMaterial( { map: texture } );
	// 2: Basic Three.js Node Material: const material = new MeshBasicNodeMaterial( { map: texture } );
	// 3. Three.js Node Material which accounts for lighting new MeshStandardNodeMaterial( { map: texture } );
	const material = new THREE.MeshBasicNodeMaterial( { map: texture } );

	const effectController = {
		uCircleRadius: uniform( 1.0 ),
		uCircleSpeed: uniform( 0.5 ),
		uSeparationStart: uniform( 1.0 ),
		uSeparationEnd: uniform( 2.0 ),
		uCircleBounce: uniform( 0.02 ),
	};

	const instanceCount = 80;
	const numCircles = 4;
	const meshesPerCircle = instanceCount / numCircles;

	const instanceColorArray = new Float32Array( instanceCount * 4 );
	for ( let i = 0; i < instanceColorArray.length; i ++ ) {

		instanceColorArray[ i * 4 + 0 ] = Math.random();
		instanceColorArray[ i * 4 + 1 ] = Math.random();
		instanceColorArray[ i * 4 + 2 ] = Math.random();
		instanceColorArray[ i * 4 + 3 ] = Math.random();

	}

	const instanceColorAttribute = new THREE.StorageInstancedBufferAttribute( instanceColorArray, 4 );

	geometry.setAttribute( 'instanceColor', instanceColorAttribute );

	material.positionNode = tslFn( () => {

		// Destructure uniforms
		const { uCircleRadius, uCircleSpeed, uSeparationStart, uSeparationEnd, uCircleBounce } = effectController;

		// Access the time elapsed since shader creation.
		const time = timerLocal();
		const circleSpeed = time.mul( uCircleSpeed );

		// Index of a cube within its respective circle.
		const instanceWithinCircle = instanceIndex.remainder( meshesPerCircle );

		// Index of the circle that the cube mesh belongs to.
		const circleIndex = instanceIndex.div( meshesPerCircle ).add( 1 );

		// Circle Index Even = 1, Circle Index Odd = -1.
		const evenOdd = circleIndex.remainder( 2 ).mul( 2 ).oneMinus();

		// Increase radius when we enter the next circle.
		const circleRadius = uCircleRadius.mul( circleIndex );

		// Normalize instanceIndex to range [0, 2*PI].
		const angle = float( instanceWithinCircle ).div( meshesPerCircle ).mul( PI2 ).add( circleSpeed );

		// Rotate even and odd circles in opposite directions.
		const circleX = sin( angle ).mul( circleRadius ).mul( evenOdd );
		const circleY = cos( angle ).mul( circleRadius );

		// Scale cubes in later concentric circles to be larger.
		const scalePosition = positionGeometry.mul( circleIndex );

		// Rotate the individual cubes that form the concentric circles.
		const rotatePosition = rotate( scalePosition, vec3( time, time, time ) );

		// Control how much the circles bounce vertically.
		const bounceOffset = cos( time.mul( 10 ) ).mul( uCircleBounce );

		// Bounce odd and even circles in opposite directions.
		const bounce = circleIndex.remainder( 2 ).equal( 0 ).cond( bounceOffset, negate( bounceOffset ) );

		// Distance between minimumn and maximumn z-distance between circles.
		const separationDistance = uSeparationEnd.sub( uSeparationStart );

		// Move sin into range of 0 to 1.
		const sinRange = ( sin( time ).add( 1 ) ).mul( 0.5 );

		// Make circle separation oscillate in a range of separationStart to separationEnd
		const separation = uSeparationStart.add( sinRange.mul( separationDistance ) );

		const newPosition = rotatePosition.add( vec3( circleX, circleY.add( bounce ), float( circleIndex ).mul( separation ) ) );
		return vec4( newPosition, 1.0 );

	} )();

	material.fragmentNode = attribute( 'instanceColor' );


	computeColor = tslFn( () => {

		const instanceColor = storage( instanceColorAttribute, 'vec4', instanceCount );

		const r = sin( timerLocal().add( instanceIndex ) );
		const g = cos( timerLocal().add( instanceIndex ) );
		const b = sin( timerLocal() );

		instanceColor.element( instanceIndex ).assign( vec4( r, g, b, 1.0 ) );

	} )().compute( instanceCount );


	mesh = new THREE.InstancedMesh( geometry, material, instanceCount );
	scene.add( mesh );

	const directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
	directionalLight.position.set( 5, 3, - 7.5 );
	scene.add( directionalLight );
	renderer = new THREE.WebGPURenderer( { antialias: false } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	document.body.appendChild( renderer.domElement );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 1;
	controls.maxDistance = 30;

	const gui = new GUI();
	gui.add( effectController.uCircleRadius, 'value', 0.1, 3.0, 0.1 ).name( 'Circle Radius' );
	gui.add( effectController.uCircleSpeed, 'value', 0.1, 3.0, 0.1 ).name( 'Circle Speed' );
	gui.add( effectController.uSeparationStart, 'value', 0.5, 4, 0.1 ).name( 'Separation Start' );
	gui.add( effectController.uSeparationEnd, 'value', 1.0, 5.0, 0.1 ).name( 'Separation End' );
	gui.add( effectController.uCircleBounce, 'value', 0.01, 0.2, 0.001 ).name( 'Circle Bounce' );

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	renderer.render( scene, camera );
	renderer.compute( computeColor );

}
