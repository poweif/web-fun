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

// A simple camera controller which uses an HTML element as the event
// source for constructing a view matrix. Assign an "onchange"
// function to the controller as follows to receive the updated X and
// Y angles for the camera:
//
//   var controller = new CameraController(canvas);
//   controller.onchange = function(xRot, yRot) { ... };
//
// The view matrix is computed elsewhere.
//
// opt_canvas (an HTMLCanvasElement) and opt_context (a
// WebGLRenderingContext) can be passed in to make the hit detection
// more precise -- only opaque pixels will be considered as the start
// of a drag action.

function unproject(winx, winy, winz, mvpinv, width, height) {
    var ivec = new THREE.Vector4((winx * 1. / width) * 2 - 1, (winy * 1. / height) * 2 - 1, winz * 2 - 1, 1.0);
    ivec.applyMatrix4(mvpinv);
    ivec.multiplyScalar(1 / ivec.w);
    return new THREE.Vector3(ivec.x, ivec.y, ivec.z);
}

InputController = function(doc,element,cm) {
    var ctl = this;
    this.onchange = null;
    this.xRot = 0;
    this.yRot = 0;
    this.scaleFactor = 3.0;
    this.dragging = false;
    this.curX = 0;
    this.curY = 0;
    this.modelview = new Matrix4x4();
    this.proj = new Matrix4x4();;
    this.modelviewProj = new Matrix4x4();
    this.modelviewProjInvTHREE = new THREE.Matrix4();
    this.updateMat();
    this.canvas_ = element;
    this.cmesh = cm;
    this.selectedVertInd = -1;
    this.selectedAxis = -1;
    this.highlightedVertInd = -1;
    this.highlightedAxis = -1;
    this.holdchar = '';
    this.transStPos = null;
    this.transOrigPos = null;

    this.selectedFace = -1;
    this.highlightedFace = -1;

    doc.onkeydown = function (e) {        
        ctl.holdchar = e.keyCode;
        //log("t: " + (ctl.holdchar == 32));
        if (ctl.holdchar == 32) {            
            if (ctl.highlightedVertInd >= 0) {
                ctl.selectedVertInd = ctl.highlightedVertInd;
                ctl.selectedAxis = ctl.highlightedAxis;

                var width = ctl.canvas_.width;
                var height = ctl.canvas_.height;
                var mrp = unproject(ctl.curX, ctl.curY, 0, ctl.modelviewProjInvTHREE, width, height);
                var mrd = unproject(ctl.curX, ctl.curY, 1, ctl.modelviewProjInvTHREE, width, height).sub(mrp).normalize();
                var verts = ctl.cmesh.verts;
                var selectedpos = verts[ctl.selectedVertInd];
                var selecteddir = ctl.selectedAxis;

                var dir;
                if (selecteddir == PointWidget.XAXIS)
                    dir = new THREE.Vector3(1, 0, 0);
                else if (selecteddir == PointWidget.YAXIS)
                    dir = new THREE.Vector3(0, 1, 0);
                else
                    dir = new THREE.Vector3(0, 0, 1);

                var t = rayRayClosest(selectedpos, dir, mrp, mrd);
                ctl.transStPos = selectedpos.clone().add(dir.multiplyScalar(t));
                ctl.transOrigPos = selectedpos.clone();
            }
            else {
                ctl.selectedVertInd = -1;
                ctl.selectedAxis = -1;
                this.transStPos = new THREE.Vector3(0, 0, 0);
            }            
        }
        else if (ctl.holdchar == 68) {
            if (ctl.highlightedFace >= 0) {
                ctl.cmesh.splitFace(ctl.highlightedFace);
                ctl.cmesh.faces = ctl.cmesh.quads;
                ctl.updateMeshes();
            }
        }
    };
    doc.onkeyup = function(e){
        ctl.holdchar = '';
        ctl.selectedVertInd = -1;
        ctl.selectedAxis = -1;
    }

    // Assign a mouse down handler to the HTML element.
    element.onmousedown = function (ev) {
        var dragging = true;
        var rect = ctl.canvas_.getBoundingClientRect();

        var canvasWidth = ctl.canvas_.width;
        var canvasHeight = ctl.canvas_.height;
        ctl.curX = ev.clientX - rect.left;
        ctl.curY = ev.clientY - rect.top;

        ctl.dragging = true;

        if (ctl.highlightedVertInd >= 0) {
            ctl.selectedVertInd = ctl.highlightedVertInd;
            ctl.selectedAxis = ctl.highlightedAxis;

        }
        else {
            ctl.selectedVertInd = -1;
            ctl.selectedAxis = -1;
        }
    };

    // Assign a mouse up handler to the HTML element.
    element.onmouseup = function(ev) {
        ctl.dragging = false;

    };

    // Assign a mouse move handler to the HTML element.
    element.onmousemove = function (ev) {
        var rect = ctl.canvas_.getBoundingClientRect();
        var curX = ev.clientX - rect.left;
        var width = ctl.canvas_.width;
        var height = ctl.canvas_.height;
        var curY = height - (ev.clientY - rect.top);
        //ctl.curX = curX;
        //ctl.curY = curY;

        if (ctl.dragging) {
            curY = ev.clientY - rect.top;
            var deltaX = (ctl.curX - curX) / ctl.scaleFactor;
            var deltaY = (ctl.curY - curY) / ctl.scaleFactor;
            ctl.curX = curX;
            ctl.curY = curY;
            // Update the X and Y rotation angles based on the mouse motion.
            ctl.yRot = (ctl.yRot + deltaX) % 360;
            ctl.xRot = (ctl.xRot + deltaY);
            // Clamp the X rotation to prevent the camera from going upside down.
            if (ctl.xRot < -90)
                ctl.xRot = -90;
            else if (ctl.xRot > 90)
                ctl.xRot = 90;

            // Send the onchange event to any listener.
            if (ctl.onchange != null)
                ctl.onchange(ctl.xRot, ctl.yRot);
        }
        else {
            ctl.curX = curX;
            ctl.curY = curY;
            if (ctl.holdchar == 32 && ctl.selectedVertInd>=0) {
                var mrp = unproject(curX, curY, 0, ctl.modelviewProjInvTHREE, width, height);
                var mrd = unproject(curX, curY, 1, ctl.modelviewProjInvTHREE, width, height).sub(mrp).normalize();

                var verts = ctl.cmesh.verts;
                var selectedpos = verts[ctl.selectedVertInd];
                var selecteddir = ctl.selectedAxis;

                var dir;
                if (selecteddir == PointWidget.XAXIS)
                    dir = new THREE.Vector3(1, 0, 0);
                else if (selecteddir == PointWidget.YAXIS)
                    dir = new THREE.Vector3(0, 1, 0);
                else
                    dir = new THREE.Vector3(0, 0, 1);

                var t = rayRayClosest(selectedpos, dir, mrp, mrd);
                var npos = selectedpos.clone().add(dir.multiplyScalar(t));                
                selectedpos.copy(ctl.transOrigPos);                
                selectedpos.add(npos.sub(ctl.transStPos));
                ctl.updateMeshes();                
            }
            else {
                var mrp = unproject(curX, curY, 0, ctl.modelviewProjInvTHREE, width, height);
                var mrd = unproject(curX, curY, 1, ctl.modelviewProjInvTHREE, width, height).sub(mrp).normalize();

                var verts = ctl.cmesh.verts;
                var quads = ctl.cmesh.faces;

                var best = 0;
                var bestdist = ptRayDist(verts[0], mrp, mrd);
                var testFace = false;

                for (var i = 1; i < verts.length; i++) {
                    var ndist = ptRayDist(verts[i], mrp, mrd);
                    if (ndist < bestdist) {
                        bestdist = ndist;
                        best = i;
                    }
                }

                if (bestdist < POINT_WIDGET_RANGE) {
                    ctl.highlightedVertInd = best;
                    ctl.highlightedAxis = PointWidget.intersect(verts[best], mrp, mrd);
                    ctl.onMouseMove();
                }
                else {
                    ctl.highlightedVertInd = -1;
                    ctl.highlightedAxis = -1;
                    testFace = true;
                }

                if(testFace){
                    best = -1;
                    bestdist = Number.POSITIVE_INFINITY;

                    for (var i = 0; i < quads.length; i++) {
                        var q = quads[i];
                        var hs = [];

                        for (var j = 0; j < q.length; j++)
                            hs.push(verts[q[j]]);

                        var t = quadRayIsect(hs, mrp, mrd, i == 3);
                        if (t < bestdist) {
                            bestdist = t;
                            best = i;
                        }
                    }

                    if (best >= 0) {
                        ctl.highlightedFace = best;
                        ctl.onMouseMove();
                    }
                    else
                        ctl.highlightedFace = best;
                }
            }
        }
    };
}

InputController.prototype = {
    constructor: InputController,
    updateMat: function () {
        this.modelviewProj.loadIdentity();
        this.modelviewProj.multiply(this.modelview);
        this.modelviewProj.multiply(this.proj);
        this.modelviewProjInv = this.modelviewProj.inverse();
        this.modelviewProjInvTHREE.copy(this.modelviewProjInv);
    }
}
