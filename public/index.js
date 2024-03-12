const { Project, Scene3D, PhysicsLoader, THREE } = ENABLE3D

class MainScene extends Scene3D {
    constructor() {
        super('MainScene')
        this.entities = {}
    }


    init() {
        console.log('init')

        this.renderer.setPixelRatio(1)
        this.renderer.setSize(window.innerWidth, window.innerHeight)

        let socket = io.connect('http://localhost:3000')
        socket.on('createPlayer', (packet) => {
            this.player = new PlayerClient(socket, this, packet)
        });

        socket.on("updateEntities", (packet) => {
            for (const id in packet.entities){
                if (id !== this.player.id){
                    if (this.entities[id]){
                        this.entities[id].update(packet.entities[id])
                    }

                    if (!this.entities[id]){
                        this.entities[id] = new OtherEntity(this, packet.entities[id])
                    }
                    
                }
            }
        });

        socket.on("deleteEntity", (packet) => {
            this.physics.destroy(this.entities[packet.id].rb)
            this.scene.remove(this.entities[packet.id].rb)
            delete this.entities[packet.id]
        })

        this.socket = socket;
        this.frameID = 0;


        // input setup
    
        this.currentInputs = {
            up: false,
            down: false,
            left: false,
            right: false
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'w') this.currentInputs.up = true
            if (e.key === 's') this.currentInputs.down = true
            if (e.key === 'a') this.currentInputs.left = true
            if (e.key === 'd') this.currentInputs.right = true
        })

        window.addEventListener('keyup', (e) => {
            if (e.key === 'w') this.currentInputs.up = false
            if (e.key === 's') this.currentInputs.down = false
            if (e.key === 'a') this.currentInputs.left = false
            if (e.key === 'd') this.currentInputs.right = false
        })


    }

    preload() {
        console.log('preload')
    }

    create() {
        console.log('create')

        // set up scene (light, ground, grid, sky, orbitControls)
        this.warpSpeed('-ground')

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

        const ground = this.physics.add.box({
            name: 'ground',
            width: 40,
            depth: 40,
            collisionFlags: 2,
            mass: 0
          })

        ground.position.set(0, 0, 0)

        // // green sphere
        // const geometry = new THREE.SphereGeometry(0.8, 16, 16)
        // const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
        // const cube = new THREE.Mesh(geometry, material)
        // cube.position.set(0.2, 3, 0)
        // this.scene.add(cube)
        // // add physics to an existing object
        // this.physics.add.existing(cube)
    }

    update() {
        if (this.player){
            this.player.applyMovements(this.currentInputs)
            this.socket.emit("clientPacket", { inputs: this.currentInputs, frameID: this.frameID })
            this.frameID++;
        }

        console.log(this.entities)
    }
}

// load from '/lib/ammo/kripken' or '/lib/ammo/moz'

PhysicsLoader('/lib/ammo/kripken', () => {
    new Project({ scenes: [MainScene], antialias: true })

});




class PlayerClient{
    constructor(socket, scene, initPacket){
        this.socket = socket;
        this.scene = scene;
        this.id = initPacket.id;

        this.init(initPacket);
    }

    init(initPacket){
        this.rb = this.scene.physics.add.box({ x: initPacket.pos.x, y: initPacket.pos.y, z: initPacket.pos.z }, { lambert: { color: 'hotpink' }});
        this.rb.body.setCollisionFlags(2)
        this.rb.body.setRotation(initPacket.rot.x, initPacket.rot.y, initPacket.rot.z)
        this.rb.body.needUpdate = true;

        this.rb.body.once.update(() => {
            this.rb.body.setCollisionFlags(0)
        })

        this.socket.on('resolveState', (packet) => {
            this.rb.body.setCollisionFlags(2)
            this.rb.position.set(packet.pos.x, packet.pos.y, packet.pos.z)
            this.rb.rotation.set(packet.rot.x, packet.rot.y, packet.rot.z, packet.rot.w)
            this.rb.body.setVelocity(packet.linearVel.x, packet.linearVel.y, packet.linearVel.z,)
            this.rb.body.setAngularVelocity(packet.angularVel.x, packet.angularVel.y, packet.angularVel.z, packet.angularVel.w)
            this.rb.body.needUpdate = true;
        })
    }

    applyMovements(inputs){
        const speed = 2;
        if (inputs.up === true){
            this.rb.body.applyForce(0, 0, -speed)
        }
        if (inputs.down === true){
            this.rb.body.applyForce(0, 0, speed)
        }
        if (inputs.left === true){
            this.rb.body.applyForce(-speed, 0, 0)
        }
        if (inputs.right === true){
            this.rb.body.applyForce(speed, 0, 0)
        }
    }

    update(){
        
    }
}

class OtherEntity{
    constructor(scene, entityObject){
        this.scene = scene;
        this.init()

        this.rb = this.scene.physics.add.box({ x: entityObject.pos.x, y: entityObject.pos.y, z: entityObject.pos.z }, { lambert: { color: 'hotpink' }});
        this.rb.body.setCollisionFlags(2)
        this.rb.rotation.set(entityObject.rot.x, entityObject.rot.y, entityObject.rot.z)
        this.rb.body.needUpdate = true;

        this.rb.body.once.update(() => {
            this.rb.body.setCollisionFlags(0)
        })
    }

    init(){

    }

    update(entityObject){
        this.rb.body.setCollisionFlags(2)
        this.rb.position.set(entityObject.pos.x, entityObject.pos.y, entityObject.pos.z)
        this.rb.rotation.set(entityObject.rot.x, entityObject.rot.y, entityObject.rot.z)
        this.rb.body.needUpdate = true;
    }
}


