import * as THREE from 'three';
import {FirstPersonControls} from '/jsm/controls/FirstPersonControls.js';

export class FPSContoller{
    constructor(player, scene, sceneCamera){
        this.sceneCamera = sceneCamera;
        this.player = player;
        this.scene = scene;

        

        
        const cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        const headPos = this.player.animator.model.position;
        const cameraOffset = new THREE.Vector3(0.2, 4.13, -0.37);

        cam.rotation.set(0, 0, 0);
        cam.position.set(headPos.x + cameraOffset.x, headPos.y + cameraOffset.y, headPos.z + cameraOffset.z);


        const light = new THREE.PointLight(0xffffff, 0.9, 1000, 0.01);
        light.position.set(0, 2.6, 0);
        this.player.cameraObject.add(light);







        this.playerCam = cam;

        this.player.cameraObject.attach(cam);
        
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.rotationSpeed = Math.PI / 180 * 0.1;

        this.scene.camera = this.playerCam;


        window.addEventListener('click', () => {
            document.body.requestPointerLock();
        }, false);
        


 
        this.movementX = 0;
        this.movementY = 0;

        window.addEventListener('mousemove', (e) => {
            this.currentX = e.clientX;
            this.currentY = e.clientY;

            this.movementX = e.movementX;
            this.movementY = e.movementY;
            
            
        }, false);


        this.scene.physics.debug.disable()

        this.player.socket.emit('playerFullyLoaded');
    }

    update(timeElapsed){
        const rotSpeed = this.rotationSpeed * 2560 / window.innerWidth;


        this.euler.y -= this.movementX * rotSpeed;
        this.euler.x -= this.movementY * rotSpeed;
        this.euler.x = Math.min(Math.max(this.euler.x, -1.0472), 1.0472);

        this.player.rb.rotation.set(0, this.euler.y, 0, 'YXZ');

        const tempEuler = this.euler.clone();
        tempEuler.y = 0;

        this.player.cameraObject.rotation.set(this.euler.x, this.euler.y, this.euler.z, 'YXZ');
        


        this.movementX = 0;
        this.movementY = 0;
    }

}