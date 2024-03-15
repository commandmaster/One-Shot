import * as THREE from 'three';
import {FirstPersonControls} from '/jsm/controls/FirstPersonControls.js';

export class FPSCamera{
    constructor(camera, player){
        this.camera = camera;
        this.player = player;

        this.controls = new FirstPersonControls(this.camera, document.body);
        this.controls.movementSpeed = 10;
        this.controls.lookSpeed = 0.05;

        window.addEventListener('click', () => {
            document.body.requestPointerLock();
        }, false);
        
    }

    update(timeElapsed){
        this.controls.update(timeElapsed);
    }

}