var _ammo = require('@enable3d/ammo-on-nodejs/ammo/ammo.js')
const { Physics, ServerClock } = require('@enable3d/ammo-on-nodejs')

const express = require('express')
const app = express()
const path = require('path')

app.use(express.static('public'))
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')))
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')))

const server = app.listen(3000)

const socket = require('socket.io')
const io = socket(server)

class NetworkManager {
    constructor() {
        // start server scene
        this.serverScene = new ServerScene(this)
        this.players = {}
    }

    onConnection(socket) {
        console.log('new connection', socket.id)
        this.players[socket.id] = new BackendPlayer(this, socket, this.serverScene)                                                           
    }

    onDisconnection(socket) {
        console.log('disconnection', socket.id)
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
            this.entities[id] = {pos: {x: players[id].rb.position.x, y: players[id].rb.position.y, z: players[id].rb.position.z}, rot: {x: players[id].rb.rotation.x, y: players[id].rb.rotation.y, z: players[id].rb.rotation.z, w: players[id].rb.rotation.w}}
        }
    }
}


class BackendPlayer {
    constructor(networkManager, socket, scene) {
        this.networkManager = networkManager;
        this.socket = socket
        this.scene = scene
        this.queuedPacket = {}

        this.socket.on('clientPacket', (packet) => {
          const inputs = packet.inputs;
          const frameID = packet.frameID;
          const socketID = this.socket.id;
          this.queuedPacket = {inputs, frameID, socketID};
        });

        this.init()
    }

    init() {
        this.rb = this.scene.physics.add.box({ y: 20}, { lambert: { color: 'hotpink' }})
        this.scene.objects.push(this.rb)

        this.socket.emit('createPlayer', {id: this.socket.id, pos: {x: this.rb.position.x, y: this.rb.position.y, z: this.rb.position.z}, rot: {x: this.rb.rotation.x, y: this.rb.rotation.y, z: this.rb.rotation.z, w: this.rb.rotation.w}})
    }

    applyMovements(){
      for (const input in this.queuedPacket.inputs){
        const speed = 2;
        if (input === 'up' && this.queuedPacket.inputs[input] === true){
          this.rb.body.applyForce(0, 0, -speed)
        }
        if (input === 'down' && this.queuedPacket.inputs[input] === true){
          this.rb.body.applyForce(0, 0, speed)
        }
        if (input === 'left' && this.queuedPacket.inputs[input] === true){
          this.rb.body.applyForce(-speed, 0, 0)
        }
        if (input === 'right' && this.queuedPacket.inputs[input] === true){
          this.rb.body.applyForce(speed, 0, 0)
        }
      }
    }

    sendState(socketToResolve, statePacket){
      socketToResolve.emit('resolveState', statePacket)
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
    }

    this.physics.update(delta * 1000)

    for (const playerID in players){
        if (players[playerID].queuedPacket.frameID ){
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





