const { Project, Scene3D, AmmoPhysics, PhysicsLoader, ExtendedObject3D} = ENABLE3D

import * as THREE from 'three'
import { OrbitControls } from '/jsm/controls/OrbitControls.js'
import { clone } from '/jsm/utils/SkeletonUtils.js';

import { FPSCamera } from '/firstPersonContoller.js';



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
            this.fpsCamera = new FPSCamera(this.camera, this.player)
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



        var dirLight = new THREE.DirectionalLight( 0xffffff );
        dirLight.position.set( 75, 300, -75 );
        dirLight.castShadow = true;
        this.scene.add( dirLight );

        this.warpSpeed('orbitControls', 'sky', 'fog', 'lookAtCenter', 'camera')


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

        // position camera
        this.camera.position.set(10, 10, 20)
        

        const groundGeometry = new THREE.BoxGeometry(40, 1, 40)
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })
        const ground = new THREE.Mesh(groundGeometry, groundMaterial)
        ground.receiveShadow = true

        this.scene.add(ground)
        this.physics.add.existing(ground, { mass: 0, collisionFlags: 2 })
        ground.position.set(0, 0, 0)

        this.preloadGLTF('/gameAssets/fullAlien.glb').then((model) => {
            this.playerModel = model;
        });


        this.preloadGLTF('/gameAssets/xen_slr_rifle.glb').then((model) => {
            this.rifleModel = model;
        });
        

        
    }

    update(t) {
        if (this.player){
            this.player.applyMovements(this.currentInputs)

            let animState = 'Idle'
            if (this.player.animator){
                animState = this.player.animator.currentAnim
            }

            this.socket.emit("clientPacket", { inputs: this.currentInputs, frameID: this.frameID, animState})
            
            this.sentPacketBuffer[this.frameID] = {inputs: this.currentInputs, frameID: this.frameID, state: { pos: this.player.rb.position, rot: this.player.rb.rotation, linearVel: this.player.rb.body.velocity, angularVel: this.player.rb.body.angularVelocity}}
            this.frameID++;

            this.player.update()
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
        

        this.init(initPacket);
    }

    init(initPacket){
        
        let group = new THREE.Group()
        const body = this.scene.add.box({ height: 2.3, width: 0.75, depth: 0.5 })
        const head = this.scene.add.sphere({ radius: 0.3, y: 1.4, z: -0.17 })
        group.add(body, head)
        group.position.set(initPacket.pos.x, initPacket.pos.y, initPacket.pos.z)

        this.scene.physics.add.existing(group)
        this.rb = group;
        
       
        //this.rb = this.scene.physics.add.box({ x: initPacket.pos.x, y: initPacket.pos.y, z: initPacket.pos.z }, { lambert: { color: 'hotpink' }});



        this.rb.body.setFriction(1.2)

        //console.log(this.rb)
        this.rb.visible = false;

        this.rb.body.setCollisionFlags(2)
        this.rb.body.setRotation(initPacket.rot.x, initPacket.rot.y, initPacket.rot.z)
        this.rb.body.needUpdate = true;

        console.log(this.rb.body.ammo.getWorldTransform().getOrigin().x(), this.rb.body.ammo.getWorldTransform().getOrigin().y(), this.rb.body.ammo.getWorldTransform().getOrigin().z())


    
        this.socket.on('resolveState', (packet) => {
            this.rb.position.set(packet.pos.x, packet.pos.y, packet.pos.z)
            //this.rb.rotation.set(packet.rot.x, packet.rot.y, packet.rot.z, packet.rot.w)
            this.rb.rotation.x = packet.rot.x
            this.rb.rotation.z = packet.rot.z

            this.rb.body.setVelocity(packet.linearVel.x, packet.linearVel.y, packet.linearVel.z,)
            this.rb.body.setAngularVelocity(packet.angularVel.x, packet.angularVel.y, packet.angularVel.z, packet.angularVel.w)
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
                this.animator = new Animator(this.scene.playerModel, this.scene);
                this.playerModel = this.animator.model;
            }
        });
    }

    applyMovements(inputs){
        let speed = 1.5;
        const maxSpeed = 5;
        const turnMultiplier = 2.5;

        const vel = this.rb.body.velocity
        
        if (inputs.up === true && vel.z > -maxSpeed){
            if (vel.z > 0) speed *= turnMultiplier;

            this.rb.body.applyForce(0, 0, -speed);
        }
        if (inputs.down === true && vel.z < maxSpeed){
            if (vel.z < 0) speed *= turnMultiplier;

            this.rb.body.applyForce(0, 0, speed);
        }
        if (inputs.left === true && vel.x > -maxSpeed){
            if (vel.x > 0) speed *= turnMultiplier;

            this.rb.body.applyForce(-speed, 0, 0);
        }
        if (inputs.right === true && vel.x < maxSpeed){
            if (vel.x < 0) speed *= turnMultiplier;

            this.rb.body.applyForce(speed, 0, 0);
        }
        
    }

    update(){
        if (this.playerModel){
            const animPosOffset = new THREE.Vector3(0, -1.15, 0.1)
            const animRotOffset = {x: 0, y: Math.PI, z: 0}
            //this.scene.camera.position.set(this.rb.position.x, this.rb.position.y + 2, this.rb.position.z)



            this.playerModel.position.set(this.rb.position.x + animPosOffset.x, this.rb.position.y + animPosOffset.y, this.rb.position.z + animPosOffset.z)
            this.playerModel.rotation.set(this.rb.rotation.x + animRotOffset.x, this.rb.rotation.y + animRotOffset.y, this.rb.rotation.z + + animRotOffset.z, this.rb.rotation.w)

            if (this.animator){
                this.animator.update()
            }
        }
    }
}

class OtherEntity{
    constructor(scene, entityObject){
        this.scene = scene;
        this.init()


        let group = new THREE.Group()
        const body = this.scene.add.box({ height: 2.3, width: 0.75, depth: 0.5 })
        const head = this.scene.add.sphere({ radius: 0.3, y: 1.4, z: -0.17 })
        group.add(body, head)
        group.position.set(entityObject.pos.x, entityObject.pos.y, entityObject.pos.z)

        this.scene.physics.add.existing(group)

        this.rb = group;
        this.rb.body.setCollisionFlags(2)
        this.rb.rotation.set(entityObject.rot.x, entityObject.rot.y, entityObject.rot.z)
        this.rb.body.needUpdate = true;

        this.rb.body.once.update(() => {
            this.rb.body.setCollisionFlags(0)
        })

        
    }

    init(){
        waitForCondition(() => {return this.scene.playerModel}).then(() => {
            if (!this.animator){
                this.animator = new Animator(this.scene.playerModel, this.scene);
                this.playerModel = this.animator.model;
            }
            
        });
    }

    update(entityObject){
        this.rb.body.setCollisionFlags(2)
        this.rb.position.set(entityObject.pos.x, entityObject.pos.y, entityObject.pos.z)
        this.rb.rotation.set(entityObject.rot.x, entityObject.rot.y, entityObject.rot.z)
        this.rb.body.needUpdate = true;

        const animPosOffset = new THREE.Vector3(0, -1.15, 0.1)
        const animRotOffset = {x: 0, y: Math.PI, z: 0}

        
        if (this.playerModel){
            this.playerModel.position.set(this.rb.position.x + animPosOffset.x, this.rb.position.y + animPosOffset.y, this.rb.position.z + animPosOffset.z)
            this.playerModel.rotation.set(this.rb.rotation.x + animRotOffset.x, this.rb.rotation.y + animRotOffset.y, this.rb.rotation.z + + animRotOffset.z, this.rb.rotation.w)
        }
    }
}



class Animator{
    constructor(object, scene){
        this.scene = scene;

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

            rifle.lookAt(new THREE.Vector3(0, 0, 0))
            bones['mixamorigRightHand'].add(rifle)

            rifle.rotation.x = Math.PI + 0.2
            rifle.rotation.z = -Math.PI/2
            

            rifle.scale.set(0.4, 0.4, 0.4)
            
            rifle.position.set(0, 25, 2)



            this.bones = bones;
            this.rifle = rifle
        });
        

        this.model.animation.mixer.timeScale = 1


        this.model.scale.set(1.5, 1.5, 1.5)


        this.model.animation.play('Idle')
        
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



