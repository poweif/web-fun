/*
 * Copyright (c) 2009 The Chromium Authors. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *    * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var gl = null;
var model = new Matrix4x4();
var view = new Matrix4x4();
var projection = new Matrix4x4();
var controller = null;

var _programObj;
var _width;
var _height;

var _meshVertsTxt = [];
var _meshIndsTxt = [];
var _meshNormsTxt = [];

var _meshVerts;
var _meshInds;
var _meshNorms;

var _meshNormsOffset; 

var _ibo;
var _vbo; 

function main() {

    var c = document.getElementById("c");
    c.addEventListener('webglcontextlost', handleContextLost, false);
    c.addEventListener('webglcontextrestored', handleContextRestored, false);

    var ratio = window.devicePixelRatio ? window.devicePixelRatio : 1;
    c.width = 800 * ratio;
    c.height = 600 * ratio;

    _width = c.width;
    _height = c.height;

    gl = WebGLUtils.setupWebGL(c);
    if (!gl)
        return;
    controller = new CameraController(c);
    
    controller.onchange = function (xRot, yRot) {
        draw();
    };
    
    var req = new XMLHttpRequest();
    req.open('GET', 'horse.txt');
    req.onloadend =
        function () {
            var data = this.responseText;
            //log(data);
            var mesh = readMesh(data);
            //log(mesh.verts.length);
            //log(mesh.inds.length);
            init();
        };    
    req.send();
}

function log(msg) {
    if (window.console && window.console.log) {
        console.log(msg);
    }
}

function readMesh(text) {
    var lines = String(text).split("\n");

    var numVerts = parseInt(lines[0]);
    var verts = [];
    for (var j = 0; j < numVerts; j++) {
        var ks = lines[j + 1].split(" ");
        var vec = new THREE.Vector3(parseFloat(ks[0]), parseFloat(ks[1]), parseFloat(ks[2]));
        verts.push(vec);
        _meshVertsTxt.push(vec.x);
        _meshVertsTxt.push(vec.y);
        _meshVertsTxt.push(vec.z);
    }

    var numInds = parseInt(lines[numVerts+1]);
    var inds = [];
    for (var j = 0; j < numInds; j++) {
        var ks = String(lines[j + numVerts+2]).split(" ");
        var ii = [parseInt(ks[0]), parseInt(ks[1]), parseInt(ks[2])];
        inds.push(ii);
        _meshIndsTxt.push(ii[0]);
        _meshIndsTxt.push(ii[1]);
        _meshIndsTxt.push(ii[2]);
    }

    var norms = [];
    for (var ji = 0; ji < numVerts; ji++)
        norms.push(new THREE.Vector3(0, 0, 0));

    for (var ti = 0; ti < inds.length;ti++) {
        var tri = inds[ti];
        var p0 = verts[tri[0]];
        var p1 = verts[tri[1]];
        var p2 = verts[tri[2]];

        var v0 = new THREE.Vector3(0, 0, 0);
        var v1 = new THREE.Vector3(0, 0, 0);
        v0.subVectors(p1, p0);
        v1.subVectors(p2, p0);
        
        var vx = new THREE.Vector3(0, 0, 0);
        vx.crossVectors(v0, v1);
        norms[tri[0]].add(vx);
        norms[tri[1]].add(vx);
        norms[tri[2]].add(vx);
    }

    for (var ji = 0; ji < norms.length; ji++) {
        norms[ji].normalize();
        _meshNormsTxt.push(norms[ji].x);
        _meshNormsTxt.push(norms[ji].y);
        _meshNormsTxt.push(norms[ji].z);
    }
    
    var mesh = new Object();
    mesh.verts = verts;
    mesh.inds = inds;
    mesh.norms = norms;
    return mesh;
}

function handleContextLost(e) {
    log("handle context lost");
    e.preventDefault();
    clearLoadingImages();
}

function handleContextRestored() {
    log("handle context restored");
    init();
}


function output(str) {
    document.body.appendChild(document.createTextNode(str));
    document.body.appendChild(document.createElement("br"));
}

function checkGLError() {
    var error = gl.getError();
    if (error != gl.NO_ERROR && error != gl.CONTEXT_LOST_WEBGL) {
        var str = "GL Error: " + error;
        output(str);
        throw str;
    }
}

function init() {
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    initShaders();
    initMesh();
    draw();
}


var bumpReflectVertexSource = [
    "uniform mat4 world;",
    "uniform mat4 worldInverseTranspose;",
    "uniform mat4 worldViewProj;",
    "uniform mat4 viewInverse;",
    "attribute vec4 vertex; ",
    "attribute vec3 normal; ",
    "",
    "varying vec3 worldEyeVec;",
    "varying vec3 worldNormal;",
    "varying vec3 worldPos;",
    "",
    "void main() {",
    "  gl_Position = worldViewProj * vec4(vertex.xyz, 1.);",
    "  worldNormal = (worldInverseTranspose * vec4(normal, 1.)).xyz;",
    "  worldPos = (world * vec4(vertex.xyz, 1.)).xyz;",
    "  worldEyeVec = normalize(worldPos - viewInverse[3].xyz);",
    "}"
].join("\n");

var bumpReflectFragmentSource = [
    "precision mediump float;\n",
    "",
    "varying vec3 worldEyeVec;",
    "varying vec3 worldNormal;",
    "varying vec3 worldPos;",
    "",
    "void main() {",
    "  float specCoeff = 10.0; ",
    "  vec3 lightpos = vec3(0,1.5,5);",
    "  vec3 L = normalize(lightpos-worldPos);",
    "  vec3 N = normalize(worldNormal);",
    "  vec3 R = 2.*dot(N,L)*N-L; ",
    "  vec3 V = worldEyeVec; ",
    "  float diff = dot(N,L)*.6;",
    "  float amb = .3;",
    "  float spec = (pow(dot(R,V),specCoeff) * .5);",
    "  gl_FragColor = vec4(vec3(.7,.99,.7)*(amb+diff) + vec3(spec),1);",
    "}"
].join("\n");

function loadShader(type, shaderSrc) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, shaderSrc);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) &&
        !gl.isContextLost()) {
        var infoLog = gl.getShaderInfoLog(shader);
        output("Error compiling shader:\n" + infoLog);
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initShaders() {
    var vertexShader = loadShader(gl.VERTEX_SHADER, bumpReflectVertexSource);
    
    var fragmentShader = loadShader(gl.FRAGMENT_SHADER, bumpReflectFragmentSource);
    // Create the program object
    var programObject = gl.createProgram();
    gl.attachShader(programObject, vertexShader);
    gl.attachShader(programObject, fragmentShader);

    // Bind Attributes
    gl.bindAttribLocation(programObject, 0, "vertex");
    gl.bindAttribLocation(programObject, 1, "normal");

    // Link the program
    gl.linkProgram(programObject);
    // Check the link status
    var linked = gl.getProgramParameter(programObject, gl.LINK_STATUS);
    if (!linked && !gl.isContextLost()) {
        var infoLog = gl.getProgramInfoLog(programObject);
        output("Error linking program:\n" + infoLog);
        gl.deleteProgram(programObject);
        return;
    }
    _programObj = programObject;
    // Look up uniform locations
    _worldLoc = gl.getUniformLocation(_programObj, "world");
    _worldInverseTransposeLoc = gl.getUniformLocation(_programObj, "worldInverseTranspose");
    _worldViewProjLoc = gl.getUniformLocation(_programObj, "worldViewProj");
    _viewInverseLoc = gl.getUniformLocation(_programObj, "viewInverse");
    checkGLError();
}

function initMesh() {
    _meshVerts = new Float32Array(_meshVertsTxt);
    _meshInds = new Uint16Array(_meshIndsTxt);
    _meshNorms = new Float32Array(_meshNormsTxt);

    _vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, _vbo);
    gl.bufferData(gl.ARRAY_BUFFER, _meshVerts.byteLength + _meshNorms.byteLength, gl.STATIC_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, _meshVerts);
    _meshNormsOffset = _meshVerts.byteLength;
    gl.bufferSubData(gl.ARRAY_BUFFER, _meshNormsOffset, _meshNorms);

    _ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, _meshInds, gl.STATIC_DRAW);
}

function draw() {
    // Note: the viewport is automatically set up to cover the entire Canvas.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    checkGLError();

      // Set up the model, view and projection matrices
    projection.loadIdentity();
    projection.perspective(45, _width / _height, .2, 50);
    view.loadIdentity();
    view.translate(0, 0, -3.0);

    // Add in camera controller's rotation
    model.loadIdentity();
    model.rotate(controller.xRot, 1, 0, 0);
    model.rotate(controller.yRot, 0, 1, 0);

    gl.useProgram(_programObj);

    // Compute necessary matrices
    var mvp = new Matrix4x4();
    mvp.multiply(model);
    mvp.multiply(view);
    mvp.multiply(projection);
    var worldInverseTranspose = model.inverse();
    worldInverseTranspose.transpose();
    var viewInverse = view.inverse();

    // Set up uniforms
    gl.uniformMatrix4fv(_worldLoc, gl.FALSE, new Float32Array(model.elements));
    gl.uniformMatrix4fv(_worldInverseTransposeLoc, gl.FALSE, new Float32Array(worldInverseTranspose.elements));
    gl.uniformMatrix4fv(_worldViewProjLoc, gl.FALSE, new Float32Array(mvp.elements));
    gl.uniformMatrix4fv(_viewInverseLoc, gl.FALSE, new Float32Array(viewInverse.elements));

    gl.bindBuffer(gl.ARRAY_BUFFER, _vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, _meshNormsOffset);
    gl.enableVertexAttribArray(1);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _ibo);
    gl.drawElements(gl.TRIANGLES, _meshInds.length, gl.UNSIGNED_SHORT, 0);
    checkGLError();
}

