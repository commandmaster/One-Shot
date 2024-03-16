import * as THREE from 'three';

export class ParticleGroup{
    constructor(scene, texturePath, scale, alpha){

        this.scene = scene;
        this.group = new SPE.Group({
            texture: {
                value: new THREE.TextureLoader().load(texturePath),
                loop: 1
            },
            scale,
            alphaTest: alpha
        });

        this.scene.scene.add(this.group.mesh);
    }
}

export class ParticleEmitter{
    constructor(ParticleGroup, maxAge, position, acceleration, velocity, color, size){
        this.ParticleGroup = ParticleGroup;
        this.emmiter = new SPE.Emitter({
            maxAge,
            position,
            acceleration,
            velocity,
            color,
            size
        });

        this.ParticleGroup.group.addEmitter(this.emmiter);
    }
}