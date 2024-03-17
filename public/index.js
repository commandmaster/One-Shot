const { Project, Scene3D, AmmoPhysics, PhysicsLoader, ExtendedObject3D} = ENABLE3D

const { GUI } = dat

import * as THREE from 'three'
import { OrbitControls } from '/jsm/controls/OrbitControls.js'
import { clone } from '/jsm/utils/SkeletonUtils.js';

import { FPSContoller } from '/firstPersonContoller.js';

const { System, Emitter, Rate, Span, SpriteRenderer} = window.Nebula;
import json from './particleSystems/blueBullet.json' assert { type: 'json' };




function waitForCondition(condition) {
    return new Promise((resolve) => {
      const intervalId = setInterval(() => {
        if (condition()) {
          clearInterval(intervalId);
          resolve();
        }
      }, 100);
    });
  }

class MainScene extends Scene3D {
    constructor() {
        super('MainScene')
    }

    init() {
        this.gui = new GUI()


        console.log('init')
        this.entities = {}
        this.lastUpdateTime = 0;

        this.renderer.setPixelRatio(1)
        this.renderer.setSize(window.innerWidth, window.innerHeight)

        let socket = io.connect('http://localhost:3000')
        this.socket = socket;

        this.socket.on('reloadTab', () => {
            console.log('reloadTab')
            location.reload()
        });

        this.socket.on('createPlayer', (packet) => {
            this.player = new PlayerClient(this.socket, this, packet)
        });

        socket.on("updateEntities", (packet) => {
            for (const id in packet.entities){
                if (id !== this.player.id){
                    if (this.entities[id]){
                        this.entities[id].update(packet.entities[id])

                        const entityAnimator = this.entities[id].animator
                        
                        if (entityAnimator){
                            if (packet.entities[id].animState !== entityAnimator.currentAnim) entityAnimator.play(packet.entities[id].animState);
                        }
                    }

                    if (!this.entities[id]){
                        this.entities[id] = new OtherEntity(this, packet.entities[id])
                    }
                    
                }
            }

            if (packet.entities.length < this.entities.length){
                for (const id in this.entities){
                    if (!packet.entities[id]){
                        this.physics.destroy(this.entities[id].rb)
                        this.scene.remove(this.entities[id].rb)
                        this.scene.remove(this.entities[id].playerModel)
                        delete this.entities[id]
                    }
                }
            }
        });

        this.socket.on("deleteEntity", (packet) => {
            this.physics.destroy(this.entities[packet.id].rb)
            this.scene.remove(this.entities[packet.id].rb)
            this.scene.remove(this.entities[packet.id].playerModel)
            delete this.entities[packet.id]
        })
        

        this.sentPacketBuffer = {};
        this.frameID = 0;


        // input setup
    
        this.currentInputs = {
            up: false,
            down: false,
            left: false,
            right: false,
            shoot: false
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'w') this.currentInputs.up = true
            if (e.key === 's') this.currentInputs.down = true
            if (e.key === 'a') this.currentInputs.left = true
            if (e.key === 'd') this.currentInputs.right = true

        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'w') this.currentInputs.up = false
            if (e.key === 's') this.currentInputs.down = false
            if (e.key === 'a') this.currentInputs.left = false
            if (e.key === 'd') this.currentInputs.right = false
        });

        window.addEventListener('mousedown', (e) => {
            this.currentInputs.shoot = true
        });

        window.addEventListener('mouseup', (e) => {
            this.currentInputs.shoot = false
        });

        
    }

    preload() {
        console.log('preload')
    }

    create() {
        console.log('create')

        // set up scene (light, ground, grid, sky, orbitControls)
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap



        // var dirLight = new THREE.DirectionalLight( 0xffffff );
        // dirLight.position.set( 75, 300, -75 );
        // dirLight.castShadow = true;
        // this.scene.add( dirLight );

        this.warpSpeed('fog', 'lookAtCenter', 'camera')


        const resize = () => {
            const newWidth = window.innerWidth
            const newHeight = window.innerHeight

            this.renderer.setSize(newWidth, newHeight)
            this.camera.aspect = newWidth / newHeight
            this.camera.updateProjectionMatrix()
        }

        window.onresize = resize
        resize()

        // enable physics debug
        this.physics.debug.enable()
        console.log(this.physics.debug)
        
        


        // position camera
        this.camera.position.set(10, 10, 20)
        

        const groundGeometry = new THREE.BoxGeometry(40, 1, 40)
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })
        const ground = new THREE.Mesh(groundGeometry, groundMaterial)
        ground.receiveShadow = true

        this.scene.add(ground)
        this.physics.add.existing(ground, { mass: 0, collisionFlags: 2 })
        ground.position.set(0, 0, 0)

        this.preloadGLTF('/gameAssets/3dModels/fullAlien.glb').then((model) => {
            this.playerModel = model;
        });


        this.preloadGLTF('/gameAssets/3dModels/alienGun.glb').then((model) => {
            this.rifleModel = model;
        });
        

        this.effectManager = new EffectManager(this);
    }

    update(t) {
        this.effectManager.update();


        if (this.player){
            this.player.applyMovements(this.currentInputs)



            let animState = 'Idle'
            if (this.player.animator){
                animState = this.player.animator.currentAnim
            }

            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.rb.quaternion)
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.player.rb.quaternion)
            const left = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.player.rb.quaternion)
            const back = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.rb.quaternion)

            let weaponPos = {x: 0, y: 0, z: 0}
            if (this.player.animator){
                if (this.player.animator.rifle) weaponPos = this.player.animator.rifle.getWorldPosition(new THREE.Vector3(0, 0, 0))
            }
            
 
            this.socket.emit("clientPacket", { 
                inputs: this.currentInputs, 
                frameID: this.frameID, 
                animState, 
                orientation: {
                    forward:{x:forward.x, y:forward.y, z:forward.z}, 
                    back: {x:back.x, y:back.y, z:back.z}, 
                    left: {x:left.x, y:left.y, z:left.z}, 
                    right: {x:right.x, y:right.y, z:right.z}
                },
                rot: {x: this.player.cameraObject.rotation.x, y: this.player.cameraObject.rotation.y, z: this.player.cameraObject.rotation.z},
                weaponPos,

            });
            
            this.sentPacketBuffer[this.frameID] = {inputs: this.currentInputs, frameID: this.frameID, state: { pos: this.player.rb.position, rot: this.player.rb.rotation, linearVel: this.player.rb.body.velocity, angularVel: this.player.rb.body.angularVelocity}}
            this.frameID++;

            this.player.update(t)
        }

        if (this.fpsCamera) this.fpsCamera.update(t - this.lastUpdateTime);

        this.lastUpdateTime = t;
    }

    preloadGLTF(path){
        return new Promise((resolve, reject) => {
            this.animations = {};
            try {

            }

            catch (error){
                console.log(error)
            }

            this.load.gltf(path).then(gltf => {
                const child = gltf.scene.children[0]
                


                const tempModel = new ExtendedObject3D()
                tempModel.add(child)
                



                tempModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true
                        child.material.metalness = 0
                        child.frustumCulled = false
                    }


                });

                this.animationMixers.add(tempModel.animation.mixer)

                const animNames = [];
                gltf.animations.forEach(animation => {
                    if (animation.name) {
                      // add a new animation to the box man
                      tempModel.animation.add(animation.name, animation)
                      animNames.push(animation.name)
                      
                    }
                })

                tempModel.animation.mixer.timeScale = 1


                tempModel.scale.set(1.5, 1.5, 1.5)


                tempModel.animation.play('Idle')
                
                

                resolve({tempModel, gltf});
            }).catch(error => {
                reject(error);
            });
        });
    }
}

// load from '/lib/ammo/kripken' or '/lib/ammo/moz'

PhysicsLoader('/lib/ammo/kripken', (a) => {
    new Project({ scenes: [MainScene], antialias: true })

    //new ClientWorld();
});




class PlayerClient{
    constructor(socket, scene, initPacket){
        this.socket = socket;
        this.scene = scene;
        this.id = initPacket.id;
        this.enityType = "player"
        this.team = initPacket.team;

        this.shotTimer = 0;
        this.lastShotTime = Date.now();

        this.init(initPacket);
    }

    init(initPacket){
        
        let group = new THREE.Group()
        const body = this.scene.add.box({ height: 2.3, width: 0.75, depth: 0.5 })
        const head = this.scene.add.sphere({ radius: 0.3, y: 1.4, z: -0.17 })
        group.add(body, head)
        group.position.set(initPacket.pos.x, initPacket.pos.y, initPacket.pos.z)
        group.customTeamTag = this.team;

        this.scene.physics.add.existing(group)
        this.rb = group;

        this.cameraObject = new THREE.Object3D()
        this.scene.scene.add(this.cameraObject);
        


        

        

        this.rb.body.setFriction(1.2)

        //console.log(this.rb)
        this.rb.visible = false;

        this.rb.body.setCollisionFlags(2)
        this.rb.body.setRotation(initPacket.rot.x, initPacket.rot.y, initPacket.rot.z)
        this.rb.body.needUpdate = true;




    
        this.socket.on('resolveState', (packet) => {
            this.rb.position.set(packet.pos.x, packet.pos.y, packet.pos.z)

            this.rb.body.setVelocity(packet.linearVel.x, packet.linearVel.y, packet.linearVel.z,)
            
            this.rb.body.needUpdate = true;

            this.rb.body.once.update(() => {

                for (const frameID in this.scene.sentPacketBuffer){
                    this.applyMovements(this.scene.sentPacketBuffer[frameID].inputs)
                }
    
                this.scene.sentPacketBuffer = {}
            })
        })

        waitForCondition(() => {return this.scene.playerModel}).then(() => {
            if (!this.animator){
                this.animator = new PlayerAnimator(this.scene.playerModel, this.scene);

                waitForCondition(() => {return this.animator.doneLoading}).then(() => {
                    this.FPSContoller = new FPSContoller(this, this.scene, this.scene.camera);
                    this.playerModel = this.animator.model;
                });
            }
        });
    }

    applyMovements(inputs){
        let speed = 5;


        const vel = this.rb.body.velocity


        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rb.quaternion)
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.rb.quaternion)
        const left = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.rb.quaternion)
        const back = new THREE.Vector3(0, 0, 1).applyQuaternion(this.rb.quaternion)

        
        if (inputs.up === true){
            this.rb.body.setVelocity(forward.x * speed, forward.y, forward.z * speed)
        }
        if (inputs.down === true){
            this.rb.body.setVelocity(back.x * speed, back.y, back.z * speed)
        }
        if (inputs.left === true){
            this.rb.body.setVelocity(left.x * speed, left.y, left.z * speed)
        }
        if (inputs.right === true){
            this.rb.body.setVelocity(right.x * speed, right.y, right.z * speed)
        }
        
    }

    update(t){
        const timeSinceLastShot = Date.now() - this.lastShotTime;


        this.cameraObject.position.set(this.rb.position.x, this.rb.position.y, this.rb.position.z)
        this.cameraObject.y = this.rb.position.y;
        if (this.playerModel){
            const animPosOffset = new THREE.Vector3(0, -1.15, 0.1)
            const animRotOffset = {x: 0, y: Math.PI, z: 0}


            if (this.animator){
                this.animator.update()
            }

            if (this.FPSContoller){
                this.FPSContoller.update(t)
            }

            if (this.scene.currentInputs.shoot === true && timeSinceLastShot > 500 && this.shotTimer > 500){
                this.lastShotTime = Date.now();


                const raycaster = this.scene.physics.add.raycaster('allHits')
                const weaponPos = this.animator.rifle.getWorldPosition(new THREE.Vector3(0, 0, 0))
                raycaster.setRayFromWorld(weaponPos.x, weaponPos.y, weaponPos.z)

                const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraObject.quaternion)
                raycaster.setRayToWorld(weaponPos.x + direction.x * 100, weaponPos.y + direction.y * 100, weaponPos.z + direction.z * 100)
                raycaster.rayTest()

                if (raycaster.hasHit()) {
                    raycaster.getCollisionObjects().forEach((obj, i) => {
                      const { x, y, z } = raycaster.getHitPointsWorld()[i]

                      console.log('allHits: ', `${obj}:`, `x:${x.toFixed(2)}`, `y:${y.toFixed(2)}`, `z:${z.toFixed(2)}`)

                      if (obj.customTeamTag === 'red'){
                        console.log('hit red player!')
                      }
                    })
                }

                raycaster.destroy()

                const pos = this.animator.rifleBarrel.getWorldPosition(new THREE.Vector3(0, 0, 0))


                const effect = new BulletEffect(this.scene, pos, new THREE.Vector3(0, 0, 1).applyQuaternion(this.cameraObject.quaternion), json.particleSystemState)
                this.scene.effectManager.addEffect(effect)
            }
        }
    }
}

class OtherEntity{
    constructor(scene, entityObject){
        this.scene = scene;
        this.init()

        this.enityType = "entity"


        let group = new THREE.Group()
        const body = this.scene.add.box({ height: 2.3, width: 0.75, depth: 0.5 })
        const head = this.scene.add.sphere({ radius: 0.3, y: 1.4, z: -0.17 })
        group.add(body, head)
        group.position.set(entityObject.pos.x, entityObject.pos.y, entityObject.pos.z)


        this.scene.physics.add.existing(group)

        this.rb = group;
        this.rb.body.setCollisionFlags(2)
        
        this.rb.rotation.set(0, entityObject.rot.y, 0)
        this.rb.body.needUpdate = true;

        this.rb.body.once.update(() => {
            this.rb.body.setCollisionFlags(0)
        })

        
    }

    init(){
        waitForCondition(() => {return this.scene.playerModel}).then(() => {
            if (!this.animator){
                this.animator = new EntityAnimator(this.scene.playerModel, this.scene);
                this.playerModel = this.animator.model;
            }
            
        });
    }

    update(entityObject){

        this.rb.body.setCollisionFlags(2)
        this.rb.position.set(entityObject.pos.x, entityObject.pos.y, entityObject.pos.z)
        this.rb.rotation.set(0, entityObject.rot.y, 0)

        this.rb.customTeamTag = entityObject.team;

        this.rb.body.needUpdate = true;

        const animPosOffset = new THREE.Vector3(0, -1.15, 0.1)
        const animRotOffset = {x: 0, y: Math.PI, z: 0}

        
        if (this.playerModel){
            this.playerModel.position.set(this.rb.position.x + animPosOffset.x, this.rb.position.y + animPosOffset.y, this.rb.position.z + animPosOffset.z)
            this.playerModel.rotation.set(this.rb.rotation.x + animRotOffset.x, this.rb.rotation.y + animRotOffset.y, this.rb.rotation.z + + animRotOffset.z)
        }
    }
}



class EntityAnimator{
    constructor(object, scene){
        this.scene = scene;
        this.doneLoading = false;

        this.currentAnim = 'Idle';

        this.model = clone(object.tempModel)

        this.scene.scene.add(this.model)
        
        this.scene.animationMixers.add(this.model.animation.mixer)

        const animNames = [];
        object.gltf.animations.forEach(animation => {
            if (animation.name) {
                // add a new animation to the box man
                this.model.animation.add(animation.name, animation)
                animNames.push(animation.name)
                
            }
        })

        const bones = {};
        this.model.traverse((child) => {
            if (child.isBone) {
                bones[child.name] = child
            }
        });

        // const testShape = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 10), new THREE.MeshBasicMaterial({ color: 0x00ff00 }))
        // this.scene.scene.add(testShape)
        waitForCondition(() => {return this.scene.rifleModel}).then(() => {
            const rifle = clone(this.scene.rifleModel.tempModel)

            const rifleBones = {};
            rifle.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true
                    child.material.metalness = 0
                    child.frustumCulled = false
                }

                if (child.isBone) rifleBones[child.name] = child


            });
            this.scene.scene.add(rifle)

            rifle.lookAt(new THREE.Vector3(0, 0, 0))
            bones['mixamorigRightHand'].add(rifle)

            rifle.rotation.x = Math.PI + 0.2
            rifle.rotation.z = -Math.PI/2
            

            rifle.scale.set(0.4, 0.4, 0.4)
            
            rifle.position.set(0, 25, 2)


            this.rifleBones = rifleBones;
            this.bones = bones;
            this.rifle = rifle
        });
        

        this.model.animation.mixer.timeScale = 1


        this.model.scale.set(1.5, 1.5, 1.5)


        this.model.animation.play('Idle')
        
        this.doneLoading = true;
    }


    play(name){
        this.model.animation.play(name)
        this.currentAnim = name;
    }

    update(){
        if (this.scene.currentInputs.up === true){
            if (this.currentAnim !== 'rifleRunning') this.play('rifleRunning');
            
        }


        else if (this.scene.currentInputs.down === true){
            if (this.currentAnim !== 'backwards') this.play('backwards');
        }

            
        else if (this.scene.currentInputs.left === true){
            if (this.currentAnim !== 'strafeLeft') this.play('strafeLeft');
        }

        
        else if (this.scene.currentInputs.right === true){
            if (this.currentAnim !== 'strafeRight') this.play('strafeRight');
        }

        else {
            if (this.currentAnim !== 'Idle') this.play('Idle');
            
        }
            
 
    }

}





class PlayerAnimator{
    constructor(object, scene){
        this.scene = scene;
        this.doneLoading = false;

        this.currentAnim = 'Idle';

        this.model = clone(object.tempModel)

        this.scene.scene.add(this.model)
        
        this.scene.animationMixers.add(this.model.animation.mixer)

        

        const animNames = [];
        object.gltf.animations.forEach(animation => {
            if (animation.name) {
                // add a new animation to the box man
                this.model.animation.add(animation.name, animation)
                animNames.push(animation.name)
                
            }
        })

        const bones = {};
        this.model.traverse((child) => {
            if (child.isBone) {
                bones[child.name] = child
            }
        });

        // const testShape = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 10), new THREE.MeshBasicMaterial({ color: 0x00ff00 }))
        // this.scene.scene.add(testShape)
        waitForCondition(() => {return this.scene.rifleModel}).then(() => {
            const rifle = clone(this.scene.rifleModel.tempModel)

            rifle.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true
                    child.material.metalness = 0
                    child.frustumCulled = false
                }
            });



            
            this.scene.scene.add(rifle)

            const cameraObject = this.scene.player.cameraObject

            this.model.rotation.y = Math.PI - 0.2

 

   
            
            bones['mixamorigRightHand'].add(rifle)

            rifle.rotation.x = Math.PI + 0.3
            rifle.rotation.z = -Math.PI/2
            

            rifle.scale.set(0.4, 0.4, 0.4)
            
            rifle.position.set(0, 25, 2)



            cameraObject.attach(this.model)


            this.bones = bones;
            this.rifle = rifle;


            this.rifleBarrel = new THREE.Group()
            this.rifleBarrel.position.set(5.3, 62, 12.4)
            this.rifleBarrel.rotation.x = Math.PI + 0.3
            this.rifleBarrel.rotation.z = -Math.PI/2

            // this.scene.gui.add(this.rifleBarrel.position, 'x').min(-10).max(100).step(0.1).name('rifleBarrelX')
            // this.scene.gui.add(this.rifleBarrel.position, 'y').min(-10).max(100).step(0.1).name('rifleBarrelY')
            // this.scene.gui.add(this.rifleBarrel.position, 'z').min(-10).max(100).step(0.1).name('rifleBarrelZ')


            bones['mixamorigRightHand'].add(this.rifleBarrel)


            



        });
        

        this.model.animation.mixer.timeScale = 1


        this.model.scale.set(1.5, 1.5, 1.5)


        this.model.animation.play('Idle')
        this.play('Idle')
        
        this.doneLoading = true;

        //this.model.visible = false;
    }


    play(name){
        this.model.animation.play(name)
        this.playing = name;
    }

    update(){
        if (this.scene.currentInputs.up === true){
            this.currentAnim = 'rifleRunning';
        }


        else if (this.scene.currentInputs.down === true){
            this.currentAnim = 'backwards';
        }

            
        else if (this.scene.currentInputs.left === true){
            this.currentAnim = 'strafeLeft';
        }

        
        else if (this.scene.currentInputs.right === true){
            this.currentAnim = 'strafeRight';
        }

        else {
            this.currentAnim = 'Idle';
        }

        
        if (this.playing !== 'Idle') {
            this.play('Idle');
        }

        

        
        console.log(this.currentAnim)
            
 
    }

}




class BulletEffect{
    constructor(scene, position, direction, json){
        this.scene = scene;
        this.position = position;
        this.direction = direction;
        this.json = json;

        this.init();
    }

    init(){
        this.nebulaObject = new THREE.Group()
        this.nebulaObject.position.set(this.position.x, this.position.y, this.position.z)
        this.nebulaObject.lookAt(this.position.x + this.direction.x, this.position.y + this.direction.y, this.position.z + this.direction.z)
        
    
        System.fromJSONAsync(json.particleSystemState, THREE).then((system) => {
            const nebulaRenderer = new SpriteRenderer(this.nebulaObject, THREE)

            this.nebulaSystem = system;
            
            this.nebula = system.addRenderer(nebulaRenderer)
            this.nebulaObject.scale.set(0.05, 0.05, 0.05)
            this.scene.scene.add(this.nebulaObject)

            setTimeout(() => {
                this.scene.scene.remove(this.nebulaObject)
                this.nebula.destroy()
            }, 300)
        });



        
    }

    update(){
        if (this.nebula){
            this.nebula.update();
            
        } 

    }
}

class EffectManager{
    constructor(scene){
        this.scene = scene;
        this.effects = [];
    }

    addEffect(effect){
        this.effects.push(effect)
    }

    update(){
        this.effects.forEach(effect => {
            effect.update()
        })
    }
}

