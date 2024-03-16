var _ammo = require('@enable3d/ammo-on-nodejs/ammo/ammo.js')
const { Physics, ServerClock, ExtendedObject3D } = require('@enable3d/ammo-on-nodejs')

const express = require('express')
const app = express()
const path = require('path')

app.use(express.static('public'))
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')))
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')))
app.use('/nebulaBuild/', express.static(path.join(__dirname, 'node_modules/three-nebula/build')))

const server = app.listen(3000)

const socket = require('socket.io')
const io = socket(server)

io.eio.pingTimeout = 1000;
io.eio.pingInterval = 2000;


class NetworkManager {
    constructor() {
        // start server scene

        this.serverScene = new ServerScene(this)
        this.players = {}

        this.redTeam = []
        this.blueTeam = []
    }

    onConnection(socket) {
        console.log('new connection', socket.id)

        if (this.redTeam.length <= this.blueTeam.length){
            this.redTeam.push(socket.id)
        } else {
            this.blueTeam.push(socket.id)
        }

        this.players[socket.id] = new BackendPlayer(this, socket, this.serverScene, this.redTeam.length <= this.blueTeam.length ? 'red' : 'blue')                                                           
    }

    onDisconnection(socket) {
        console.log('disconnection', socket.id)

        if (this.redTeam.includes(socket.id)){
            this.redTeam.splice(this.redTeam.indexOf(socket.id), 1)
        }

        if (this.blueTeam.includes(socket.id)){
            this.blueTeam.splice(this.blueTeam.indexOf(socket.id), 1)
        }
        this.serverScene.physics.destroy(this.players[socket.id].rb)
        io.emit('deleteEntity', {id: socket.id})
        delete this.players[socket.id]
    }

}

class StatePacket{
    constructor(pos, rot, linearVel, angularVel, frameID){
      this.pos = {x: pos.x, y: pos.y, z: pos.z};
      this.rot = {x: rot.x, y: rot.y, z: rot.z, w: rot.w};
  
  
      this.linearVel = {x: linearVel.x, y: linearVel.y, z: linearVel.z};
  
      this.angularVel = {x: angularVel.x, y: angularVel.y, z: angularVel.z, w: angularVel.w};
  
      this.frameID = frameID;
    }
  }

class EntitiesPacket{
    constructor(players){
        this.entities = {}
        for (const id in players){
            players[id].rb.body.transform()

            this.entities[id] = {
              pos: {x: players[id].rb.position.x, y: players[id].rb.position.y, z: players[id].rb.position.z}, 
              rot: {x: players[id].rot.x, y: players[id].rot.y, z: players[id].rot.z}, 
              velocity: {x: players[id].rb.body.velocity.x, y: players[id].rb.body.velocity.y, z: players[id].rb.body.velocity.z},
              animState: players[id].currentAnimState,
              team: players[id].team
            }
        }
    }
}


class BackendPlayer {
    constructor(networkManager, socket, scene, team) {
        this.networkManager = networkManager;
        this.socket = socket
        this.scene = scene
        this.currentAnimState = 'Idle'
        this.queuedPacket = {}
        this.orientation = {}
        this.rot = {x: 0, y: 0, z: 0};
        this.team = team

        this.init()
    }

    init() {
        const tempObj = new ExtendedObject3D()

        const body = this.scene.factory.add.box({ height: 2.3, width: 0.75, depth: 0.5 }, { lambert: { color: 0xffff00 } })
        const head = this.scene.factory.add.sphere({ radius: 0.3, y: 1.4, z: -0.17 }, { lambert: { color: 0xffff00 } })

        tempObj.add(body, head)
        tempObj.position.set(0, 20, 0)


        this.scene.factory.add.existing(tempObj)
        this.scene.physics.add.existing(tempObj)
        this.scene.objects.push(tempObj)

        //this.rb = this.scene.physics.add.box({ y: 20}, { lambert: { color: 'hotpink' }})

        this.rb = tempObj

        this.rb.body.setFriction(1.2)
        this.scene.objects.push(this.rb)

        this.socket.emit('createPlayer', {id: this.socket.id, pos: {x: this.rb.position.x, y: this.rb.position.y, z: this.rb.position.z}, rot: {x: this.rb.rotation.x, y: this.rb.rotation.y, z: this.rb.rotation.z, w: this.rb.rotation.w}, team: this.team})


        this.socket.on('clientPacket', (packet) => {
          const inputs = packet.inputs;
          const frameID = packet.frameID;
          const socketID = this.socket.id;
          this.currentAnimState = packet.animState;
          this.orientation = packet.orientation
          this.rot = packet.rot;
          


          
          this.queuedPacket = {inputs, frameID, socketID, animState: this.currentAnimState, orientation: this.orientation, rot: this.rot, team: this.team, weaponPos: packet.weaponPos};
        });
      }

    applyMovements(){
      for (const input in this.queuedPacket.inputs){
        

        let speed = 5;
        

        const vel = this.rb.body.velocity;
        const forward = this.queuedPacket.orientation.forward;
        const right = this.queuedPacket.orientation.right;
        const left = this.queuedPacket.orientation.left;
        const back = this.queuedPacket.orientation.back;
        
        
        if (input === 'up' && this.queuedPacket.inputs[input] === true){
          this.rb.body.setVelocity(forward.x * speed, forward.y, forward.z * speed)
        }
        if (input === 'down' && this.queuedPacket.inputs[input] === true){
          this.rb.body.setVelocity(back.x * speed, back.y, back.z * speed)
        }
        if (input === 'left' && this.queuedPacket.inputs[input] === true){
          this.rb.body.setVelocity(left.x * speed, left.y, left.z * speed)
        }
        if (input === 'right' && this.queuedPacket.inputs[input] === true){
          this.rb.body.setVelocity(right.x * speed, right.y, right.z * speed)
        }
      }
    }

    sendState(socketToResolve, statePacket){
      socketToResolve.emit('resolveState', statePacket)
    }

    update(delta) {
      // this is very similar to the client side raycasting code but doesn't work with amoo physcis
      // To  get his working I would need to implement the correct ammo js raycasting code instead of the cleint side enable.io code


      // for (const input in this.queuedPacket.inputs){
      //   if (input === "shoot" && this.queuedPacket.inputs[input]){
      //     const weaponPos = this.queuedPacket.weaponPos
      //     const cameraQuat = new Ammo.btQuaternion().setEulerZYX(this.rot.y, this.rot.x, this.rot.z)

      //     const raycaster = this.scene.physics.add.raycaster('allHits')
          
      //     raycaster.setRayFromWorld(weaponPos.x, weaponPos.y, weaponPos.z)

      //     const direction = new Ammo.btVector3(0, 0, -1).rotate(cameraQuat)
      //     raycaster.setRayToWorld(weaponPos.x + direction.x * 100, weaponPos.y + direction.y * 100, weaponPos.z + direction.z * 100)
      //     raycaster.rayTest()

      //     if (raycaster.hasHit()) {
      //         raycaster.getCollisionObjects().forEach((obj, i) => {
      //           const { x, y, z } = raycaster.getHitPointsWorld()[i]

      //           console.log('allHits: ', `${obj}:`, `x:${x.toFixed(2)}`, `y:${y.toFixed(2)}`, `z:${z.toFixed(2)}`)

      //           if (obj.customTeamTag === 'red'){
      //             console.log('hit red player!')
      //           }
      //         })
      //     }

      //     raycaster.destroy()
      //   }
      // }

    }
}



class ServerScene {
  constructor(networkManager) {
    this.networkManager = networkManager

    this.init()
    this.create()
  }

  init() {
    // test if we have access to Ammo
    console.log('Ammo', new Ammo.btVector3(1, 2, 3).y() === 2)

    // init the Physics
    this.physics = new Physics()
    this.factory = this.physics.factory
  }

  create() {
    const ground = this.physics.add.box({
      name: 'ground',
      width: 40,
      depth: 40,
      collisionFlags: 2,
      mass: 0
    })

    ground.position.set(0, 0, 0)



    this.objects = [ground]

    // clock
    const clock = new ServerClock()

    // for debugging you disable high accuracy
    // high accuracy uses much more cpu power
    if (process.env.NODE_ENV !== 'production') clock.disableHighAccuracy()

    clock.onTick(delta => this.update(delta))
  }

  update(delta) {

    const players = this.networkManager.players
    for (const playerID in players){
      players[playerID].applyMovements();
      players[playerID].update(delta)

      players[playerID].rb.body.transform()
      players[playerID].rb.body.ammo.setAngularFactor(new Ammo.btVector3(0, 0, 0))

    }

    this.physics.update(delta * 1000)



    for (const playerID in players){
        if (players[playerID].queuedPacket.frameID ){
            players[playerID].rb.body.transform()
            const statePacketToSend = new StatePacket(players[playerID].rb.position, players[playerID].rb.rotation, players[playerID].rb.body.velocity, players[playerID].rb.body.angularVelocity, players[playerID].queuedPacket.frameID)
            const socketToResolve = players[playerID].socket;
            players[playerID].sendState(socketToResolve, statePacketToSend);
            this.queuedPacket = {}
        }
    }



    io.emit('updateEntities', new EntitiesPacket(players))

    // TODO
    // send new positions to the client
  }

}



// wait for Ammo to be loaded

_ammo().then(ammo => {
    globalThis.Ammo = ammo

    
    let networkManager = new NetworkManager()

    io.on('connection', socket => {
        networkManager.onConnection(socket)
    
        socket.on('disconnect', () => networkManager.onDisconnection(socket))
    });
})





