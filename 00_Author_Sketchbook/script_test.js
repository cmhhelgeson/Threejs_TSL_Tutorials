import * as THREE from 'three';
import { uniform, temp, storage, If, float, Fn, vec3, instanceIndex, positionLocal, negate, abs, attribute } from 'three/tsl';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import GUI from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';

let camera, scene, renderer;

// CPU Compute
let computeParticleCPU;
// GPU Compute
let computeParticleGPU;

// Particles Mesh
let particlesMesh;

const numParticles = 1000;

const params = {
	compute: 'GPU'
}
let stats;


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

	// Add bounds helper
	const boxGeometry = new THREE.BoxGeometry(20, 20, 20);
	const wireframe = new THREE.WireframeGeometry( boxGeometry );
	const line = new LineSegments2( wireframe );
	line.material.depthTest = false;
	line.material.opacity = 0.25;
	line.material.transparent = true;
	const boundsHelper = new THREE.BoxHelper( line, 0xffffff );
	scene.add( boundsHelper );

	const geometry = new THREE.SphereGeometry(0.1, 10, 10);
	const instancePositionBaseAttribute = geometry.attributes.instancePosition;
	const instancePositionStorageAttribute = new THREE.StorageInstancedBufferAttribute(instancePositionBaseAttribute.count, 3);
	const instanceVelocityStorageAttribute = new THREE.StorageInstancedBufferAttribute(instancePositionBaseAttribute.count, 3)
	const material = new THREE.MeshStandardNodeMaterial( { color: "red" });

	particlesMesh = new THREE.InstancedMesh(geometry, material, numParticles);

	scene.add(particlesMesh);

	const velocities = new Float32Array(numParticles * 3);

	for (let i = 0; i < numParticles; i ++) {
		// Assign random velocities between ( -3 to 3 ) to each particle
		velocities[i * 3] = (Math.random() * 2 - 1) * 0.1;
		velocities[i * 3 + 1] = (Math.random() * 2 - 1) * 0.1;
		velocities[i * 3 + 2] = (Math.random() * 2 - 1) * 0.1;
	}

	particlesMesh.geometry.setAttribute('instanceVelocity', new THREE.InstancedBufferAttribute(velocities, 3))

	computeParticleCPU = () => {

		const dummy = new THREE.Object3D();
		const position = new THREE.Vector3();
		const velocity = new THREE.Vector3();
		const matrix = new THREE.Matrix4();

		for ( let i = 0; i < numParticles; i++ ) {

			// Get the current transformation matrix
			// of instance i of the instanced mesh
			particlesMesh.getMatrixAt(i, matrix);

			// Extract the instance's position from the matrix
			position.setFromMatrixPosition(matrix);
			
			velocity.set(
				velocities[i * 3],
				velocities[i * 3 + 1],
				velocities[i * 3 + 2]
			);
			// Apply velocity to position
			position.add(velocity);

			// Second part of tutorial

			if (position.x < -10) {
				position.x = -10;
				velocities[ i * 3 ] = -velocities[i * 3]
			} else if (position.x > 10) {
				position.x = 10;
				velocities[ i * 3 ] = -velocities[i * 3]
			}

			
			if (position.y < -10) {
				position.y = -10;
				velocities[ i * 3 + 1 ] = -velocities[i * 3 + 1]
			} else if (position.y > 10) {
				position.y = 10;
				velocities[ i * 3 + 1] = -velocities[i * 3 + 1]
			}


			if (position.z < -10) {
				position.z = -10;
				velocities[ i * 3 + 2] = -velocities[i * 3 + 2]
			} else if (position.z > 10) {
				position.z = 10;
				velocities[ i * 3 + 2 ] = -velocities[i * 3 + 2]
			}


			dummy.position.set(position.x, position.y, position.z);
			dummy.updateMatrix();

			particlesMesh.setMatrixAt(i, dummy.matrix);

		}

		particlesMesh.instanceMatrix.needsUpdate = true;

	}

	material.positionNode = positionLocal.add(attribute('instanceVelocity').mul(100));


	const directionalLight = new THREE.AmbientLight(0xffffff, 20);
	const directionalLight2 = new THREE.DirectionalLight(0xffffff, 20);
	directionalLight.position.set(5, 3, 7);
	directionalLight2.position.set(5, 3, -7);
	scene.add(directionalLight);
	scene.add(directionalLight2);
	//
	
	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 1;
	controls.maxDistance = 40;

	const gui = new GUI();
	gui.add(params, 'compute', ['CPU', 'GPU']);

	stats = new Stats();
	document.body.appendChild(stats.dom)


	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	if (params.compute === 'CPU') {

		computeParticleCPU();

	} else {
		
		//renderer.compute( computeParticleGPU );

	}

	renderer.render( scene, camera );
	stats.update();

}

init();