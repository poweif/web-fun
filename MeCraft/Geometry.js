// a simple edge dictionary 
EdgeDict = function () { }
EdgeDict.prototype = {
    constructor: EdgeDict,

    read: function (i0, i1) {
        if (this[i0]) return this[i0][i1];
        return undefined;
    },

    write: function (i0, i1, val) {
        if (!this[i0])
            this[i0] = new Object();
        this[i0][i1] = val;
    }
}

// a simple mesh class, R for Rice
RMesh = function (vs, fs) {
    this.quads = [];
    this.normals = [];
    this.vertsflat = null;
    this.normsflat = null;
    this.facesflat = null;
    this.vertsQuadflat = null;
    this.normaltype = 1;

    if (!vs) {
        this.verts = [];
        this.faces = [];  // internally broken down into triangles
    }
    else {
        this.verts = vs;
        this.faces = [];

        if (fs.length > 0 && fs[0].length == 3) {
            for (var i = 0; i < fs.length; i++) {
                this.addTri(fs[i][0], fs[i][1], fs[i][2]);
            }
        }
        else {
            for (var i = 0; i < fs.length; i++) {
                this.addQuad(fs[i][0], fs[i][1], fs[i][2], fs[i][3]);
            }
        }
    }

}

RMesh.PER_FACE_NORMALS = 0;
RMesh.PER_VERTEX_NORMALS = 1;
RMesh.DRAW_ELEMENT_UPDATE = 0;
RMesh.DRAW_ARRAY_UPDATE = 1;
RMesh.DRAW_ARRAY_QUAD_WIREFRAME_UPDATE = 2;
RMesh.DRAW_ARRAY_TRI_WIREFRAME_UPDATE = 3;

RMesh.prototype = {
    // constants
    constructor: RMesh,

    addVert: function(x,y,z){
        this.verts.push(new THREE.Vector3(x,y,z));
    },

    addTri: function(a,b,c){
        this.faces.push([a, b, c]);
    },

    addQuad: function(a,b,c,d){
        this.quads.push([a,b,c,d]);
        this.faces.push([a,b,c]);
        this.faces.push([c, d, a]);
        //log("adding quad: " + a + " " + b + " " + c + " " + d);
    },

    updateNormals: function (type) {
        this.normaltype = type;
        this.normals = [];
        
        if (type == RMesh.PER_FACE_NORMALS) {
            for (var i = 0; i < this.faces.length; i++) {
                var tri = this.faces[i]; // faces or quads, it's all the same
                var v0 = this.verts[tri[1]].clone().sub(this.verts[tri[0]]);
                var v1 = this.verts[tri[2]].clone().sub(this.verts[tri[0]]);
                v1.cross(v0);
                v1.normalize();
                this.normals.push(v1);
            }
        }
        else {
            for (var i = 0; i < this.verts.length; i++)
                this.normals.push(new THREE.Vector3(0, 0, 0));
            for (var i = 0; i < this.faces.length; i++) {
                var tri = this.faces[i]; // faces or quads, it's all the same
                var v0 = this.verts[tri[1]].clone().sub(this.verts[tri[0]]);
                var v1 = this.verts[tri[2]].clone().sub(this.verts[tri[0]]);               
                v1.cross(v0);
                v1.normalize();
                
                for (var j = 0; j < tri.length; j++) {
                    this.normals[tri[j]].add(v1);
                }
            }
            for (var i = 0; i < this.verts.length; i++)
                this.normals[i].normalize();
        }
    },

    splitFace: function (ind) {
        if (ind >= this.quads.length)
            return;
               
        var edict = new EdgeDict();
        for (var i = 0; i < this.quads.length; i++) {
            var q = this.quads[i];
            for (var j = 0; j < q.length; j++) 
                edict.write(q[j], q[(j + 1) % q.length], i);            
        }

        var center = new THREE.Vector3(0, 0, 0);
        for (var i = 0; i < this.quads[ind].length; i++) 
            center.add(this.verts[this.quads[ind][i]]);
        center.multiplyScalar(1 / this.quads[ind].length);

        var nvind = this.verts.length;
        this.verts.push(center);

        var qs = [];
        for (var i = 0; i < this.quads[ind].length; i++) {
            var a = this.verts[this.quads[ind][i]].clone();
            var b = this.verts[this.quads[ind][(i + 1) % this.quads[ind].length]];
            a.add(b).multiplyScalar(.5);
            qs.push(this.verts.length);             
            this.verts.push(a);
        }

        for (var i = 0; i < this.quads[ind].length; i++) {
            var e0 = this.quads[ind][i];
            var e1 = this.quads[ind][(i + 1) % qs.length];
            var fi = edict.read(e1, e0);            
            var nface = []; 
            for (var j = 0; j < this.quads[fi].length; j++) {
                nface.push(this.quads[fi][j]);
                if (this.quads[fi][j] == e1)
                    nface.push(qs[i]);
            }
            this.quads[fi] = nface;
        }

        var nquads = [];
        for (var i = 0; i < this.quads.length; i++) {
            if (i != ind)
                nquads.push(this.quads[i]);
        }

        for (var i = 0; i < this.quads[ind].length; i++) {
            var a = nvind;
            var b = qs[i];
            var c = this.quads[ind][(i + 1) % qs.length];
            var d = qs[(i + 1) % qs.length];
            nquads.push([a, b, c, d]);
        }

        this.quads = nquads;
        this.faces = nquads;
        log("setting new faces");
    },
    
    // update flat array
    updateGLArray: function (mode) {
        if (mode == RMesh.DRAW_ELEMENT_UPDATE) {
            var vertstxt = [];
            var facestxt = []; 
            var normstxt = [];

            for (var i = 0; i < this.verts.length; i++) {
                var v = this.verts[i];
                vertstxt.push(v.x);
                vertstxt.push(v.y);
                vertstxt.push(v.z);
            }

            for (var i = 0; i < this.faces.length; i++) {
                var f = this.faces[i];
                for (var j = 0; j < f.length; j++)
                    facestxt.push(f[j]);
            }

            // must be per-face normals
            for (var i = 0; i < this.normals.length; i++) {
                var n = this.normals[i];
                normstxt.push(n.x); 
                normstxt.push(n.y);
                normstxt.push(n.z);
            }
       
            this.vertsflat = new Float32Array(vertstxt);
            this.normsflat = new Float32Array(normstxt);
            this.facesflat = new Uint16Array(facestxt);

        }
        else if (mode == RMesh.DRAW_ARRAY_UPDATE) {
            var vertstxt = [];
            var normstxt = [];

            for (var i = 0; i < this.faces.length; i++) {
                var tri = this.faces[i];
                for (var j = 0; j < tri.length; j++) {
                    var v = this.verts[tri[j]];
                    vertstxt.push(v.x);
                    vertstxt.push(v.y);
                    vertstxt.push(v.z);
                }
            }

            if (this.normaltype == RMesh.PER_FACE_NORMALS) {
                for (var i = 0; i < this.faces.length; i++) {
                    var tri = this.faces[i];
                    var n = this.normals[i];
                    for (var j = 0; j < tri.length; j++) {
                        normstxt.push(n.x);
                        normstxt.push(n.y);
                        normstxt.push(n.z);
                    }
                }
            }
            else {
                for (var i = 0; i < this.faces.length; i++) {
                    var tri = this.faces[i];
                    for (var j = 0; j < tri.length; j++) {
                        var n = this.normals[tri[j]];
                        normstxt.push(n.x);
                        normstxt.push(n.y);
                        normstxt.push(n.z);
                    }
                }
            }
            this.vertsflat = new Float32Array(vertstxt);
            this.normsflat = new Float32Array(normstxt);
        }
        else if (mode == RMesh.DRAW_ARRAY_TRI_WIREFRAME_UPDATE) {
            var vertstxt = [];
            for (var i = 0; i < this.faces.length; i++) {
                var tri = this.faces[i];
                for (var j = 0; j < tri.length; j++) {
                    var v = this.verts[tri[j]];
                    vertstxt.push(v.x);
                    vertstxt.push(v.y);
                    vertstxt.push(v.z);
                }
            }
            this.vertsflat = new Float32Array(vertstxt);
        }
        else if (mode == RMesh.DRAW_ARRAY_QUAD_WIREFRAME_UPDATE) {
            var vertstxt = [];
            for (var i = 0; i < this.quads.length; i++) {
                var q = this.quads[i];
                for (var j = 0; j < q.length; j++) {
                    var v = this.verts[q[j]];
                    vertstxt.push(v.x);
                    vertstxt.push(v.y);
                    vertstxt.push(v.z);
                }
            }
            this.vertsQuadflat = new Float32Array(vertstxt);
            vertstxt = [];
            for (var i = 0; i < this.verts.length; i++) {
                vertstxt.push(this.verts[i].x);
                vertstxt.push(this.verts[i].y);
                vertstxt.push(this.verts[i].z);
            }

            this.vertsflat = new Float32Array(vertstxt);
        }
        else {
            //log("here d");
        }
    }   
}

// helper geometry functions
function rayRayClosest(r1pt, r1dir, r2pt, r2dir) {
    var n = r1dir.clone().cross(r2dir).normalize();
    var v = r2pt.clone().sub(r1pt);
    var y = n.dot(v);
    var nr2pt = r2pt.clone().add(n.clone().multiplyScalar(-y)).sub(r1pt);
    var pxdir = r1dir.clone();
    var pydir = n.clone().cross(r1dir).normalize();
    var q2p = new THREE.Vector2(nr2pt.dot(pxdir), nr2pt.dot(pydir));
    var q2dir = new THREE.Vector2(r2dir.dot(pxdir), r2dir.dot(pydir));

    return q2p.x + (-q2p.y / q2dir.y) * q2dir.x;;
}

function rayRayDist(r1pt, r1dir, r2pt, r2dir) {
    var v12 = r1dir.clone().cross(r2dir).normalize();
    var p21 = r2pt.clone().sub(r1pt);
    var num = Math.abs(p21.dot(v12));
    var denom = v12.length();
    if (denom == 0) {
        var tt = p21.dot(r1dir);
        return p21.dot(p21) - tt * tt / (r1dir.dot(r1dir));
    }
    return num / denom;
}

function ptRayDist(ppt, rayPt, rayDir) {
    var w = ppt.clone().sub(rayPt);
    var y2 = w.dot(rayDir);
    y2 *= y2;
    var h2 = w.lengthSq();
    return Math.sqrt(h2 - y2);
}

var PRIw = new THREE.Vector3();
function planeRayIsect(ppt, pnormal, rayPt, rayDir) {
    //var w = ppt.clone().sub(rayPt);
    PRIw.set(ppt.x - rayPt.x, ppt.y - rayPt.y, ppt.z - rayPt.z);
    var dist = pnormal.dot(PRIw);
    var denom = pnormal.dot(rayDir);    
    if (denom == 0)
        return Number.POSITIVE_INFINITY;
    return dist / denom;
}

function subdivCatmullClark(verts, faces) {
    var fverts = [];
    var edges = [];
    var neighbors = [];
    var e2ei = new EdgeDict();
    var e2f = new EdgeDict();
    var everts = [];
    var emids = [];
    var v2f = [];
    var vverts = [];

    for (var i = 0; i < verts.length; i++) {
        neighbors.push([]);
        v2f.push([]);
    }

    for (var i = 0; i < faces.length; i++) {
        var nvs = faces[i].length;
        var nvert = new THREE.Vector3();
        for (var j = 0; j < nvs; j++) {
            nvert.add(verts[faces[i][j]]);

            var nj = (j + 1) % nvs;
            var e0 = faces[i][j], e1 = faces[i][nj];
            if (e0 < e1) {
                e2ei.write(e0, e1, edges.length);
                e2ei.write(e1, e0, edges.length);
                edges.push([e0, e1]);
            }
            e2f.write(e0, e1, i);
            neighbors[e0].push(e1); // only for closed meshes
            v2f[e0].push(i);
        }
        nvert.multiplyScalar(1. / nvs);
        fverts.push(nvert);
    }

    for (var i = 0; i < edges.length; i++) {
        var tvert = new THREE.Vector3();
        tvert.addVectors(verts[edges[i][0]], verts[edges[i][1]]);
        tvert.multiplyScalar(.5);
        emids.push(tvert);

        tvert = tvert.clone(); // start anew
        tvert.multiplyScalar(2);
        var face0 = e2f.read(edges[i][0], edges[i][1]);
        var face1 = e2f.read(edges[i][1], edges[i][0]);

        tvert.add(fverts[face0]);
        tvert.add(fverts[face1]);
        tvert.multiplyScalar(.25);
        everts.push(tvert);
    }

    for (var i = 0; i < verts.length; i++) {
        var q = new THREE.Vector3();
        var r = new THREE.Vector3();
        var s = verts[i].clone();

        for (var j = 0; j < v2f[i].length; j++)
            q.add(fverts[v2f[i][j]]);
        q.multiplyScalar(1. / v2f[i].length);

        for (var j = 0; j < neighbors[i].length; j++)
            r.add(emids[e2ei[i][neighbors[i][j]]]);
        r.multiplyScalar(1. / neighbors[i].length);

        q.multiplyScalar(1 / 4.);
        r.multiplyScalar(1 / 2.);
        s.multiplyScalar(1 / 4.);

        s.add(q);
        s.add(r);

        vverts.push(s);
    }

    var fvlen = fverts.length;
    var evlen = everts.length;
    var nfaces = [];

    for (var i = 0; i < faces.length; i++) {
        for (var j = 0; j < faces[i].length; j++) {
            var pj = (j - 1 + faces[i].length) % faces[i].length;
            var nj = (j + 1) % faces[i].length;

            var pt = faces[i][pj];
            var t = faces[i][j];
            var nt = faces[i][nj];

            nfaces.push([i, e2ei.read(pt, t) + fvlen, t + fvlen + evlen, e2ei.read(t, nt) + fvlen]);
        }
    }

    return [fverts.concat(everts, vverts), nfaces];
}

function quadRayIsect(p, rayPt, rayDir) {
    var v0, v1;
    for (var i = 0; i < p.length; i++) {
        v0 = p[(i + 1) % p.length].clone().sub(p[i]).normalize();
        v1 = p[(i + 2) % p.length].clone().sub(p[i]).normalize();
        var dval = v0.dot(v1);
        if (dval < 1 + 1e-6 && dval > 1 - 1e-6)
            continue;
        else 
            break;        
    }

    var pn = v0.cross(v1).normalize();
    var t = planeRayIsect(p[0], pn, rayPt, rayDir);

    if (t == Number.POSITIVE_INFINITY)
        return t;

    var nrdir = rayDir.clone().multiplyScalar(t);
    var ipt = rayPt.clone().add(nrdir);

    var quit = false;

    for (var i = 0; i < p.length; i++) {
        v0 = p[i].clone().sub(ipt).normalize();
        v1 = p[(i + 1) % p.length].clone().sub(ipt).normalize();
        var dval = v0.dot(v1);
        if (dval < 1 + 1e-6 && dval > 1 - 1e-6)
            continue;
        
        var testn = v0.cross(v1).normalize();
        if (testn.dot(pn) < 0) {
            quit = true;
            break;
        }
    }

    if (!quit)
        return t;
    return Number.POSITIVE_INFINITY;
}

var QRI2v0 = new THREE.Vector3();
var QRI2v1 = new THREE.Vector3();

function quadRayIsect2(p, pn, rayPt, rayDir) {
    var t = planeRayIsect(p[0], pn, rayPt, rayDir);

    if (t == Number.POSITIVE_INFINITY)
        return t;

    var nrdir = rayDir.clone().multiplyScalar(t);
    var ipt = rayPt.clone().add(nrdir);

    var v0, v1;        
    for (var i = 0; i < p.length; i++) {
        var ni = (i + 1) % p.length;
        QRI2v0.set(p[i].x - ipt.x, p[i].y - ipt.y, p[i].z - ipt.z).normalize();
        QRI2v1.set(p[ni].x - ipt.x, p[ni].y - ipt.y, p[ni].z - ipt.z).normalize();

        var testn = QRI2v0.cross(QRI2v1);
        if (testn.dot(pn) < 0) 
            return Number.POSITIVE_INFINITY;        
    }

    return t;
}

function subdiv(verts, faces, times) {
    var res = [verts, faces];
    for (var i = 0; i < times; i++)
        res = subdivCatmullClark(res[0], res[1]);

    return res;
}

function createPointWidgetMeshes() {
    var ret = new RMesh();
    var h = 1 / 10;
    ret.addVert(-1, -h, 0);
    ret.addVert(1, -h, 0);
    ret.addVert(1, h, 0);
    ret.addVert(-1, h, 0);
    ret.addVert(1 + h, 0, 0);

    ret.addVert(-1, 0,-h);
    ret.addVert(1, 0,-h);
    ret.addVert(1, 0, h);
    ret.addVert(-1, 0, h);

    ret.addTri(0, 1, 2);
    ret.addTri(2, 3, 0);
   // ret.addTri(1, 4, 2);

    ret.addTri(5, 6, 7);
    ret.addTri(7, 8, 5);
   // ret.addTri(6, 4, 7);
    
    ret.updateNormals(RMesh.PER_FACE_NORMALS);
    ret.updateGLArray(RMesh.DRAW_ARRAY_UPDATE);

    return ret; 
}

PointWidget = function (pt, id) {
    this.pt = pt;
    this.ptId = id;
}

PointWidget.FAIL = -1;
PointWidget.XAXIS = 0;
PointWidget.YAXIS = 1;
PointWidget.ZAXIS = 2;

PointWidget.intersect = function (pt, rayPt, rayDir) {
    var dirs = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1)];

    //log("pp: "+ pt);
    var dx = rayRayDist(pt, dirs[0], rayPt, rayDir);
    var dy = rayRayDist(pt, dirs[1], rayPt, rayDir);
    var dz = rayRayDist(pt, dirs[2], rayPt, rayDir);

    var tol = POINT_WIDGET_RANGE;
    if (dx > tol && dy > tol && dz > tol)
        return PointWidget.FAIL;
    else {
        if (dx < dy) {
            if (dx < dz) return PointWidget.XAXIS;
            else return PointWidget.ZAXIS;
        }
        else {
            if (dy < dz) return PointWidget.YAXIS;
            else return PointWidget.ZAXIS;
        }
    }
}
