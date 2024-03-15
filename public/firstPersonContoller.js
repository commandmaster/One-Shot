import * as THREE from 'three';
import {FirstPersonControls} from '/jsm/controls/FirstPersonControls.js';

export class FPSContoller{
    constructor(player, scene, sceneCamera){
        this.sceneCamera = sceneCamera;
        this.player = player;
        this.scene = scene;

        
        const cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const cameraHelper = new THREE.CameraHelper(cam);
        this.scene.scene.add(cameraHelper);

        const headPos = this.player.animator.model.position;
        const cameraOffset = new THREE.Vector3(0.2, 2.85, -0.5);

        cam.rotation.set(0, 0, 0);
        cam.position.set(headPos.x + cameraOffset.x, headPos.y + cameraOffset.y, headPos.z + cameraOffset.z);

        this.playerCam = cam;

        this.player.cameraObject.attach(cam);
        
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.rotationSpeed = Math.PI / 180;
        

        //this.scene.camera = cam;

        window.addEventListener('click', () => {
            document.body.requestPointerLock();
        }, false);
        

        this.lastX = 0;
        this.lastY = 0;

        this.currentX = 0;
        this.currentY = 0;
        window.addEventListener('mousemove', (e) => {
            this.currentX = e.clientX;
            this.currentY = e.clientY;
        }, false);

    }

    update(timeElapsed){
        const movementX = this.currentX - this.lastX;
        const movementY = this.currentY - this.lastY;

        this.euler.y -= movementX * this.rotationSpeed;
        this.euler.x -= movementY * this.rotationSpeed;
        this.euler.x = Math.min(Math.max(this.euler.x, -1.0472), 1.0472);

        this.player.rb.rotation.set(0, this.euler.y, 0, 'YXZ');

        const tempEuler = this.euler.clone();
        tempEuler.y = 0;
        this.playerCam.quaternion.setFromEuler(tempEuler);

        this.lastX = this.currentX;
        this.lastY = this.currentY;
    }

}