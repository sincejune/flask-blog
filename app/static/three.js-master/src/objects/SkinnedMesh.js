/**
 * @author mikael emtinger / http://gomo.se/
 * @author alteredq / http://alteredqualia.com/
 * @author ikerr / http://verold.com
 */

THREE.SkinnedMesh = function (geometry, material, useVertexTexture) {

    THREE.Mesh.call(this, geometry, material);

    this.type = 'SkinnedMesh';

    this.bindMode = "attached";
    this.bindMatrix = new THREE.Matrix4();
    this.bindMatrixInverse = new THREE.Matrix4();

    // init bones

    // TODO: remove bone creation as there is no reason (other than
    // convenience) for THREE.SkinnedMesh to do this.

    var bones = [];

    if (this.geometry && this.geometry.bones !== undefined) {

        var bone, gbone;

        for (var b = 0, bl = this.geometry.bones.length; b < bl; ++b) {

            gbone = this.geometry.bones[b];

            bone = new THREE.Bone(this);
            bones.push(bone);

            bone.name = gbone.name;
            bone.position.fromArray(gbone.pos);
            bone.quaternion.fromArray(gbone.rotq);
            if (gbone.scl !== undefined) bone.scale.fromArray(gbone.scl);

        }

        for (var b = 0, bl = this.geometry.bones.length; b < bl; ++b) {

            gbone = this.geometry.bones[b];

            if (gbone.parent !== -1 && gbone.parent !== null &&
                bones[gbone.parent] !== undefined) {

                bones[gbone.parent].add(bones[b]);

            } else {

                this.add(bones[b]);

            }

        }

    }

    this.normalizeSkinWeights();

    this.updateMatrixWorld(true);
    this.bind(new THREE.Skeleton(bones, undefined, useVertexTexture), this.matrixWorld);

};


THREE.SkinnedMesh.prototype = Object.assign(Object.create(THREE.Mesh.prototype), {

    constructor: THREE.SkinnedMesh,

    bind: function (skeleton, bindMatrix) {

        this.skeleton = skeleton;

        if (bindMatrix === undefined) {

            this.updateMatrixWorld(true);

            this.skeleton.calculateInverses();

            bindMatrix = this.matrixWorld;

        }

        this.bindMatrix.copy(bindMatrix);
        this.bindMatrixInverse.getInverse(bindMatrix);

    },

    pose: function () {

        this.skeleton.pose();

    },

    normalizeSkinWeights: function () {

        if (this.geometry instanceof THREE.Geometry) {

            for (var i = 0; i < this.geometry.skinWeights.length; i++) {

                var sw = this.geometry.skinWeights[i];

                var scale = 1.0 / sw.lengthManhattan();

                if (scale !== Infinity) {

                    sw.multiplyScalar(scale);

                } else {

                    sw.set(1, 0, 0, 0); // do something reasonable

                }

            }

        } else if (this.geometry instanceof THREE.BufferGeometry) {

            var vec = new THREE.Vector4();

            var skinWeight = this.geometry.attributes.skinWeight;

            for (var i = 0; i < skinWeight.count; i++) {

                vec.x = skinWeight.getX(i);
                vec.y = skinWeight.getY(i);
                vec.z = skinWeight.getZ(i);
                vec.w = skinWeight.getW(i);

                var scale = 1.0 / vec.lengthManhattan();

                if (scale !== Infinity) {

                    vec.multiplyScalar(scale);

                } else {

                    vec.set(1, 0, 0, 0); // do something reasonable

                }

                skinWeight.setXYZW(i, vec.x, vec.y, vec.z, vec.w);

            }

        }

    },

    updateMatrixWorld: function (force) {

        THREE.Mesh.prototype.updateMatrixWorld.call(this, true);

        if (this.bindMode === "attached") {

            this.bindMatrixInverse.getInverse(this.matrixWorld);

        } else if (this.bindMode === "detached") {

            this.bindMatrixInverse.getInverse(this.bindMatrix);

        } else {

            console.warn('THREE.SkinnedMesh unrecognized bindMode: ' + this.bindMode);

        }

    },

    clone: function () {

        return new this.constructor(this.geometry, this.material, this.useVertexTexture).copy(this);

    }

});
