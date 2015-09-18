var PHONG_VERT_SRC = [
    "uniform mat4 modelview;",
    "uniform mat4 modelviewInvT;",
    "uniform mat4 modelviewProj;",
    "attribute vec4 vertex; ",
    "attribute vec3 normal; ",
    "",
    "varying vec3 worldEyeVec;",
    "varying vec3 worldNormal;",
    "varying vec3 worldPos;",
    "",
    "void main() {",
    "  gl_Position = modelviewProj * vec4(vertex.xyz, 1.);",
    "  worldNormal = (modelviewInvT * vec4(normal, 0.)).xyz;",
    "  worldPos = (modelview * vec4(vertex.xyz, 1.)).xyz;",
    "  worldEyeVec = normalize(worldPos);",
    "}"
].join("\n");

var PHONG_FRAG_SRC = [
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

var WIRE_VERT_SRC = [
    "uniform mat4 modelviewProj;",
    "attribute vec4 vertex; ",
    "",
    "",
    "void main() {",
    "  gl_PointSize = 5.; ",
    "  gl_Position = modelviewProj * vec4(vertex.xyz, 1.);",
    "}"
].join("\n");

var WIRE_FRAG_SRC = [
    "precision mediump float;\n",
    "",
    "void main() {",
    "  gl_FragColor = vec4(0,0,0,1);",
    "}"
].join("\n");

var POINTWIDGET_VERT_SRC = [
    "uniform mat4 modelviewProj;",
    "uniform vec4 color;",
    "attribute vec4 vertex; ",
    "",
    "varying vec4 ocolor; ",
    "",
    "void main() {",
    "  gl_Position = modelviewProj * vec4(vertex.xyz, 1.);",
    "  ocolor = color; ",
    "}"
].join("\n");

var POINTWIDGET_FRAG_SRC = [
    "precision mediump float;\n",
    "",
    "varying vec4 ocolor; ",
    "void main() {",
    "  gl_FragColor = ocolor;",
    "}"
].join("\n");


function loadShader(gl, type, shaderSrc) {
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

function initPhongShaders(gl) {
    var vertexShader = loadShader(gl, gl.VERTEX_SHADER, PHONG_VERT_SRC);
    var fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, PHONG_FRAG_SRC);
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
    var ret = new Object();
    ret.id = programObject;
    // Look up uniform locations
    ret.mvLoc = gl.getUniformLocation(programObject, "modelview");
    ret.mvInvTLoc = gl.getUniformLocation(programObject, "modelviewInvT");
    ret.mvpLoc = gl.getUniformLocation(programObject, "modelviewProj");

    return ret;
}

function initWireframeShaders(gl) {
    var vertexShader = loadShader(gl, gl.VERTEX_SHADER, WIRE_VERT_SRC);
    var fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, WIRE_FRAG_SRC);
    // Create the program object
    var programObject = gl.createProgram();
    gl.attachShader(programObject, vertexShader);
    gl.attachShader(programObject, fragmentShader);

    // Bind Attributes
    gl.bindAttribLocation(programObject, 0, "vertex");

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

    var ret = new Object();
    ret.id = programObject;
    // Look up uniform locations
    ret.mvpLoc = gl.getUniformLocation(programObject, "modelviewProj");

    return ret;
}

function initPointWidgetShaders(gl) {
    log("here!");
    var vertexShader = loadShader(gl, gl.VERTEX_SHADER, POINTWIDGET_VERT_SRC);
    var fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, POINTWIDGET_FRAG_SRC);
    // Create the program object
    var programObject = gl.createProgram();
    gl.attachShader(programObject, vertexShader);
    gl.attachShader(programObject, fragmentShader);

    // Bind Attributes
    gl.bindAttribLocation(programObject, 0, "vertex");
    //gl.bindAttribLocation(programObject, 1, "color");

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

    var ret = new Object();
    ret.id = programObject;
    // Look up uniform locations
    ret.mvpLoc = gl.getUniformLocation(programObject, "modelviewProj");
    ret.colorLoc = gl.getUniformLocation(programObject, "color");

    return ret;
}