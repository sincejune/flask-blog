/**
 *
 * Uniforms of a program.
 * Those form a tree structure with a special top-level container for the root,
 * which you get by calling 'new WebGLUniforms( gl, program, renderer )'.
 *
 *
 * Properties of inner nodes including the top-level container:
 *
 * .seq - array of nested uniforms
 * .map - nested uniforms by name
 *
 *
 * Methods of all nodes except the top-level container:
 *
 * .setValue( gl, value, [renderer] )
 *
 *        uploads a uniform value(s)
 *    the 'renderer' parameter is needed for sampler uniforms
 *
 *
 * Static methods of the top-level container (renderer factorizations):
 *
 * .upload( gl, seq, values, renderer )
 *
 *        sets uniforms in 'seq' to 'values[id].value'
 *
 * .seqWithValue( seq, values ) : filteredSeq
 *
 *        filters 'seq' entries with corresponding entry in values
 *
 * .splitDynamic( seq, values ) : filteredSeq
 *
 *        filters 'seq' entries with dynamic entry and removes them from 'seq'
 *
 *
 * Methods of the top-level container (renderer factorizations):
 *
 * .setValue( gl, name, value )
 *
 *        sets uniform with  name 'name' to 'value'
 *
 * .set( gl, obj, prop )
 *
 *        sets uniform from object and property with same name than uniform
 *
 * .setOptional( gl, obj, prop )
 *
 *        like .set for an optional property of the object
 *
 *
 * @author tschw
 *
 */

THREE.WebGLUniforms = (function () { // scope

    // --- Base for inner nodes (including the root) ---

    var UniformContainer = function () {

            this.seq = [];
            this.map = {};

        },

    // --- Utilities ---

    // Array Caches (provide typed arrays for temporary by size)

        arrayCacheF32 = [],
        arrayCacheI32 = [],

        uncacheTemporaryArrays = function () {

            arrayCacheF32.length = 0;
            arrayCacheI32.length = 0;

        },

    // Flattening for arrays of vectors and matrices

        flatten = function (array, nBlocks, blockSize) {

            var firstElem = array[0];

            if (firstElem <= 0 || firstElem > 0) return array;
            // unoptimized: ! isNaN( firstElem )
            // see http://jacksondunstan.com/articles/983

            var n = nBlocks * blockSize,
                r = arrayCacheF32[n];

            if (r === undefined) {

                r = new Float32Array(n);
                arrayCacheF32[n] = r;

            }

            if (nBlocks !== 0) {

                firstElem.toArray(r, 0);

                for (var i = 1, offset = 0; i !== nBlocks; ++i) {

                    offset += blockSize;
                    array[i].toArray(r, offset);

                }

            }

            return r;

        },

    // Texture unit allocation

        allocTexUnits = function (renderer, n) {

            var r = arrayCacheI32[n];

            if (r === undefined) {

                r = new Int32Array(n);
                arrayCacheI32[n] = r;

            }

            for (var i = 0; i !== n; ++i)
                r[i] = renderer.allocTextureUnit();

            return r;

        },

    // --- Setters ---

    // Note: Defining these methods externally, because they come in a bunch
    // and this way their names minify.

    // Single scalar

        setValue1f = function (gl, v) {
            gl.uniform1f(this.addr, v);
        },
        setValue1i = function (gl, v) {
            gl.uniform1i(this.addr, v);
        },

    // Single float vector (from flat array or THREE.VectorN)

        setValue2fv = function (gl, v) {

            if (v.x === undefined) gl.uniform2fv(this.addr, v);
            else gl.uniform2f(this.addr, v.x, v.y);

        },

        setValue3fv = function (gl, v) {

            if (v.x !== undefined)
                gl.uniform3f(this.addr, v.x, v.y, v.z);
            else if (v.r !== undefined)
                gl.uniform3f(this.addr, v.r, v.g, v.b);
            else
                gl.uniform3fv(this.addr, v);

        },

        setValue4fv = function (gl, v) {

            if (v.x === undefined) gl.uniform4fv(this.addr, v);
            else gl.uniform4f(this.addr, v.x, v.y, v.z, v.w);

        },

    // Single matrix (from flat array or MatrixN)

        setValue2fm = function (gl, v) {

            gl.uniformMatrix2fv(this.addr, false, v.elements || v);

        },

        setValue3fm = function (gl, v) {

            gl.uniformMatrix3fv(this.addr, false, v.elements || v);

        },

        setValue4fm = function (gl, v) {

            gl.uniformMatrix4fv(this.addr, false, v.elements || v);

        },

    // Single texture (2D / Cube)

        setValueT1 = function (gl, v, renderer) {

            var unit = renderer.allocTextureUnit();
            gl.uniform1i(this.addr, unit);
            if (v) renderer.setTexture2D(v, unit);

        },

        setValueT6 = function (gl, v, renderer) {

            var unit = renderer.allocTextureUnit();
            gl.uniform1i(this.addr, unit);
            if (v) renderer.setTextureCube(v, unit);

        },

    // Integer / Boolean vectors or arrays thereof (always flat arrays)

        setValue2iv = function (gl, v) {
            gl.uniform2iv(this.addr, v);
        },
        setValue3iv = function (gl, v) {
            gl.uniform3iv(this.addr, v);
        },
        setValue4iv = function (gl, v) {
            gl.uniform4iv(this.addr, v);
        },

    // Helper to pick the right setter for the singular case

        getSingularSetter = function (type) {

            switch (type) {

                case 0x1406:
                    return setValue1f; // FLOAT
                case 0x8b50:
                    return setValue2fv; // _VEC2
                case 0x8b51:
                    return setValue3fv; // _VEC3
                case 0x8b52:
                    return setValue4fv; // _VEC4

                case 0x8b5a:
                    return setValue2fm; // _MAT2
                case 0x8b5b:
                    return setValue3fm; // _MAT3
                case 0x8b5c:
                    return setValue4fm; // _MAT4

                case 0x8b5e:
                    return setValueT1; // SAMPLER_2D
                case 0x8b60:
                    return setValueT6; // SAMPLER_CUBE

                case 0x1404:
                case 0x8b56:
                    return setValue1i; // INT, BOOL
                case 0x8b53:
                case 0x8b57:
                    return setValue2iv; // _VEC2
                case 0x8b54:
                case 0x8b58:
                    return setValue3iv; // _VEC3
                case 0x8b55:
                case 0x8b59:
                    return setValue4iv; // _VEC4

            }

        },

    // Array of scalars

        setValue1fv = function (gl, v) {
            gl.uniform1fv(this.addr, v);
        },
        setValue1iv = function (gl, v) {
            gl.uniform1iv(this.addr, v);
        },

    // Array of vectors (flat or from THREE classes)

        setValueV2a = function (gl, v) {

            gl.uniform2fv(this.addr, flatten(v, this.size, 2));

        },

        setValueV3a = function (gl, v) {

            gl.uniform3fv(this.addr, flatten(v, this.size, 3));

        },

        setValueV4a = function (gl, v) {

            gl.uniform4fv(this.addr, flatten(v, this.size, 4));

        },

    // Array of matrices (flat or from THREE clases)

        setValueM2a = function (gl, v) {

            gl.uniformMatrix2fv(this.addr, false, flatten(v, this.size, 4));

        },

        setValueM3a = function (gl, v) {

            gl.uniformMatrix3fv(this.addr, false, flatten(v, this.size, 9));

        },

        setValueM4a = function (gl, v) {

            gl.uniformMatrix4fv(this.addr, false, flatten(v, this.size, 16));

        },

    // Array of textures (2D / Cube)

        setValueT1a = function (gl, v, renderer) {

            var n = v.length,
                units = allocTexUnits(renderer, n);

            gl.uniform1iv(this.addr, units);

            for (var i = 0; i !== n; ++i) {

                var tex = v[i];
                if (tex) renderer.setTexture2D(tex, units[i]);

            }

        },

        setValueT6a = function (gl, v, renderer) {

            var n = v.length,
                units = allocTexUnits(renderer, n);

            gl.uniform1iv(this.addr, units);

            for (var i = 0; i !== n; ++i) {

                var tex = v[i];
                if (tex) renderer.setTextureCube(tex, units[i]);

            }

        },


    // Helper to pick the right setter for a pure (bottom-level) array

        getPureArraySetter = function (type) {

            switch (type) {

                case 0x1406:
                    return setValue1fv; // FLOAT
                case 0x8b50:
                    return setValueV2a; // _VEC2
                case 0x8b51:
                    return setValueV3a; // _VEC3
                case 0x8b52:
                    return setValueV4a; // _VEC4

                case 0x8b5a:
                    return setValueM2a; // _MAT2
                case 0x8b5b:
                    return setValueM3a; // _MAT3
                case 0x8b5c:
                    return setValueM4a; // _MAT4

                case 0x8b5e:
                    return setValueT1a; // SAMPLER_2D
                case 0x8b60:
                    return setValueT6a; // SAMPLER_CUBE

                case 0x1404:
                case 0x8b56:
                    return setValue1iv; // INT, BOOL
                case 0x8b53:
                case 0x8b57:
                    return setValue2iv; // _VEC2
                case 0x8b54:
                case 0x8b58:
                    return setValue3iv; // _VEC3
                case 0x8b55:
                case 0x8b59:
                    return setValue4iv; // _VEC4

            }

        },

    // --- Uniform Classes ---

        SingleUniform = function SingleUniform(id, activeInfo, addr) {

            this.id = id;
            this.addr = addr;
            this.setValue = getSingularSetter(activeInfo.type);

            // this.path = activeInfo.name; // DEBUG

        },

        PureArrayUniform = function (id, activeInfo, addr) {

            this.id = id;
            this.addr = addr;
            this.size = activeInfo.size;
            this.setValue = getPureArraySetter(activeInfo.type);

            // this.path = activeInfo.name; // DEBUG

        },

        StructuredUniform = function (id) {

            this.id = id;

            UniformContainer.call(this); // mix-in

        };

    StructuredUniform.prototype.setValue = function (gl, value) {

        // Note: Don't need an extra 'renderer' parameter, since samplers
        // are not allowed in structured uniforms.

        var seq = this.seq;

        for (var i = 0, n = seq.length; i !== n; ++i) {

            var u = seq[i];
            u.setValue(gl, value[u.id]);

        }

    };

    // --- Top-level ---

    // Parser - builds up the property tree from the path strings

    var RePathPart = /([\w\d_]+)(\])?(\[|\.)?/g,
    // extracts
    // 	- the identifier (member name or array index)
    //  - followed by an optional right bracket (found when array index)
    //  - followed by an optional left bracket or dot (type of subscript)
    //
    // Note: These portions can be read in a non-overlapping fashion and
    // allow straightforward parsing of the hierarchy that WebGL encodes
    // in the uniform names.

        addUniform = function (container, uniformObject) {

            container.seq.push(uniformObject);
            container.map[uniformObject.id] = uniformObject;

        },

        parseUniform = function (activeInfo, addr, container) {

            var path = activeInfo.name,
                pathLength = path.length;

            // reset RegExp object, because of the early exit of a previous run
            RePathPart.lastIndex = 0;

            for (; ;) {

                var match = RePathPart.exec(path),
                    matchEnd = RePathPart.lastIndex,

                    id = match[1],
                    idIsIndex = match[2] === ']',
                    subscript = match[3];

                if (idIsIndex) id = id | 0; // convert to integer

                if (subscript === undefined ||
                    subscript === '[' && matchEnd + 2 === pathLength) {
                    // bare name or "pure" bottom-level array "[0]" suffix

                    addUniform(container, subscript === undefined ?
                        new SingleUniform(id, activeInfo, addr) :
                        new PureArrayUniform(id, activeInfo, addr));

                    break;

                } else {
                    // step into inner node / create it in case it doesn't exist

                    var map = container.map,
                        next = map[id];

                    if (next === undefined) {

                        next = new StructuredUniform(id);
                        addUniform(container, next);

                    }

                    container = next;

                }

            }

        },

    // Root Container

        WebGLUniforms = function WebGLUniforms(gl, program, renderer) {

            UniformContainer.call(this);

            this.renderer = renderer;

            var n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

            for (var i = 0; i !== n; ++i) {

                var info = gl.getActiveUniform(program, i),
                    path = info.name,
                    addr = gl.getUniformLocation(program, path);

                parseUniform(info, addr, this);

            }

        };


    WebGLUniforms.prototype.setValue = function (gl, name, value) {

        var u = this.map[name];

        if (u !== undefined) u.setValue(gl, value, this.renderer);

    };

    WebGLUniforms.prototype.set = function (gl, object, name) {

        var u = this.map[name];

        if (u !== undefined) u.setValue(gl, object[name], this.renderer);

    };

    WebGLUniforms.prototype.setOptional = function (gl, object, name) {

        var v = object[name];

        if (v !== undefined) this.setValue(gl, name, v);

    };


    // Static interface

    WebGLUniforms.upload = function (gl, seq, values, renderer) {

        for (var i = 0, n = seq.length; i !== n; ++i) {

            var u = seq[i],
                v = values[u.id];

            if (v.needsUpdate !== false) {
                // note: always updating when .needsUpdate is undefined

                u.setValue(gl, v.value, renderer);

            }

        }

    };

    WebGLUniforms.seqWithValue = function (seq, values) {

        var r = [];

        for (var i = 0, n = seq.length; i !== n; ++i) {

            var u = seq[i];
            if (u.id in values) r.push(u);

        }

        return r;

    };

    WebGLUniforms.splitDynamic = function (seq, values) {

        var r = null,
            n = seq.length,
            w = 0;

        for (var i = 0; i !== n; ++i) {

            var u = seq[i],
                v = values[u.id];

            if (v && v.dynamic === true) {

                if (r === null) r = [];
                r.push(u);

            } else {

                // in-place compact 'seq', removing the matches
                if (w < i) seq[w] = u;
                ++w;

            }

        }

        if (w < n) seq.length = w;

        return r;

    };

    WebGLUniforms.evalDynamic = function (seq, values, object, camera) {

        for (var i = 0, n = seq.length; i !== n; ++i) {

            var v = values[seq[i].id],
                f = v.onUpdateCallback;

            if (f !== undefined) f.call(v, object, camera);

        }

    };

    return WebGLUniforms;

})();

