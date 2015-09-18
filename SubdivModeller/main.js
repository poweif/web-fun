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
var _controller = null;

var _shaderPhong = null;
var _shaderWireframe = null;
var _shaderPointWidget = null;

var _width;
var _height;

var _controlMesh = new RMesh();
var _subdivMesh = new RMesh();
_subdivMesh.vbo = null;
_subdivMesh.nbo = null;
var _pointWidgetVbo;

var POINT_WIDGET_RANGE = .17;

function main() {
    var c = document.getElementById("c");
    c.addEventListener('webglcontextlost', handleContextLost, false);
    c.addEventListener('webglcontextrestored', handleContextRestored, false);

    var ratio = window.devicePixelRatio ? window.devicePixelRatio : 1;
    var mwidth = document.getElementById("c").getAttribute("style");
    
    _width = c.width;
    _height = c.height;

    gl = WebGLUtils.setupWebGL(c);
    if (!gl)
        return;
    _controller = new InputController(document, c, _controlMesh);
    
    _controller.onchange = function (xRot, yRot) {
        draw();
    };

    _controller.onMouseMove = function () {
        draw();
    };

    _controller.updateMeshes = function () {
        updateMeshes();
        draw();
    }

    init();
}

function log(msg) {
    if (window.console && window.console.log) {
        console.log(msg);
    }
}

function vstr(msg) {
    return (msg.x + " " + msg.y + " " + msg.z);
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
    gl.lineWidth(2);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    _shaderPhong = initPhongShaders(gl);
    _shaderWireframe = initWireframeShaders(gl);
    _shaderPointWidget = initPointWidgetShaders(gl);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    initMesh();
    draw();
}

function initMesh() {
    _controlMesh.addVert(-1, -1, -1);
    _controlMesh.addVert(1, -1, -1);
    _controlMesh.addVert(-1, 1, -1);
    _controlMesh.addVert(1, 1, -1);
    _controlMesh.addVert(-1, -1, 1);
    _controlMesh.addVert(1, -1, 1);
    _controlMesh.addVert(-1, 1, 1);
    _controlMesh.addVert(1, 1, 1);

    _controlMesh.addQuad(0, 1, 3, 2);
    _controlMesh.addQuad(1, 5, 7, 3);
    _controlMesh.addQuad(5, 4, 6, 7);
    _controlMesh.addQuad(4, 0, 2, 6);
    _controlMesh.addQuad(2, 3, 7, 6);
    _controlMesh.addQuad(4, 5, 1, 0);

    //_controlMesh.splitFace(0);
    _controlMesh.faces = _controlMesh.quads;
    
    updateMeshes();

    var sc = .3;
    var pwmesh = createPointWidgetMeshes(); 
    var pwcolors = [];

    for (var i = 0; i < 18; i++) {
        pwcolors.push(1);
        pwcolors.push(0);
        pwcolors.push(0);
    }
    for (var i = 0; i < 18; i++) {
        pwcolors.push(0);
        pwcolors.push(1);
        pwcolors.push(0);
    }
    for (var i = 0; i < 18; i++) {
        pwcolors.push(0);
        pwcolors.push(0);
        pwcolors.push(1);
    }
    
    _pointWidgetVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, _pointWidgetVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pwmesh.vertsflat), gl.STATIC_DRAW);
}

function Float32Concat(first, second) {
    var firstLength = first.length;
    var result = new Float32Array(firstLength + second.length);

    result.set(first);
    result.set(second, firstLength);

    return result;
}

function updateMeshes() {
    _controlMesh.updateGLArray(RMesh.DRAW_ELEMENT_UPDATE);

    if (_controlMesh.vbo)
        gl.deleteBuffer(_controlMesh.vbo);
    if (_controlMesh.nbo)
        gl.deleteBuffer(_controlMesh.ebo);

    _controlMesh.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, _controlMesh.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, _controlMesh.vertsflat, gl.STATIC_DRAW);

    _controlMesh.ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _controlMesh.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, _controlMesh.facesflat, gl.STATIC_DRAW);

    if (_subdivMesh.vbo)
        gl.deleteBuffer(_subdivMesh.vbo);
    if (_subdivMesh.nbo)
        gl.deleteBuffer(_subdivMesh.nbo);

    var res = subdiv(_controlMesh.verts, _controlMesh.quads, 4);
    _subdivMesh = new RMesh(res[0], res[1]);
    _subdivMesh.updateNormals(RMesh.PER_FACE_NORMALS);
    _subdivMesh.updateGLArray(RMesh.DRAW_ARRAY_UPDATE);
    

    _subdivMesh.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, _subdivMesh.vbo);
    log("len: " + _subdivMesh.verts.length);
    gl.bufferData(gl.ARRAY_BUFFER, _subdivMesh.vertsflat, gl.STATIC_DRAW);
    _subdivMesh.nbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, _subdivMesh.nbo);
    gl.bufferData(gl.ARRAY_BUFFER, _subdivMesh.normsflat, gl.STATIC_DRAW);
/*  */
}

function draw() {
    // Note: the viewport is automatically set up to cover the entire Canvas.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set up the model, view and projection matrices
    var pj = _controller.proj;
    pj.loadIdentity();
    pj.perspective(45, _width / _height, 0.1, 50);

    // Add in camera controller's rotation
    var mv = _controller.modelview;
    mv.loadIdentity();
    mv.translate(0, 0, -4);
    mv.rotate(_controller.xRot, 1, 0, 0);
    mv.rotate(_controller.yRot, 0, 1, 0);

    _controller.updateMat();

    // Compute necessary matrices
    var mvp = _controller.modelviewProj;
    var modelviewInvT = mv.inverse();
    modelviewInvT.transpose();

    var mv32 = new Float32Array(mv.elements);
    var mvit32 = new Float32Array(modelviewInvT.elements);
    var mvp32 = new Float32Array(mvp.elements);

    var shader = _shaderWireframe;
    gl.useProgram(shader.id);

    // Set up uniforms
    gl.uniformMatrix4fv(shader.mvpLoc, gl.FALSE, mvp32);
    gl.bindBuffer(gl.ARRAY_BUFFER, _controlMesh.vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _controlMesh.ebo);
    var total = 0;
    for (var i = 0; i < _controlMesh.faces.length; i++) {
        gl.drawElements(gl.LINE_LOOP, _controlMesh.faces[i].length, gl.UNSIGNED_SHORT, total*2);
        total += _controlMesh.faces[i].length;
    }
    
    var highlightedVert = _controller.highlightedVertInd;
    var highlightedAxis = _controller.highlightedAxis;
    if (highlightedVert >= 0) {
        gl.enableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.bindBuffer(gl.ARRAY_BUFFER, _controlMesh.vbo);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, highlightedVert, 1);

        shader = _shaderPointWidget;
        gl.useProgram(shader.id);

        var mv = _controller.modelview;
        var oldmv = _controller.modelview.copy();
        var vv = _controlMesh.verts[highlightedVert];
        mv.translate(vv.x, vv.y, vv.z);
        var sc = POINT_WIDGET_RANGE;
        mv.scale(sc, sc, sc);
        
        _controller.updateMat();
        mvp = _controller.modelviewProj;

        // Set up uniforms
        if (highlightedAxis == PointWidget.XAXIS)
            gl.uniform4f(shader.colorLoc, 0, 0, 0, 1);
        else
            gl.uniform4f(shader.colorLoc, 1, 0, 0, 1);
        gl.uniformMatrix4fv(shader.mvpLoc, gl.FALSE, new Float32Array(mvp.elements));
        gl.bindBuffer(gl.ARRAY_BUFFER, _pointWidgetVbo);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.drawArrays(gl.TRIANGLES, 0, 12);

        mv.rotate(-90, 0, 0, 1);
        _controller.updateMat();
        mvp = _controller.modelviewProj;
        gl.uniformMatrix4fv(shader.mvpLoc, gl.FALSE, new Float32Array(mvp.elements));
        if (highlightedAxis == PointWidget.YAXIS)
            gl.uniform4f(shader.colorLoc, 0, 0, 0, 1);
        else
            gl.uniform4f(shader.colorLoc, 0, 1, 0, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 12);

        mv.rotate(90, 0, 0, 1);
        mv.rotate(90, 0, 1, 0);
        _controller.updateMat();
        mvp = _controller.modelviewProj;
        gl.uniformMatrix4fv(shader.mvpLoc, gl.FALSE, new Float32Array(mvp.elements));
        if (highlightedAxis == PointWidget.ZAXIS)
            gl.uniform4f(shader.colorLoc, 0, 0, 0, 1);
        else
            gl.uniform4f(shader.colorLoc, 0, 0, 1, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 12);

        //checkGLError()
        /**/
        mv.loadIdentity();
        mv.multiply(oldmv);
        _controller.updateMat();        
    }
    
    shader = _shaderPhong;
    gl.useProgram(shader.id);
        
    // Set up uniforms
    gl.uniformMatrix4fv(shader.mvLoc, gl.FALSE, mv32);
    gl.uniformMatrix4fv(shader.mvInvTLoc, gl.FALSE, mvit32);
    gl.uniformMatrix4fv(shader.mvpLoc, gl.FALSE, mvp32);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, _subdivMesh.vbo);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, _subdivMesh.nbo);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 12, 0);
    
    gl.drawArrays(gl.TRIANGLES, 0, _subdivMesh.vertsflat.length / 3);
    /**/
    
    if (_controller.highlightedFace >= 0) {

        shader = _shaderPointWidget;
        gl.useProgram(shader.id);
        gl.uniformMatrix4fv(shader.mvpLoc, gl.FALSE, mvp32);
        gl.uniform4f(shader.colorLoc, 1, 0, 0, .4);
        gl.bindBuffer(gl.ARRAY_BUFFER, _controlMesh.vbo);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
        gl.enableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _controlMesh.ebo);
        var total = 0;
        for (var i = 0; i < _controlMesh.faces.length; i++) {
            if (i == _controller.highlightedFace) 
                gl.drawElements(gl.TRIANGLE_FAN, _controlMesh.faces[i].length, gl.UNSIGNED_SHORT, total * 2);            
            total += _controlMesh.faces[i].length;
        }
    }
   /* */
    //checkGLError();
}

