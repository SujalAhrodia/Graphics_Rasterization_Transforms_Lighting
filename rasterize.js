/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = 
//"https://ajgavane.github.io/Computer_Graphics/triangles.json";
"http://localhost:8000/triangles.json";
//"https://pages.github.ncsu.edu/cgclass/exercise5/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://pages.github.ncsu.edu/cgclass/exercise5/ellipsoids.json"; // ellipsoids file loc
var Eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var Light = new vec3.fromValues(0.5,0.5,-0.5);

var lookAt = new vec3.fromValues(0.0, 0.0, 1.0);
var lookAtP = new vec3.fromValues(0.5, 0.5, 0);
var up = new vec3.fromValues(0.0, 1.0, 0.0);

/* input globals */
var inputTriangles; // the triangles read in from json
var numTriangleSets = 0; // the number of sets of triangles
var triSetSizes = []; // the number of triangles in each set

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffers = []; // this contains vertex coordinates in triples, organized by tri set
var triangleBuffers = []; // this contains indices into vertexBuffers in triples, organized by tri set
var vertexNormalBuffers = []; //this contains vertex normals in triplets 

var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib;
var vertexMode;
var vertexAmbient;
var vertexDiffuse;
var vertexSpecular;
var vertexExp;

var vertexEye;
var vertexLight;

var modelMatrixULoc; // where to put the model matrix for vertex shader
var viewMatrixULoc; //view matrix location
var perspectiveMatrixULoc;  //perpective matrix location

var mode = 0.0;
var triangleSelection = [];
var triangleSelection_index = -1;

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

            inputTriangles[whichSet].mMatrix = mat4.create();
            
            triangleSelection.push(0);

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

        varying vec3 P;
        varying vec3 N;

        void main(void) {
            vec4 position = uModelMatrix * vec4(vertexPosition, 1.0); 
            P = vec3(position);
            N = normalize(vertexNormal);

            gl_Position = uViewMatrix * vec4(P, 1.0);

            gl_Position = uPerpectiveMatrix * gl_Position;

           //gl_Position = uModelMatrix * vec4(vertexPosition, 1.0);
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


// render the loaded model
function renderTriangles() {
    requestAnimationFrame(renderTriangles);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers    

    lookAtP = new vec3.fromValues(0,0,0);

    vec3.add(lookAtP, Eye, lookAt);

    var viewMat = mat4.lookAt(mat4.create(), Eye, lookAtP, up);
    console.log(viewMat);

    var pMat = mat4.perspective(mat4.create(), Math.PI/2, 1.0, 0.5, 100.0);

    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) { 
        
        // pass modeling matrix for set to shader
        gl.uniformMatrix4fv(modelMatrixULoc, false, inputTriangles[whichTriSet].mMatrix);
        gl.uniformMatrix4fv(viewMatrixULoc, false, viewMat);
        gl.uniformMatrix4fv(perspectiveMatrixULoc, false, pMat);


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

    vec4.transformMat4(t, t, inputTriangles[whichTriSet].mMatrix);

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
        console.log("scale:"+inputTriangles[whichTriSet].mMatrix);

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
        inputTriangles[triangleSelection_index].Ka[0] = (inputTriangles[triangleSelection_index].Ka[0] + 0.1);
        inputTriangles[triangleSelection_index].Ka[1] = (inputTriangles[triangleSelection_index].Ka[1] + 0.1);
        inputTriangles[triangleSelection_index].Ka[2] = (inputTriangles[triangleSelection_index].Ka[2] + 0.1);
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
        inputTriangles[triangleSelection_index].Ks[0] = (inputTriangles[triangleSelection_index].Ks[0] + 0.1);
        inputTriangles[triangleSelection_index].Ks[1] = (inputTriangles[triangleSelection_index].Ks[1] + 0.1);
        inputTriangles[triangleSelection_index].Ks[2] = (inputTriangles[triangleSelection_index].Ks[2] + 0.1);
    }
}

function inc_exp()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].n = (inputTriangles[triangleSelection_index].n + 1);
       
    }
}

function moveThings(e)
{   
    console.log(e.key);
    console.log(e.keyCode);
    console.log(e.charCode);

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
        case 'A':   break;

        case 'D':   break;

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
