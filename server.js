var _ammo = require('@enable3d/ammo-on-nodejs/ammo/ammo.js')
const { Physics, ServerClock } = require('@enable3d/ammo-on-nodejs')

const express = require('express')
const app = express()

app.use(express.static('public'))

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
        this.players[socket.id] = new BackendPlayer(socket, this.serverScene)                                                           
    }

    onDisconnection(socket) {
        console.log('disconnection', socket.id)
        delete this.players[socket.id]
    }
}

class BackendPlayer {
    constructor(socket, scene) {
        this.socket = socket
        this.scene = scene

        this.init()
    }

    init() {
        this.rb = this.scene.physics.add.box({ y: 20}, { lambert: { color: 'hotpink' }})
        this.scene.objects.push(this.rb)
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
    this.physics.update(delta * 1000)

    for (const playerId in this.networkManager.players) {
        
        const player = this.networkManager.players[playerId]
        const physBody = player.rb

        this.networkManager.players[playerId].socket.emit('setPos', {
            pos: { x: physBody.position.x.toFixed(2), y:physBody.position.y.toFixed(2), z:physBody.position.z.toFixed(2)}
            
        })         
    }

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





