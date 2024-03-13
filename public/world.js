
class ClientWorld {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(10, 10, 20)

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);


        this.renderer.setPixelRatio(1)
        this.renderer.setSize(window.innerWidth, window.innerHeight)

        const resize = () => {
            const newWidth = window.innerWidth
            const newHeight = window.innerHeight

            this.renderer.setSize(newWidth, newHeight)
            this.camera.aspect = newWidth / newHeight
            this.camera.updateProjectionMatrix()
        }

        window.onresize = resize
        resize()
        

        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls = controls;


        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 1))
        this.scene.add(new THREE.AmbientLight(0xffffff, 1))
        const light = new THREE.DirectionalLight(0xffffff, 1)
        light.position.set(50, 200, 100)
        light.position.multiplyScalar(1.3)

        this.physics = new AmmoPhysics(this.scene)
        this.physics.debug.enable()

        const {factory} = this.physics;
        this.factory = factory;

        const ground = factory.add.box({ name: 'ground', width: 40, depth: 40, mass: 0, collisionFlags: 2 })
        this.clock = new THREE.Clock()

        this.initGame();
    }

    initGame(){
        console.log('init')
        this.entities = {}

        let socket = io.connect('http://localhost:3000')
        this.socket = socket;

        this.socket.on('createPlayer', (packet) => {
            this.player = new PlayerClient(this.socket, this, packet)
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

            if (packet.entities.length < this.entities.length){
                for (const id in this.entities){
                    if (!packet.entities[id]){
                        this.physics.destroy(this.entities[id].rb)
                        this.scene.remove(this.entities[id].rb)
                        delete this.entities[id]
                    }
                }
            }
        });

        this.socket.on("deleteEntity", (packet) => {
            this.physics.destroy(this.entities[packet.id].rb)
            this.scene.remove(this.entities[packet.id].rb)
            delete this.entities[packet.id]
        })
        

        this.sentPacketBuffer = {};
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

    update(){
        if (this.player){
            this.player.applyMovements(this.currentInputs)
            this.socket.emit("clientPacket", { inputs: this.currentInputs, frameID: this.frameID })
            
            this.sentPacketBuffer[this.frameID] = {inputs: this.currentInputs, frameID: this.frameID, state: { pos: this.player.rb.position, rot: this.player.rb.rotation, linearVel: this.player.rb.body.velocity, angularVel: this.player.rb.body.angularVelocity}}
            this.frameID++;

            if (this.playerModel){
                this.playerModel.position.set(this.player.rb.position.x, this.player.rb.position.y, this.player.rb.position.z)
                this.playerModel.rotation.set(this.player.rb.rotation.x, this.player.rb.rotation.y, this.player.rb.rotation.z, this.player.rb.rotation.w)
            
            }
        }
    

        this.physics.update(this.clock.getDelta() * 1000);
        thhis.physics.updateDebugger()
        this.controls.update()
        
        this.renderer.render(this.scene, this.camera);

        

        requestAnimationFrame(() => this.update())
    }
}
