import { ExtendedObject3D, Loaders } from "@enable3d/ammo-on-nodejs";
import * as THREE from "three";


class LoadJsonToServer{
    constructor(serverScene, jsonObject){
        this.serverScene = serverScene;
        this.json = jsonObject;
    }

    loadLevel(){
        for (const object of this.json.sceneObjects){
            if (object.type === "gltf"){
                const GltfLoader = new Loaders.GLTFLoader();
                GltfLoader.load(path.resolve(__dirname, object.path), (gltf) => {
                    gltf.scene.position.set(object.x, object.y, object.z);
                    gltf.scene.rotation.set(object.rotationX, object.rotationY, object.rotationZ);
                    gltf.scene.scale.set(object.scaleX, object.scaleY, object.scaleZ);
                    
                    const physicsOptions = {
                        addChildren: true,
                        shape: "hacd",
                        mass: 0
                    };

                    const object = new ExtendedObject3D();

                    object.add(gltf.scene);


                    this.serverScene.factory.add.existing(object);
                    this.serverScene.physics.add.existing(object, physicsOptions);
                    this.serverScene.objects.push(object);

                });
            }

            if (object.type === "cube" || object.type === "box"){
                const tempBox = this.serverScene.physics.add.box({
                    name: object.name, 
                    width: object.width, 
                    height: object.height, 
                    depth: object.depth, 
                    x: object.x, 
                    y: object.y, 
                    z: object.z, 
                    mass: 0, 
                    collisionFlags: 2
                });
                
            }


        }
    }


    
}


class LoadJsonToClient{
    constructor(clientScene, jsonObject){
        this.clientScene = clientScene;
        this.json = jsonObject;
    }

    loadLevel(){
        for (const object of this.json.sceneObjects){
            if (object.type === "gltf"){
                this.clientScene.load.gltf(object.path, (gltf) => {
                    gltf.scene.position.set(object.x, object.y, object.z);
                    gltf.scene.rotation.set(object.rotationX, object.rotationY, object.rotationZ);
                    gltf.scene.scale.set(object.scaleX, object.scaleY, object.scaleZ);
                    this.clientScene.add.existing(gltf.scene);
                });
            }

            if (object.type === "cube" || object.type === "box"){
                const tempBox = new THREE.Mesh(
                    new THREE.BoxGeometry(object.width, object.height, object.depth),
                    new THREE.MeshBasicMaterial({color: 0x00ff00})
                );

                tempBox.position.set(object.x, object.y, object.z);
                tempBox.rotation.set(object.rotationX, object.rotationY, object.rotationZ);
                tempBox.scale.set(object.scaleX, object.scaleY, object.scaleZ);

                this.clientScene.add(tempBox);
            }
        }
    }
}