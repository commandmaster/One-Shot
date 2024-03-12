const { Project, Scene3D, PhysicsLoader, THREE } = ENABLE3D

class MainScene extends Scene3D {
    constructor() {
        super('MainScene')
    }


    init() {
        console.log('init')

        this.renderer.setPixelRatio(1)
        this.renderer.setSize(window.innerWidth, window.innerHeight)

        this.player = new PlayerClient(socket, this)
    }

    preload() {
        console.log('preload')
    }

    create() {
        console.log('create')

        // set up scene (light, ground, grid, sky, orbitControls)
        this.warpSpeed('-ground')

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

        // green sphere
        const geometry = new THREE.SphereGeometry(0.8, 16, 16)
        const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
        const cube = new THREE.Mesh(geometry, material)
        cube.position.set(0.2, 3, 0)
        this.scene.add(cube)
        // add physics to an existing object
        this.physics.add.existing(cube)
    }

    update() {


        
    }
}

// load from '/lib/ammo/kripken' or '/lib/ammo/moz'
let socket = io.connect('http://localhost:3000')
PhysicsLoader('/lib/ammo/kripken', () => {
    new Project({ scenes: [MainScene], antialias: true })
});

class PlayerClient{
    constructor(socket, scene){
        this.socket = socket;
        this.scene = scene;

        this.init();

        socket.on('setPos', (data) => {
            this.rb.body.setCollisionFlags(2);
            this.rb.position.set(data.pos.x, data.pos.y, data.pos.z);
            this.rb.body.needUpdate = true;
            //this.rb.rotation.set(data.rot.x, data.rot.y, data.rot.z);

            console.log('setPos', data.pos.x, data.pos.y, data.pos.z)
        });
        
    }

    init(){
        this.rb = this.scene.physics.add.box({ y: 5, z: 5 }, { lambert: { color: 'hotpink' }});

        this.rb.body.once.update(() => {
            this.rb.body.setCollisionFlags(0)

            this.rb.body.setVelocity(0, 0, 0)
            this.rb.body.setAngularVelocity(0, 0, 0)
        })
    }

    update(){
        
    }
}


