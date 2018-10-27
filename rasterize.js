/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://pages.github.ncsu.edu/cgclass/exercise5/ellipsoids.json"; // ellipsoids file loc

//Default Eye and Light positions
var Eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var Light = new vec3.fromValues(-3, 1, -0.5);
//(-3,1,-0.5)

//Default lookAt and up
var lookAt = new vec3.fromValues(0, 0, 1);
var lookAtP = new vec3.fromValues(0.5, 0.5, 0);
var up = new vec3.fromValues(0.0, 1.0, 0.0);

//Original system values
var origin = new vec3.fromValues(0,0,0);
var origin_lookAtP = new vec3.fromValues(0,0,-1);
var origin_up = new vec3.fromValues(0,1,0);

//Transformation system variables to origin
var origin_t= new vec3.fromValues(0,0,0);
var origin_tlookAtP = vec3.fromValues(0,0,0);
var origin_tup = new vec3.fromValues(0,0,0);
//original values

/* input globals */
var inputTriangles; // the triangles read in from json
var numTriangleSets = 0; // the number of sets of triangles
var triSetSizes = []; // the number of triangles in each set

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffers = []; // this contains vertex coordinates in triples, organized by tri set
var triangleBuffers = []; // this contains indices into vertexBuffers in triples, organized by tri set
var vertexNormalBuffers = []; //this contains vertex normals in triplets 

//location of attributes
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib;
var vertexMode;
var vertexAmbient;
var vertexDiffuse;
var vertexSpecular;
var vertexExp;

var vertexEye;
var vertexLight;

//location of uniform
var modelMatrixULoc; // where to put the model matrix for vertex shader
var viewMatrixULoc; //view matrix location
var perspectiveMatrixULoc;  //perpective matrix location
var normalMatrixULoc;

//Mode selection
var mode = 0.0;
var triangleSelection = [];
var triangleSelection_index = -1;

//global matrices
var viewMat;
// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd; // vtx coords to add to the coord array
        var triToAdd; // tri indices to add to the index array
        var nToAdd;

        // for each set of tris in the input file
        numTriangleSets = inputTriangles.length;
        for (var whichSet=0; whichSet<numTriangleSets; whichSet++) {
            
            // set up the vertex coord array
            inputTriangles[whichSet].coordArray = []; // create a list of coords for this tri set
            inputTriangles[whichSet].normalArray = []; // create a list of normals for this tri set
            
            inputTriangles[whichSet].Ka = inputTriangles[whichSet].material.ambient;
            inputTriangles[whichSet].Kd = inputTriangles[whichSet].material.diffuse;
            inputTriangles[whichSet].Ks = inputTriangles[whichSet].material.specular;
            inputTriangles[whichSet].n = inputTriangles[whichSet].material.n;

            inputTriangles[whichSet].mMatrix = mat4.create();
            inputTriangles[whichSet].nMatrix = mat4.create();

            triangleSelection.push(0);

            //console.log("values:"+ inputTriangles[whichSet].exp);

            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                inputTriangles[whichSet].coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);

                nToAdd = inputTriangles[whichSet].normals[whichSetVert];
                inputTriangles[whichSet].normalArray.push(nToAdd[0], nToAdd[1], nToAdd[2]);

            } // end for vertices in set

            // send the vertex coords to webGL
            vertexBuffers[whichSet] = gl.createBuffer(); // init empty vertex coord buffer for current set
            gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].coordArray),gl.STATIC_DRAW); // coords to that buffer

            //send vertex normals to webGL
            vertexNormalBuffers[whichSet] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffers[whichSet]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].normalArray),gl.STATIC_DRAW);

            // set up the triangle index array, adjusting indices across sets
            inputTriangles[whichSet].indexArray = []; // create a list of tri indices for this tri set
            triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length;
            
            for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                triToAdd = inputTriangles[whichSet].triangles[whichSetTri];
                inputTriangles[whichSet].indexArray.push(triToAdd[0],triToAdd[1],triToAdd[2]);
            } // end for triangles in set

            // send the triangle indices to webGL
            triangleBuffers[whichSet] = gl.createBuffer(); // init empty triangle index buffer for current tri set
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].indexArray),gl.STATIC_DRAW); // indices to that buffer
        } // end for each triangle set 
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; 
        
        uniform float mode;

        uniform vec3 Ka;
        uniform vec3 Kd;
        uniform vec3 Ks;
        uniform float n;

        uniform vec3 lightPosition;
        uniform vec3 eyePosition;

        varying vec3 P;
        varying vec3 N;

        void main(void) {

            vec3 L = normalize(lightPosition - P);

            float lambertian = max(dot(N,L),0.0);

            vec3 V = normalize(eyePosition - P);
            
            vec3 R = normalize(N);

            float specular = 0.0;
            
            if(mode == 0.0) //Blinn-Phong
            {
                vec3 H = normalize(V+L);
                specular = pow(max(dot(H,N),0.0),n);
            }
            else if (mode == 1.0) //Phong
            {
                R = normalize(reflect(-L,N));
                specular = pow(max(dot(R, V),0.0),n);
            }

            vec3 color = Ka + Kd*lambertian + Ks*specular;

            gl_FragColor = vec4(color,1.0); // coloring the fragments with computed color values
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        uniform mat4 uModelMatrix; 
        uniform mat4 uViewMatrix; 
        uniform mat4 uPerpectiveMatrix;
        uniform mat4 uNormalMatrix;

        varying vec3 P;
        varying vec3 N;

        void main(void) {
            vec4 position = uModelMatrix * vec4(vertexPosition, 1.0); 
            N = normalize(vertexNormal);
            P = vec3(position);
            N = normalize(vec3(uNormalMatrix * vec4(N, 0.0)));

            gl_Position = uViewMatrix * vec4(P, 1.0);

            gl_Position = uPerpectiveMatrix * gl_Position;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 

                vertexNormalAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexNormal");

                modelMatrixULoc = gl.getUniformLocation(shaderProgram, "uModelMatrix"); // ptr to mmat
                viewMatrixULoc = gl.getUniformLocation(shaderProgram, "uViewMatrix"); //ptr to vmat
                perspectiveMatrixULoc = gl.getUniformLocation(shaderProgram, "uPerpectiveMatrix");
                normalMatrixULoc = gl.getUniformLocation(shaderProgram, "uNormalMatrix");

                vertexMode = gl.getUniformLocation(shaderProgram, "mode");

                vertexAmbient = gl.getUniformLocation(shaderProgram, "Ka");
                vertexDiffuse = gl.getUniformLocation(shaderProgram, "Kd");
                vertexSpecular = gl.getUniformLocation(shaderProgram, "Ks");
                vertexExp = gl.getUniformLocation(shaderProgram, "n");

                vertexEye = gl.getUniformLocation(shaderProgram, "eyePosition");
                vertexLight = gl.getUniformLocation(shaderProgram, "lightPosition");

                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                gl.enableVertexAttribArray(vertexNormalAttrib); // input to shader from array
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders


function myLookAt(viewMat, Eye, lookAtP, up) 
{    
    var z = new vec3.fromValues(0,0,0);
    vec3.normalize(z, new vec3.fromValues(-lookAtP[0] + Eye[0], -lookAtP[1] + Eye[1], -lookAtP[2] + Eye[2]));
    var x = new vec3.fromValues(0,0,0);
    
    vec3.cross(x, z, up);
    vec3.normalize(x,x);
    
    var y = new vec3.fromValues(0,0,0);
    vec3.cross(y, x, z);
    vec3.normalize(y,y);
    
    viewMat[0] = x[0];
    viewMat[4] = x[1];
    viewMat[8] = x[2];
    viewMat[12] = -vec3.dot(x,Eye);
    viewMat[1] = y[0];
    viewMat[5] = y[1];
    viewMat[9] = y[2];
    viewMat[13] = -vec3.dot(y,Eye);
    viewMat[2] = z[0];
    viewMat[6] = z[1];
    viewMat[10] = z[2];
    viewMat[14] = -vec3.dot(z,Eye);
    viewMat[3] = 0;
    viewMat[7] = 0;
    viewMat[11] = 0;
    viewMat[15] = 1;

    return viewMat;
}

function Triangle_Normals() {
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        mat4.invert(inputTriangles[whichTriSet].nMatrix, inputTriangles[whichTriSet].mMatrix);
        mat4.transpose(inputTriangles[whichTriSet].nMatrix, inputTriangles[whichTriSet].nMatrix);
        //console.log(inputTriangles[whichTriSet].nMatrix);
    }
}
// render the loaded model
function renderTriangles() {
    requestAnimationFrame(renderTriangles);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers    


    var lookAtP = new vec3.fromValues(0,0,0);

    vec3.add(lookAtP, Eye, lookAt);

    viewMat = myLookAt(mat4.create(), Eye, lookAtP, up);
    //console.log(viewMat);

    var pMat = mat4.perspective(mat4.create(), Math.PI/2, 1.0, 0.5, 100);

    //transformation according to viewMatrix

    //transform origin
    var t = new vec4.fromValues(origin[0], origin[1], origin[2], 1);
    vec4.transformMat4(t, t, viewMat);
    origin_t[0] = t[0];
    origin_t[1] = t[1];
    origin_t[2] = t[2];

    //transform lookAtP
    var t = new vec4.fromValues(origin_lookAtP[0], origin_lookAtP[1], origin_lookAtP[2], 1);
    vec4.transformMat4(t, t, viewMat);
    origin_tlookAtP[0] = t[0];
    origin_tlookAtP[1] = t[1];
    origin_tlookAtP[2] = t[2];

    //transform up
    var t = new vec4.fromValues(origin_up[0], origin_up[1], origin_up[2], 1);
    vec4.transformMat4(t, t, viewMat);
    origin_tup[0] = t[0] - origin_t[0];
    origin_tup[1] = t[1] - origin_t[1];
    origin_tup[2] = t[2] - origin_t[2];

    Triangle_Normals();

    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) { 
        
        // pass modeling matrix for set to shader
        gl.uniformMatrix4fv(modelMatrixULoc, false, inputTriangles[whichTriSet].mMatrix);
        gl.uniformMatrix4fv(viewMatrixULoc, false, viewMat);
        gl.uniformMatrix4fv(perspectiveMatrixULoc, false, pMat);
        gl.uniformMatrix4fv(normalMatrixULoc, false, inputTriangles[whichTriSet].nMatrix);

        gl.uniform3fv(vertexEye, Eye);
        gl.uniform3fv(vertexLight, Light);

        gl.uniform1f(vertexMode, mode);
        gl.uniform3fv(vertexAmbient, inputTriangles[whichTriSet].Ka);
        gl.uniform3fv(vertexDiffuse, inputTriangles[whichTriSet].Kd);
        gl.uniform3fv(vertexSpecular, inputTriangles[whichTriSet].Ks);
        gl.uniform1f(vertexExp, inputTriangles[whichTriSet].n);

        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

        // vertex normal buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexNormalBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vertexNormalAttrib,3,gl.FLOAT,false,0,0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
    } // end for each tri set

} // end render triangles

/* MAIN -- HERE is where execution begins after window load */
function moveForward()
{
    var z = new vec3.fromValues(0.0,0.0,0.0);
    vec3.copy(z, lookAt);
    vec3.normalize(z,z);
    vec3.scale(z, z, 0.01);
    vec3.add(Eye, Eye, z);
}

function moveBackward()
{
    var z = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.copy(z, lookAt);
    vec3.normalize(z,z);
    vec3.scale(z, z, -0.01);
    vec3.add(Eye, Eye, z);
}

function moveUp()
{
    var y = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.copy(y, up);
    vec3.normalize(y,y);
    vec3.scale(y, y, 0.01);
    vec3.add(Eye, Eye, y);
}

function moveDown()
{
    var y = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.copy(y, up);
    vec3.normalize(y,y);
    vec3.scale(y, y, -0.01);
    vec3.add(Eye, Eye, y);
}

function moveLeft()
{
    var x = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.cross(x , lookAt, up);
    vec3.normalize(x, x);
    vec3.scale(x, x, 0.01);
    vec3.add(Eye, Eye, x);
}

function moveRight()
{
    var x = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.cross(x , lookAt, up);
    vec3.normalize(x, x);
    vec3.scale(x, x, -0.01);
    vec3.add(Eye, Eye, x);
}

function yaw_Left()
{
    var lookAtP = new vec3.fromValues(0, 0, 0);
    vec3.add(lookAtP, Eye, lookAt);

    var transformed_lookAt = new vec4.fromValues(0,0,0,1);
    var rotate_lookAt = mat4.create();

    transformed_lookAt[0] = lookAtP[0];
    transformed_lookAt[1] = lookAtP[1];
    transformed_lookAt[2] = lookAtP[2];

    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    
    //Rotate along Y-axis
    mat4.multiply(rotate_lookAt,
                    mat4.fromRotation(mat4.create(), 0.7*Math.PI/180, vec3.fromValues(0,1,0)),
                    rotate_lookAt);

    vec4.transformMat4(transformed_lookAt, transformed_lookAt, viewMat);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, rotate_lookAt);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, orig_view);

    //new lookAtP
    lookAtP[0] = transformed_lookAt[0];
    lookAtP[1] = transformed_lookAt[1];
    lookAtP[2] = transformed_lookAt[2];

    //setting the new lookAt
    vec3.subtract(lookAt, lookAtP, Eye);
    vec3.normalize(lookAt, lookAt);
}

function yaw_Right()
{
    var lookAtP = new vec3.fromValues(0, 0, 0);
    vec3.add(lookAtP, Eye, lookAt);

    var transformed_lookAt = new vec4.fromValues(0,0,0,1);
    var rotate_lookAt = mat4.create();

    transformed_lookAt[0] = lookAtP[0];
    transformed_lookAt[1] = lookAtP[1];
    transformed_lookAt[2] = lookAtP[2];

    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    //Rotate along Y-axis
    mat4.multiply(rotate_lookAt,
                    mat4.fromRotation(mat4.create(), -0.7*Math.PI/180, vec3.fromValues(0,1,0)),
                    rotate_lookAt);

    vec4.transformMat4(transformed_lookAt, transformed_lookAt, viewMat);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, rotate_lookAt);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, orig_view);

    //new lookAtP
    lookAtP[0] = transformed_lookAt[0];
    lookAtP[1] = transformed_lookAt[1];
    lookAtP[2] = transformed_lookAt[2];

    //setting the new lookAt
    vec3.subtract(lookAt, lookAtP, Eye);
    vec3.normalize(lookAt, lookAt);

}

function pitch_Up()
{   
    var lookAtP =new vec3.fromValues(0,0,0);
    vec3.add(lookAtP, Eye, lookAt);

    var transformed_lookAt = new vec4.fromValues(0,0,0,1);
    var rotate_lookAt = mat4.create();

    transformed_lookAt[0] = lookAtP[0];
    transformed_lookAt[1] = lookAtP[1];
    transformed_lookAt[2] = lookAtP[2];

    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    mat4.multiply(rotate_lookAt,
                    mat4.fromRotation(mat4.create(), -0.7*Math.PI/180, vec3.fromValues(1,0,0)),
                    rotate_lookAt);

    vec4.transformMat4(transformed_lookAt, transformed_lookAt, viewMat);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, rotate_lookAt);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, orig_view);

    //new lookAtP
    lookAtP[0] = transformed_lookAt[0];
    lookAtP[1] = transformed_lookAt[1];
    lookAtP[2] = transformed_lookAt[2];

    //setting the new lookAt
    vec3.subtract(lookAt, lookAtP, Eye);
    vec3.normalize(lookAt, lookAt);

    var up_t = new vec3.fromValues(0,0,0);
    vec3.add(up_t, Eye, up);

    var transformed_Up = new vec4.fromValues(0,0,0,1);
    var rotate_up = mat4.create();

    transformed_Up[0] = up_t[0];
    transformed_Up[1] = up_t[1];
    transformed_Up[2] = up_t[2];
    
    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    //rotate along X-axis
    mat4.multiply(rotate_up,
                    mat4.fromRotation(mat4.create(), -0.7*Math.PI/180, vec3.fromValues(1,0,0)),
                    rotate_up);

    vec4.transformMat4(transformed_Up, transformed_Up, viewMat);
    vec4.transformMat4(transformed_Up, transformed_Up, rotate_up);
    vec4.transformMat4(transformed_Up, transformed_Up, orig_view);

    //new Up 
    up_t[0] = transformed_Up[0];
    up_t[1] = transformed_Up[1];
    up_t[2] = transformed_Up[2];

    //setting the new Up
    vec3.subtract(up, up_t, Eye);
    vec3.normalize(up, up);
}

function pitch_Down()
{
    var lookAtP =new vec3.fromValues(0,0,0);
    vec3.add(lookAtP, Eye, lookAt);

    var transformed_lookAt = new vec4.fromValues(0,0,0,1);
    var rotate_lookAt = mat4.create();

    transformed_lookAt[0] = lookAtP[0];
    transformed_lookAt[1] = lookAtP[1];
    transformed_lookAt[2] = lookAtP[2];

    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    mat4.multiply(rotate_lookAt,
                    mat4.fromRotation(mat4.create(), 0.7*Math.PI/180, vec3.fromValues(1,0,0)),
                    rotate_lookAt);

    vec4.transformMat4(transformed_lookAt, transformed_lookAt, viewMat);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, rotate_lookAt);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, orig_view);

    //new lookAtP
    lookAtP[0] = transformed_lookAt[0];
    lookAtP[1] = transformed_lookAt[1];
    lookAtP[2] = transformed_lookAt[2];

    //setting the new lookAt
    vec3.subtract(lookAt, lookAtP, Eye);
    vec3.normalize(lookAt, lookAt);

    var up_t = new vec3.fromValues(0,0,0);
    vec3.add(up_t, Eye, up);

    var transformed_Up = new vec4.fromValues(0,0,0,1);
    var rotate_up = mat4.create();

    transformed_Up[0] = up_t[0];
    transformed_Up[1] = up_t[1];
    transformed_Up[2] = up_t[2];
    
    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    //rotate along X-axis
    mat4.multiply(rotate_up,
                    mat4.fromRotation(mat4.create(), 0.7*Math.PI/180, vec3.fromValues(1,0,0)),
                    rotate_up);

    vec4.transformMat4(transformed_Up, transformed_Up, viewMat);
    vec4.transformMat4(transformed_Up, transformed_Up, rotate_up);
    vec4.transformMat4(transformed_Up, transformed_Up, orig_view);

    //new Up 
    up_t[0] = transformed_Up[0];
    up_t[1] = transformed_Up[1];
    up_t[2] = transformed_Up[2];

    //setting the new Up
    vec3.subtract(up, up_t, Eye);
    vec3.normalize(up, up);
}

function Centroid(whichTriSet)
{
    var coordinates = inputTriangles[whichTriSet].coordArray;
    var centroid = vec3.fromValues(0.0, 0.0, 0.0);

    for (var  i = 0; i < coordinates.length/3; i++) 
    {
        centroid[0] = centroid[0] + coordinates[i*3];
        centroid[1] = centroid[1] + coordinates[i*3 + 1];
        centroid[2] = centroid[2] + coordinates[i*3 + 2];
    }

    vec3.scale(centroid, centroid, 1/(coordinates.length/3));

    var t = new vec4.fromValues(0, 0, 0, 1);
    t[0] = centroid[0];
    t[1] = centroid[1];
    t[2] = centroid[2];

    //transform mat4 to vec4
    vec4.transformMat4(t, t, inputTriangles[whichTriSet].mMatrix);
    
    //scaled centroid
    //console.log("transform="+ t);
    
    centroid[0] = t[0];
    centroid[1] = t[1];
    centroid[2] = t[2];

    return centroid;
}

function Highlight(whichTriSet, scaleFactor)
{
    var setCenter = Centroid(whichTriSet);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix, 
                    mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), setCenter)),
                    inputTriangles[whichTriSet].mMatrix);

    var scale = vec3.fromValues(scaleFactor, scaleFactor, scaleFactor);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix,
                    mat4.fromScaling(mat4.create(),scale),
                    inputTriangles[whichTriSet].mMatrix);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix,
                    mat4.fromTranslation(mat4.create(),setCenter),
                    inputTriangles[whichTriSet].mMatrix);
    //scaled matrix
    //console.log("scale:"+inputTriangles[whichTriSet].mMatrix);

}

function model_T(whichTriSet, Dir)
{
    var setCenter = Centroid(whichTriSet);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix,
                    mat4.fromTranslation(mat4.create, Dir),
                    inputTriangles[whichTriSet].mMatrix);
} 

function model_R(whichTriSet, axis, angle)
{
    var setCenter = Centroid(whichTriSet);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix, 
                    mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), setCenter)),
                    inputTriangles[whichTriSet].mMatrix);

    //in Radian
    var Angle = angle*Math.PI/180;

    mat4.multiply(inputTriangles[whichTriSet].mMatrix,
                    mat4.fromRotation(mat4.create(), Angle, axis),
                    inputTriangles[whichTriSet].mMatrix);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix, 
                    mat4.fromTranslation(mat4.create(), setCenter),
                    inputTriangles[whichTriSet].mMatrix);
}

function anti_Highlight()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        triangleSelection[triangleSelection_index] = 0;
        Highlight(triangleSelection_index, 1/1.2);   
    }
}

function inc_A()
{   
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].Ka[0] = (inputTriangles[triangleSelection_index].Ka[0] + 0.1)%1;
        inputTriangles[triangleSelection_index].Ka[1] = (inputTriangles[triangleSelection_index].Ka[1] + 0.1)%1;
        inputTriangles[triangleSelection_index].Ka[2] = (inputTriangles[triangleSelection_index].Ka[2] + 0.1)%1;
    }

}

function inc_D()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].Kd[0] = (inputTriangles[triangleSelection_index].Kd[0] + 0.1)%1;
        inputTriangles[triangleSelection_index].Kd[1] = (inputTriangles[triangleSelection_index].Kd[1] + 0.1)%1;
        inputTriangles[triangleSelection_index].Kd[2] = (inputTriangles[triangleSelection_index].Kd[2] + 0.1)%1;
    }
}

function inc_S()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].Ks[0] = (inputTriangles[triangleSelection_index].Ks[0] + 0.1)%1;
        inputTriangles[triangleSelection_index].Ks[1] = (inputTriangles[triangleSelection_index].Ks[1] + 0.1)%1;
        inputTriangles[triangleSelection_index].Ks[2] = (inputTriangles[triangleSelection_index].Ks[2] + 0.1)%1;
    }
}

function inc_exp()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].n = (inputTriangles[triangleSelection_index].n + 1)%20;
       
    }
}

function model_TLeft()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(-1.0,0.0,0.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);
    vec3.normalize(new_dir, new_dir);
    vec3.scale(new_dir, new_dir, 0.03);

    if(triangleSelection[triangleSelection_index] == 1)
    {
        model_T(triangleSelection_index, new_dir);
    }
}

function model_TRight()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(1.0,0.0,0.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);
    vec3.normalize(new_dir, new_dir);
    vec3.scale(new_dir, new_dir, 0.03);

    if(triangleSelection[triangleSelection_index] == 1)
    {
        model_T(triangleSelection_index, new_dir);
    }

}

function model_TBackward()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(0.0,0.0,-1.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);
    vec3.normalize(new_dir, new_dir);
    vec3.scale(new_dir, new_dir, 0.03);

    if(triangleSelection[triangleSelection_index] == 1)
    {
        model_T(triangleSelection_index, new_dir);
    }
}

function model_TForward()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(0.0,0.0,1.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);
    vec3.normalize(new_dir, new_dir);
    vec3.scale(new_dir, new_dir, 0.03);

    if(triangleSelection[triangleSelection_index] == 1)
    {
        model_T(triangleSelection_index, new_dir);
    }
}

function model_TUp()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(0.0,1.0,0.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);
    vec3.normalize(new_dir, new_dir);
    vec3.scale(new_dir, new_dir, 0.03);

    if(triangleSelection[triangleSelection_index] == 1)
    {
        model_T(triangleSelection_index, new_dir);
    }
}

function model_TDown()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(0.0,-1.0,0.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);
    vec3.normalize(new_dir, new_dir);
    vec3.scale(new_dir, new_dir, 0.03);

    if(triangleSelection[triangleSelection_index] == 1)
    {
        model_T(triangleSelection_index, new_dir);
    }
}

function model_yawLeft()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(0.0,1.0,0.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);

    vec3.normalize(new_dir, new_dir);

    if (triangleSelection[triangleSelection_index] == 1)
    {
        model_R(triangleSelection_index, new_dir, 10);
    }
}

function model_yawRight()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(0.0,1.0,0.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);

    vec3.normalize(new_dir, new_dir);

    if (triangleSelection[triangleSelection_index] == 1)
    {
        model_R(triangleSelection_index, new_dir, -10);
    }
}

function model_PitchUp()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(1.0,0.0,0.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);

    vec3.normalize(new_dir, new_dir);

    if (triangleSelection[triangleSelection_index] == 1)
    {
        model_R(triangleSelection_index, new_dir, 10);
    }
}

function model_PitchDown()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(1.0,0.0,0.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);

    vec3.normalize(new_dir, new_dir);

    if (triangleSelection[triangleSelection_index] == 1)
    {
        model_R(triangleSelection_index, new_dir, -10);
    }
}

function model_RollClock()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(0.0,0.0,1.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);

    vec3.normalize(new_dir, new_dir);

    if (triangleSelection[triangleSelection_index] == 1)
    {
        model_R(triangleSelection_index, new_dir, -10);
    }
}

function model_RollAClock()
{
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    var dir =  new vec4.fromValues(0.0,0.0,1.0,0.0);

    vec4.transformMat4(dir, dir, orig_view);

    var new_dir = vec3.fromValues(dir[0], dir[1], dir[2]);

    vec3.normalize(new_dir, new_dir);

    if (triangleSelection[triangleSelection_index] == 1)
    {
        model_R(triangleSelection_index, new_dir, 10);
    }
}

function moveThings(e)
{   
    switch(e.key)
    {
        case 'a': moveLeft();
                    break;
        case 'd': moveRight();
                    break;
        case 'w': moveForward();
                    break;
        case 's': moveBackward();
                    break;
        case 'q': moveUp();
                    break;
        case 'e': moveDown();
                    break;
        case 'A': yaw_Left();  
                    break;
        case 'D': yaw_Right();  
                    break;
        case 'W': pitch_Up();
                    break;
        case 'S': pitch_Down();
                    break;                    
        case 'ArrowLeft': 
                    if (triangleSelection_index != -1)
                    {
                        if(triangleSelection[triangleSelection_index] == 1)
                        {   
                            triangleSelection[triangleSelection_index] = 0;
                            Highlight(triangleSelection_index, 1/1.2);
                        }
                    }
                    triangleSelection_index-=1;

                    if (triangleSelection_index <= -1)
                    {
                        triangleSelection_index = numTriangleSets -1;
                    }
                    triangleSelection[triangleSelection_index] = 1;
                    Highlight(triangleSelection_index, 1.2);
                    //console.log(triangleSelection_index)
                    break;

        case 'ArrowRight': 
                    if(triangleSelection_index != -1)
                    {
                        if(triangleSelection[triangleSelection_index] == 1)
                        {
                            triangleSelection[triangleSelection_index] =0;
                            Highlight(triangleSelection_index, 1/1.2);
                        }
                    }
                    triangleSelection_index = (triangleSelection_index+1) % numTriangleSets;
                    triangleSelection[triangleSelection_index] = 1; //Phong
                    Highlight(triangleSelection_index, 1.2);
                    console.log("Right");
                    break;

        case ' ': anti_Highlight();
                    break;

        case 'b': mode = (mode+1)%2;
                    break;

        case 'n': inc_exp();
                    break;

        case '1': inc_A();
                    break;
        case '2': inc_D();
                    break;
        case '3': inc_S();
                    break;
        case 'k': model_TLeft();
                    break;
        case ';': model_TRight();
                    break;
        case 'o': model_TBackward();
                    break;
        case 'l': model_TForward();
                    break;
        case 'i': model_TUp();
                    break;
        case 'p': model_TDown();
                    break;
        case 'K': model_yawLeft();
                    break;
        case ':': model_yawRight();
                    break;
        case 'O': model_PitchUp();
                    break;
        case 'L': model_PitchDown();
                    break;
        case 'I': model_RollClock();
                    break;
        case 'P': model_RollAClock();
                    break;

        default:    break;

    }

}

function main() {
  window.addEventListener("keydown", moveThings, false);
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
} // end main
