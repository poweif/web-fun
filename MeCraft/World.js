Block = function () {
    this.ix = 0;
    this.iy = 0;
    this.iz = 0;
}

Block.XY0 = 0;
Block.XY1 = 1;
Block.YZ0 = 2;
Block.YZ1 = 3;
Block.XZ0 = 4;
Block.XZ1 = 5;
Block.cubeFaces = [
    [0, 1, 3, 2],
    [5, 4, 6, 7],
    [4, 0, 2, 6],
    [1, 5, 7, 3],    
    [4, 5, 1, 0],
    [2, 3, 7, 6]];

Block.cubeVerts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 1),
    new THREE.Vector3(0, 1, 1),
    new THREE.Vector3(1, 1, 1)];


LongBinary = function (L) {
    this.list = [];
    for (var i = 0; i < L / 32 + 1; i++) 
        this.list.push(0 | 0);
    this.length = L;
}

LongBinary.prototype = {
    constructor: LongBinary,
    read: function (ind) {
        return (this.list[(ind / 32) | 0] & (1 << (ind % 32))) !=0;
    },

    write: function (ind, val) {        
        if(val)
            this.list[(ind/32)|0] = this.list[(ind / 32) | 0] | (1 << (ind % 32));
        else
            this.list[(ind/32)|0] = this.list[(ind / 32) | 0] & ~(1 << (ind % 32));
    }
}


BlockMeshBuckets = function (nb, w) {
    this.nbuckets = nb;
    this.world = w;
    this.gl = this.world.gl;
    this.nblocks = 0;
    this.bqueue = [];
    this.id2num = new Object();

    this.buckets = [];
    for (var i = 0; i < nb; i++)
        this.buckets.push(new Bucket(w,i));

    this.updateMeshQ = new Object();
}

BlockMeshBuckets.prototype = {
    constructor: BlockMeshBuckets,

    buildBlock: function(b){
        var ret = [b[0],b[1],b[2],World.MAX_LEVEL];
        ret.id = this.world.ind3d(ret);
        return ret;     
    },

    addBlock: function (b) {
        var bb = this.buildBlock(b);
        //log("adding: " + bb[0] + " " + bb[1] + " " + bb[2] + " " + bb.id);
        this.id2num[bb.id] = this.nblocks;
        //log(bb.id + " " + this.id2num[bb.id]);
        this.buckets[this.nblocks % this.nbuckets].addItem(bb);
        this.nblocks++;
    },

    removeBlock: function (b){
        var bb = this.buildBlock(b);
        if (!this.id2num[bb.id])
            return;
        this.buckets[this.id2num[bb.id] % this.nbuckets].removeItem(bb);
        this.nblocks--;
    },

    _updateBlock: function (b) {
        var bb = this.buildBlock(b);
        if (!this.id2num[bb.id])
            return;
        this.buckets[this.id2num[bb.id] % this.nbuckets].updateItem(bb);
    },

    processUpdateQueue: function () {
        this.updateMeshQ = new Object();
        log("updating mesh q: " + this.bqueue.length);

        for (var i = 0; i < this.bqueue.length; i++) {
            var bb = this.buildBlock(this.bqueue[i]);
           
           // log("a " + bb.id + " " +  this.id2num[bb.id]);
            if (this.id2num[bb.id] != 0 && !this.id2num[bb.id]) 
                continue;
           // log("b");

            this.updateMeshQ[this.id2num[bb.id] % this.nbuckets] = this.id2num[bb.id] % this.nbuckets;
            this._updateBlock(this.bqueue[i]);
        }
        this.bqueue = [];
    },

    addToUpdateQueue: function (b) {
        this.bqueue.push(b);
    },

    _updateMesh: function () {
        var ret = []; 
        for (var i in this.updateMeshQ) {
            if (this.buckets[i].changedMesh) {
                //log("i: " + i + " " + this.buckets[i].changedMesh);
                this.buckets[i].makeMeshArray();
                ret.push(i);
            }
        }
        return ret;
    },

    // should the GL stuff go here?  I wonder
    updateGLMeshes: function () {
        var updates = this._updateMesh();
        log("updating!! " + updates.length);
        for (var i = 0; i < updates.length; i++) {
            var buc = this.buckets[updates[i]];
            if (buc.vbo) 
                this.gl.deleteBuffer(this.buckets[updates[i]].vbo);
            if (buc.nbo)
                this.gl.deleteBuffer(this.buckets[updates[i]].nbo);

            buc.vbo = this.gl.createBuffer();
            buc.nbo = this.gl.createBuffer();

            this.gl.bindBuffer(gl.ARRAY_BUFFER, buc.vbo);
            this.gl.bufferData(gl.ARRAY_BUFFER, buc.verts, gl.STATIC_DRAW);

            this.gl.bindBuffer(gl.ARRAY_BUFFER, buc.nbo);
            this.gl.bufferData(gl.ARRAY_BUFFER, buc.norms, gl.STATIC_DRAW);
        }
    }
}

Bucket = function (w, id) {
    this.items = [];   
    this.world = w;
    this.verts = null;
    this.normals = null;
    this.faces = new Object();
    this.changedMesh = false;
    this.id = id; 
}

Bucket.prototype = {
    constructor: Bucket,

    addItem: function (i) {
        //log("adding: " + i);
        this.items.push(i);
        this.world.bmBuckets.addToUpdateQueue([i[0] + 1, i[1], i[2]]);
        this.world.bmBuckets.addToUpdateQueue([i[0] - 1, i[1], i[2]]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1] + 1, i[2]]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1] - 1, i[2]]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1], i[2] + 1]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1], i[2] - 1]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1], i[2]]);
        this.updateItem(i);
        this.changedMesh = true;
    },
    
    updateItem: function (item) {
        if (item.id == 355)
            log("goodbye! " + this.id);
        //log("present: " + item);
        if (!this.world.blockPresent(item[0], item[1], item[2])) {
            //log("does not exist!!!");
            return;
        }

         //log("updating: " + item);

        this.faces[item.id] = [];
        for (var i = 0; i < 6; i++) {
            if (i == Block.XY0)
                res = !this.world.blockPresent(item[0], item[1], item[2] - 1);
            else if (i == Block.XY1)
                res = !this.world.blockPresent(item[0], item[1], item[2] + 1);
            else if (i == Block.YZ0)
                res = !this.world.blockPresent(item[0] - 1, item[1], item[2]);
            else if (i == Block.YZ1)
                res = !this.world.blockPresent(item[0] + 1, item[1], item[2]);
            else if (i == Block.XZ0)
                res = !this.world.blockPresent(item[0], item[1] - 1, item[2]);
            else if (i == Block.XZ1)
                res = !this.world.blockPresent(item[0], item[1] + 1, item[2]);

            if (res) {
                this.faces[item.id].push(i);
 
               // log("pushing: " + i + " for " + item.id);
            }
        }
       // log("bucket: " + this.id);
       // log(this.faces);
        this.changedMesh = true;
    },

    removeItem: function (i) {
        var nitems = [];
        // change this to allow for array deletion instead of manual deletion
        for (var j = 0; j < this.items.length; j++) {
            if (this.items[j][0] != i[0] || this.items[j][1] != i[1] || this.items[j][2] != i[2])
                nitems.push(this.items[j]);
        }
        this.items = nitems;

        this.items.push(i);
        this.world.bmBuckets.addToUpdateQueue([i[0] + 1, i[1], i[2]]);
        this.world.bmBuckets.addToUpdateQueue([i[0] - 1, i[1], i[2]]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1] + 1, i[2]]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1] - 1, i[2]]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1], i[2] + 1]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1], i[2] - 1]);
        this.world.bmBuckets.addToUpdateQueue([i[0], i[1], i[2]]);

        delete this.faces[i.id];

        this.changedMesh = true;
    },

    makeMeshArray: function () {
        var onev = THREE.Vector3(1, 1, 1);
        var verts = [];
        var norms = [];
        //log("items: " + items.length);
        for (var i = 0; i < this.items.length; i++) {
            var pos = this.world.hash[this.items[i].id];
            if (pos) {
                var ca = new THREE.Vector3(pos[0], pos[1], pos[2]);
                var fs = this.faces[this.items[i].id];
                //log("faces: " + fs);
                for (var j = 0; j < fs.length; j++) {
                    var n = this.world.gnorms[fs[j]];
                    var thisface = Block.cubeFaces[fs[j]];
                    for (var k = 0; k < 3; k++) {
                        var p = Block.cubeVerts[thisface[k]];
                        verts.push(p.x+pos[0]);
                        verts.push(p.y+pos[1]);
                        verts.push(p.z + pos[2]);
                        norms.push(-n.x);
                        norms.push(-n.y);
                        norms.push(-n.z);
                    }
                    
                    for (var k = 2; k <= 4; k++) {
                        var p = Block.cubeVerts[thisface[k%4]];
                        verts.push(p.x+pos[0]);
                        verts.push(p.y+pos[1]);
                        verts.push(p.z+pos[2]);
                        norms.push(-n.x);
                        norms.push(-n.y);
                        norms.push(-n.z);
                    }
                    
                }
            }
        }

        //for (var j = 0; j < 10; j++)
         //   log(verts[j * 3] + " " + verts[j * 3 + 1] + " " + verts[j * 3 + 2]);

        this.verts = new Float32Array(verts);
        this.norms = new Float32Array(norms);
        //log("verts: " + verts.length);
        this.changedMesh = false;
    }
}
// octree for intersection? 
// hashmap for neighbors? 

World = function (ogl) {
    this.gl = ogl;
    this.gpts = [
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3()];

    this.gnorms = [
         new THREE.Vector3(0, 0, 1),
         new THREE.Vector3(0, 0, -1),
         new THREE.Vector3(1, 0, 0),
         new THREE.Vector3(-1, 0, 0),
         new THREE.Vector3(0, 1, 0),
         new THREE.Vector3(0, -1, 0)];

    this.hash = new Object(); 
    this.levelsum = [];
    for (var i = 0; i <= World.MAX_LEVEL; i++) {
        var len = (1 << i);
        if (this.levelsum.length > 0)
            this.levelsum.push(this.levelsum[i - 1] + len * len * len);
        else
            this.levelsum.push(1);
    }
    this.levelsum[-1] = 0;

    this.nodePresent = new LongBinary(this.levelsum[World.MAX_LEVEL]);
    this.bmBuckets = new BlockMeshBuckets(100, this);
    //log("n: " + this.bmBuckets.nbuckets);

    this.rlen = [];
    this.rlen2 = [];
    for (var i = 0; i <= World.MAX_LEVEL; i++) {
        this.rlen.push(1 << i);
        this.rlen2.push(this.rlen[i] * this.rlen[i]);
    }

    var mdim = this.rlen[World.MAX_LEVEL];
    var cx = mdim / 2;
    var cy = mdim / 2;
    var cz = mdim / 2;
    var wid = mdim * .2;
    for (var x = 0; x < mdim; x++) {
        for (var y = 0; y < mdim; y++) {
            for (var z = 0; z < mdim; z++) {
                var dx = x - cx;
                var dy = y - cy;
                var dz = z - cz;
                if (dx * dx + dy * dy + dz * dz < wid * wid)
                    this.addBlock(x, y, z);

            }
        }
    }

    this.root = [0, 0, 0, 0];

    this.runUpdate();
}


World.MAX_LEVEL = 4;

World.prototype = {
    constructor: World,

    ind3d: function (node) {
        return this.levelsum[node[3] - 1] +
            (node[0] + node[1] * this.rlen[node[3]] + node[2] * this.rlen2[node[3]]);
    },
        
    intersect: function (node, raypt, raydir) {        
        var x = node[0];
        var y = node[1];
        var z = node[2];
        var l = node[3];

        var length = 1 << (World.MAX_LEVEL - l);
        x *= length;
        y *= length;
        z *= length;
        var xp = x+length;
        var yp = y+length;
        var zp = z+length;

        var pts = this.gpts;
        pts[0].set(x, y, z);
        pts[1].set(xp, y, z);
        pts[2].set(x, yp, z);
        pts[3].set(xp, yp, z);
        pts[4].set(x, y, zp);
        pts[5].set(xp, y, zp);
        pts[6].set(x, yp, zp);
        pts[7].set(xp, yp, zp);

        var t;
        var bestt = Number.POSITIVE_INFINITY;
        var bestside = -1;
        t = quadRayIsect2([pts[0], pts[1], pts[3], pts[2]], this.gnorms[Block.XY0], raypt, raydir);
        if (t < bestt) {
            bestt = t;
            bestside = Block.XY0;
        }
        t = quadRayIsect2([pts[5], pts[4], pts[6], pts[7]], this.gnorms[Block.XY1], raypt, raydir);
        if (t < bestt) {
            bestt = t;
            bestside = Block.XY1;
        }
        t = quadRayIsect2([pts[4], pts[0], pts[2], pts[6]], this.gnorms[Block.YZ0], raypt, raydir);
        if (t < bestt) {
            bestt = t;
            bestside = Block.YZ0;
        }
        t = quadRayIsect2([pts[1], pts[5], pts[7], pts[3]], this.gnorms[Block.YZ1], raypt, raydir);
        if (t < bestt) {
            bestt = t;
            bestside = Block.YZ1;
        }
        t = quadRayIsect2([pts[2], pts[3], pts[7], pts[6]], this.gnorms[Block.XZ1], raypt, raydir);
        if (t < bestt) {
            bestt = t;
            bestside = Block.XZ1;
        }
        t = quadRayIsect2([pts[4], pts[5], pts[1], pts[0]], this.gnorms[Block.XZ0], raypt, raydir);
        if (t < bestt) {
            bestt = t;
            bestside = Block.XZ0;
        }

        return [bestside >= 0, bestt, bestside];
    },

    intersectRec: function (node, raypt, raydir) {
        var intres = this.intersect(node, raypt, raydir);
        
        if (intres[0]) {
            //log("node: " + node + " hit");
            if (node[3] == World.MAX_LEVEL) {
                this.intersect(node, raypt, raydir, true);                
                return [true, intres[1], node, intres[2]];
            }
            else {
                var x = node[0] << 1;
                var y = node[1] << 1;
                var z = node[2] << 1;
                var l = node[3] + 1;

                var res = false;
                var tdist = Number.POSITIVE_INFINITY;
                var bestblock = null;
                var bestside = -1;
                for (var i = 0 | 0; i < 8; i++) {
                    var nx = x, ny = y, nz = z;
                    if ((i & 1) > 0)
                        nx++;
                    if ((i & 2) > 0)
                        ny++;
                    if ((i & 4) > 0)
                        nz++;

                    var a = [nx, ny, nz, l];
                    var ind = this.ind3d(a);
                    
                    if (this.nodePresent.read(ind)) {

                        var tres = this.intersectRec(a, raypt, raydir);
                        res = res || tres[0];
                        if (tres[0] && tres[1] < tdist) {
                            tdist = tres[1];
                            bestblock = tres[2];
                            bestside = tres[3];
                        }
                    }
                }                
                return [res, tdist, bestblock, bestside];
            }
        }

        return [false, Number.POSITIVE_INFINITY, null,-1];
    },

    addBlock: function (x, y, z) {        
        var level = World.MAX_LEVEL;
        var ind = this.ind3d([x, y, z, level]);
        var mdim = 1 << level;
        if (x >= mdim || y >= mdim || z >= mdim || x < 0 || y < 0 || z < 0)
            return;

        this.hash[ind] = [x, y, z];
        var ox = x, oy = y, oz = z;
        while (level >= 0) {
       
            this.nodePresent.write(ind, true);            
            level--;
            if (level < 0) break;
            x = (x >> 1);
            y = (y >> 1);
            z = (z >> 1);
            ind = this.ind3d([x, y, z, level]);
            if (this.nodePresent.read(ind))
                break;            
        }
        this.bmBuckets.addBlock([ox, oy, oz]);
    },

    removeBlock: function (x, y, z) {
        var level = World.MAX_LEVEL;
        var ind = this.ind3d([x, y, z, level]);
        var mdim = 1 << level;
        if (x >= mdim || y >= mdim || z >= mdim || x < 0 || y < 0 || z < 0)
            return;

        delete this.hash[ind];
        var ox = x, oy = y, oz = z;
        outer: while (level >= 0) {
            this.nodePresent.write(ind, false);
            level--;
            if (level < 0) break;
            x = (x >> 1);
            y = (y >> 1);
            z = (z >> 1);
            ind = this.ind3d([x, y, z, level]);

            // check all children.  If no children, then delete this node in the 
            // next iteration
            for (var i = 0; i < 8; i++) {
                var nx = x * 2, ny = y * 2, nz = z * 2;
                if (i & 1) nx++;
                if (i & 2) ny++;
                if (i & 4) nz++;

                var nind = this.ind3d([nx, ny, nz, level+1]);

                if (this.nodePresent.read(nind))
                    break outer; 
            }
        }
        this.bmBuckets.removeBlock([ox, oy, oz]);
      //  this.bmBuckets.processUpdateQueue();
    },

    runUpdate: function() { 
        this.bmBuckets.processUpdateQueue();
        this.bmBuckets.updateGLMeshes();
        log("updating");
    }, 

    buildMesh: function () {
        var ret = new RMesh(); 
        var dim = this.rlen[World.MAX_LEVEL];
        var dimp1 = dim + 1;
        for (var z = 0; z <= dim; z++) {
            for (var y = 0; y <= dim; y++) {                
                for (var x = 0; x <= dim; x++) {
                    ret.addVert(x, y, z);
                }
            }
        }

        var faces = [
            [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
            [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]],
            [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]],
            [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]],
            [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]],
            [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]];

        for (var block in this.hash) {
            var coord = this.hash[block];
            for (var j = 0; j < faces.length; j++) {
                var inds = [];
                for (var k = 0; k < faces[j].length; k++) {
                    var ncoord = [coord[0] + faces[j][k][0], coord[1] + faces[j][k][1], coord[2] + faces[j][k][2]];
                    inds.push(ncoord[0] + ncoord[1] * dimp1 + ncoord[2] * dimp1 * dimp1);
                }
                ret.addQuad(inds[0], inds[1], inds[2], inds[3]);
            }
        }

        ret.updateNormals(RMesh.PER_FACE_NORMALS);
        ret.updateGLArray(RMesh.DRAW_ARRAY_UPDATE);

        return ret;
    },

    blockPresent: function (x, y, z) {
        var dim = 1<<World.MAX_LEVEL;
        if(x<0||y<0||z<0||x>=dim||y>=dim||z>=dim) return false;
        var nind = this.ind3d([x, y, z, World.MAX_LEVEL]);
        return (this.nodePresent.read(nind));
    }
}
