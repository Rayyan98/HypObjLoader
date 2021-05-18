import * as THREE from './js/three.module.js';

import {OrbitControls} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/controls/OrbitControls.js';
import {OBJLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/OBJLoader.js';

var gl, canvas, program

var vertices = []
var colors = []
var normals = []
var textureCoords = [];

var vertBuffer
var vertBufferL
var colBuffer
var colBufferL
var normalBuffer
var normalBufferL
var TextBuffer
var TextBufferL

var modelViewMat
var modelViewMatL
var projectionMat
var projectionMatL
var currentViewElevation
var currentViewRot
var currentRotation
var currentRotationL
var currentWalkNudgeVal
var timeKeeper
var walking = false
var isFocus = false

var angle = 0
var movementEpsilon

function getPointAtT(startPoint, v, t)
{
    return add(scale(Math.cosh(t), startPoint), scale(Math.sinh(t), v))
}


function reflecPointInPoint(centerPoint, reflecPoint)
{
    var t = hyperbolicDist(centerPoint, reflecPoint)
    if(t == 0)
    {
        return reflecPoint
    }
    var v = tangentFromP1ToP2(reflecPoint, centerPoint)
    return getPointAtT(reflecPoint, v, 2 * t)
}


function reflectPoint(lineStartPoint, lineV, point)
{
    if(lineStartPoint == point)
    {
        return point
    }
    var tanhT = (point[2] * lineV[2] - point[0] * lineV[0] - point[1] * lineV[1]) / (point[0] * lineStartPoint[0] + point[1] * lineStartPoint[1] - point[2] * lineStartPoint[2])
    var t = Math.atanh(tanhT)
    var centerPoint = getPointAtT(lineStartPoint, lineV, t)
    return reflecPointInPoint(centerPoint, point)
}


class TilingPolygon {
	constructor(vertices){
		this.vertices = vertices
		this.polType == -1
	}
	
	expandOut()
	{
		if(this.polType == 0) // base case polygon
		{
			var polArr = []
			for(var i = 0; i < this.vertices.length; i++)
			{
				var newPol = this.reflectInSide(i + 1)
				newPol.polType = 2
				polArr.push(newPol)
			}
			return polArr
		}
		else if(this.polType == 1) // type 1 polygon case 1
		{
			var polArr = [this.reflectInSide(2)]
			polArr[0].polType = 1
			for(var i = 3; i < this.vertices.length - 1; i++)
			{
				var newPol = this.reflectInSide(i)
				newPol.polType = 2
				polArr.push(newPol)
			}
			return polArr			
		}
		else if(this.polType == 2) // type 1 polygon case 2
		{
			var polArr = [this.reflectInSide(2)]
			polArr[0].polType = 1
			for(var i = 3; i < this.vertices.length - 1; i++)
			{
				var newPol = this.reflectInSide(i)
				newPol.polType = 2
				polArr.push(newPol)
			}
			return polArr
		}
		else if(this.polType == 3) // type 2
		{
			var polArr = [this.reflectInSide(2)]
			polArr[0].polType = 1
			for(var i = 3; i <= this.vertices.length - 1; i++)
			{
				var newPol = this.reflectInSide(i)
				newPol.polType = 2
				polArr.push(newPol)
			}
			return polArr
		}
		else
		{
			throw("Polygon has no type")
			alert("This should not have happened")
			alert("Polygon has no type")
		}
	}
	
	FanRight(polAtVertex)
	{
		if(this.polType == 0) // base case polygon
		{
			return []
		}
		else if(this.polType == 1) // type 1 polygon case 1
		{
			var numReflec = polAtVertex - 4
            var reflecSeries = [this]
            for(var i = 0; i < numReflec; i++)
            {
                var pol = reflecSeries[reflecSeries.length - 1]
                var newPol = pol.reflectInSide(1)
                newPol.polType = 3
                reflecSeries.push(newPol)
            }
            return reflecSeries.slice(1)
		}
		else if(this.polType == 2) // type 1 polygon case 2
		{
			var numReflec = polAtVertex - 3
            var reflecSeries = [this]
            for(var i = 0; i < numReflec; i++)
            {
                var pol = reflecSeries[reflecSeries.length - 1]
                var newPol = pol.reflectInSide(1)
                newPol.polType = 3
                reflecSeries.push(newPol)
            }
            return reflecSeries.slice(1)
		}
		else if(this.polType == 3) // type 2
		{
			return []
		}
		else
		{
			throw("Polygon has no type")
			alert("This should not have happened")
			alert("This alert message is coming after a throw")
		}
	}
	
	reflectInSide(side)
	{
		if(side > this.vertices.length || side < 1)
		{
			throw("Polygon does not have this many sides")
		}
		else
		{
			var p1 = this.vertices[side - 1]
			var p2 = this.vertices[side % (this.vertices.length)]
			var v = tangentFromP1ToP2(p1, p2)
			var newPol = []
			for(var i = 0; i < this.vertices.length; i ++)
			{
				var pR = this.vertices[(side - 1 + i) % this.vertices.length]
				newPol.push(reflectPoint(p1, v, pR))
			}
			var polRev = newPol.slice(1)
			polRev.reverse()
			var finalPol = newPol.slice(0, 1).concat(polRev)
			return new TilingPolygon(finalPol)
		}
	}
}



function hypRotateXY(angle)
{
    var v1 = vec4(1, 0, 0, 0)
    var v2 = vec4(0, 1, 0, 0)
    var v3 = vec4(0, 0, Math.cosh(angle), Math.sinh(angle))
    var v4 = vec4(0, 0, Math.sinh(angle), Math.cosh(angle))
    return mat4(v1, v2, v3, v4)
}


function hypRotateXZ(angle)
{
    var v1 = vec4(1, 0, 0, 0)
    var v2 = vec4(0, Math.cosh(angle), 0, Math.sinh(angle))
    var v3 = vec4(0, 0, 1, 0)
    var v4 = vec4(0, Math.sinh(angle), 0, Math.cosh(angle))
    return mat4(v1, v2, v3, v4)
}


function hypRotateYZ(angle)
{
    var v1 = vec4(Math.cosh(angle), 0, 0, Math.sinh(angle))
    var v2 = vec4(0, 1, 0, 0)
    var v3 = vec4(0, 0, 1, 0)
    var v4 = vec4(Math.sinh(angle), 0, 0, Math.cosh(angle))
    return mat4(v1, v2, v3, v4)    
}


function hypRotateYW(angle)
{
    var v1 = vec4(Math.cos(angle), 0, Math.sin(angle), 0)
    var v2 = vec4(0, 1, 0, 0)
    var v3 = vec4(-Math.sin(angle), 0, Math.cos(angle), 0)
    var v4 = vec4(0, 0, 0, 1)
    return mat4(v1, v2, v3, v4)
}


function hypRotateXW(angle)
{
    var v1 = vec4(1, 0, 0, 0)
    var v2 = vec4(0, Math.cos(angle), -Math.sin(angle), 0)
    var v3 = vec4(0, Math.sin(angle), Math.cos(angle), 0)
    var v4 = vec4(0, 0, 0, 1)
    return mat4(v1, v2, v3, v4)
}


function hypRotateZW(angle)
{
    var v1 = vec4(Math.cos(angle), -Math.sin(angle), 0, 0)
    var v2 = vec4(Math.sin(angle), Math.cos(angle), 0, 0)
    var v3 = vec4(0, 0, 1, 0)
    var v4 = vec4(0, 0, 0, 1)
    return mat4(v1, v2, v3, v4)    
}


function setupWebGL()
{    
    canvas = document.getElementById("gl-canvas")
    gl = WebGLUtils.setupWebGL(canvas)
    if (!gl) { alert("WebGL isn't available") }
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(128 / 255, 212 / 255, 255 / 255, 1.0)
    gl.enable(gl.DEPTH_TEST)
    program = initShaders(gl, "vertex-shader", "fragment-shader")
    gl.useProgram(program)
}


function setAttributeNorVariableLocation()
{
    normalBufferL = gl.getAttribLocation(program, "vNormal")
    gl.vertexAttribPointer(normalBufferL, 4, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(normalBufferL)
}


function setUniformVariableLocations()
{
    modelViewMatL = gl.getUniformLocation(program, 'modelViewMatrix')
    projectionMatL = gl.getUniformLocation(program, 'projectionMatrix')
    currentRotationL = gl.getUniformLocation(program, 'currentRot')
}


function setAttributeVertVariableLocation()
{
    // Associate out shader variables with our data buffer
    vertBufferL = gl.getAttribLocation(program, "vPosition")
    gl.vertexAttribPointer(vertBufferL, 4, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(vertBufferL)    
}


function setAttributeColVariableLocation()
{
    colBufferL = gl.getAttribLocation(program, "vColor")
    gl.vertexAttribPointer(colBufferL, 4, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(colBufferL)
}

function setAttributeTextureVariableLocation()
{
    TextBufferL = gl.getAttribLocation(program, "a_texcoord")
    gl.vertexAttribPointer(TextBufferL, 2, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(TextBufferL)
}


function bufferVertices()
{
    // Load the data into the GPU
    vertBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW)
}


function bufferColors()
{
    colBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW)
}

function bufferTextureCoordinates()
{
    TextBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, TextBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, flatten(textureCoords), gl.STATIC_DRAW)
}



function bufferNormals()
{
    normalBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW)
}


function polarToXYZW(r, phi, theta)
{
    var x = Math.sinh(r) * Math.sin(phi) * Math.cos(theta)
    var z = Math.sinh(r) * Math.sin(phi) * Math.sin(theta)
    var y = Math.sinh(r) * Math.cos(phi)
    var w = Math.cosh(r)
    return vec4(x,y,z,w)
}


function polarToXYZ(r, theta)
{
    var x = Math.sinh(r) * Math.cos(theta)
    var y = Math.sinh(r) * Math.sin(theta)
    var z = Math.cosh(r)
    return vec3(x, y, z)
}

function XYZToPolar(vertex)
{
    let r = Math.sqrt(Math.pow(vertex[0],2) + Math.pow(vertex[1],2) + Math.pow(vertex[2],2));
    let theta = Math.atan2(vertex[2],vertex[0]);
    let phi = Math.acos(vertex[1]/r);
    return vec3(r,phi,theta);
}

function convertVerticesToHyperbolic(object_vertices)
{
    let hyperbolicVertices = []
    for (var i = 0; i < object_vertices.length; i++)
    {
        // let y = object_vertices[i][2];
        // let z = object_vertices[i][1];

        // object_vertices[i][1] = y;
        // object_vertices[i][2] = z;
        let polar = XYZToPolar(object_vertices[i]);
        let hyperbolicVert = polarToXYZW(polar[0],polar[1],polar[2]);

        hyperbolicVertices.push(hyperbolicVert);
    }
    return hyperbolicVertices;
}


function tangentAtP(point, a, b, c)
{
    if(c === undefined)
    {
        var v1 = vec3(a, 0, a * point[0] / point[2])
        var v2 = vec3(0, b, b * point[1] / point[2])
        return add(v1, v2)    
    }
    else
    {
        var v1 = vec4(a, 0, 0, a * point[0] / point[3])
        var v2 = vec4(0, b, 0, b * point[1] / point[3])
        var v3 = vec4(0, 0, c, c * point[2] / point[3])
        return add(add(v1, v2), v3)
    }
}


function tangentAtPNormalized(point, a, b)
{
    return minkowskiNormalize(tangentAtP(point, a, b))
}


function hyperbolicDist(point1, point2)
{
    if(point1 == point2)
    {
        return 0
    }
    return Math.acosh(-minkowskiIP(point1, point2))
}


function tangentFromP1ToP2(point1, point2)
{
    var d = hyperbolicDist(point1, point2)
    if(point1.length == 3)
    {
        var a = (point2[0] - Math.cosh(d) * point1[0]) / Math.sinh(d)
        var b = (point2[1] - Math.cosh(d) * point1[1]) / Math.sinh(d)
        return tangentAtP(point1, a, b)    
    }
    else if(point1.length == 4)
    {
        var a = (point2[0] - Math.cosh(d) * point1[0]) / Math.sinh(d)
        var b = (point2[1] - Math.cosh(d) * point1[1]) / Math.sinh(d)
        var c = (point2[2] - Math.cosh(d) * point1[2]) / Math.sinh(d)
        return tangentAtP(point1, a, b, c)    
    }
}


function minkowskiIPRaw(v1, v2)
{
    var temp = 0
    for(var i = 0; i < v1.length - 1; i++)
    {
        temp += v1[i] * v2[i]
    }
    temp -= v1[v1.length - 1] * v2[v1.length - 1]
    return temp
}


function minkowskiIP(v1, v2)
{
    return Math.min(minkowskiIPRaw(v1, v2), -1)
}


function minkowskiNorm(v)
{
    return Math.sqrt(minkowskiIP(v, v))
}


function minkowskiNormalize(v)
{
    return scale(1 / minkowskiNorm(v), v)
}


function computeTilingLength(polSides, polAtVCount)
{
    var angleC = Math.PI * 2 / polSides
    var angleA = Math.PI * 2 / polAtVCount * 0.5
    var angRatio = Math.pow(Math.sin(angleA) / Math.sin(angleC), 2)
    var a = (1 - Math.cos(angleC)) * angRatio
    var b = -1
    var c = (Math.cos(angleC) - 1) * angRatio + 1
    var coshC1 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
    var coshC2 = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a)
    var c1 = Math.acosh(coshC1)
    var c2 = Math.acosh(coshC2)
    return c1
}


function mixVerts(v1, v2, alpha)
{
    var dist = hyperbolicDist(v1, v2)
    // console.log(minkowskiIPRaw(v1, v1), minkowskiIPRaw(v2, v2))
    var desireDist = alpha * dist
    var v = tangentFromP1ToP2(v1, v2)
    var finalV = getPointAtT(v1, v, desireDist)
    return finalV
}


function detTwobyTwo(a, b, c, d)
{
    return a * d - b * c
}


function detThreeByThree(vec1, vec2, vec3)
{
    let a = detTwobyTwo(vec2[1], vec2[2], vec3[1], vec3[2]) * vec1[0]
    let b = -detTwobyTwo(vec2[0], vec2[2], vec3[0], vec3[2]) * vec1[1]
    let c = detTwobyTwo(vec2[0], vec2[1], vec3[0], vec3[1]) * vec1[2]
    return a + b + c
}


function normalToHypAtVertex(vertex)
{
    return vec4(2 * vertex[0], 2 * vertex[1], 2 * vertex[2], -2 * vertex[3])
}


function normalInHypAtVertex(point, vV1, vV2)
{
    let v3 = normalToHypAtVertex(point)
    let v1 = [...vV1]
    let v2 = [...vV2]
    v1[3] = v1[3]
    v2[3] = v2[3]
    // v3[3] = -v3[3]
    let a = detThreeByThree(v1.slice(1), v2.slice(1), v3.slice(1))
    let b = detThreeByThree(v1.slice(0, 1).concat(v1.slice(2)), v2.slice(0, 1).concat(v2.slice(2)), v3.slice(0, 1).concat(v3.slice(2)))
    let c = detThreeByThree(v1.slice(0, 2).concat(v1.slice(3)), v2.slice(0, 2).concat(v2.slice(3)), v3.slice(0, 2).concat(v3.slice(3)))
    let d = detThreeByThree(v1.slice(0, 3), v2.slice(0, 3), v3.slice(0, 3))
    let returnVec = vec4(a, b, c, d)
    let lengthV = Math.sqrt(minkowskiIPRaw(returnVec, returnVec))
    returnVec = scale(1 / lengthV, returnVec)
    // console.log(minkowskiIPRaw(returnVec, returnVec))
    return returnVec
}


function changeMov()
{
    var val = prompt("Provide new move speed. Current mov speed shown", movementEpsilon);
    if (val == null || val == ""){

    } else if(val != 0){
        movementEpsilon = val
    }
}


window.onload = function init() {

    setupWebGL()    
    setUniformVariableLocations()

    movementEpsilon = 0.02

    let changeMovBut = document.getElementById("changeMovBut")
    changeMovBut.addEventListener("click", changeMov)

    var person = prompt("Please Provide url or relative / absolute path to obj file. Cancel for default.", "Harry Potter");
    if (person == null || person == "") {
      alert("Default Scene Applied")
      person = "https://raw.githubusercontent.com/Rayyan98/HypObtTxtLoader/main/windmill.obj"
    }
    
    var person2 = prompt("Please Provide url or relative / absolute path to texture file. Cancel for default.", "Harry Potter");
    if (person2 == null || person2 == "") {
      alert("Default Texture Applied")
      person2 = "https://raw.githubusercontent.com/Rayyan98/HypObtTxtLoader/main/unamed2.jpg"
    }


    var hyperbolicObject = [];

    const canvasTjs = document.querySelector('#canvasTjs');
    const rendererTjs = new THREE.WebGLRenderer({canvasTjs}); 
    
    const objLoader = new OBJLoader();
    var object_vertices = [];
    //const mtl = fetch("windmill.mtl");
    // var matText = ''
    // $.ajax({ type: "GET",   
    //          url: "http://localhost:8080/windmill.mtl",   
    //          async: false,
    //          success : function(text)
    //          {
    //              matText = text;
    //          }
    // });
    //console.log(matText)

    var texcoordLocation = gl.getAttribLocation(program, "a_texcoord");

    var textureLocation = gl.getUniformLocation(program, "u_texture");


    // Create a texture.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
     
    // Fill the texture with a 1x1 blue pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 255, 255]));
     
    // Asynchronously load an image

    const options = {mode: 'cors'};

    fetch(person2, options).then(function(response) {
    if (!response.ok) {
        throw response;
    }
    return response.blob();
    }).then(function(blob) {
    console.log(blob)
    return createImageBitmap(blob);
    }).then(function(bitmap) {
        var image = new Image();
        image.src = bitmap;
        // Now that the image has loaded make copy it to the texture.
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, bitmap);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.uniform1i(textureLocation, 0);
    });


    //gl.uniform1i(textureLocation, 0);
    textureCoords = [];
    objLoader.load(person, function(object)
    {
        console.log(object);
        object.traverse(function(node)
        {
            if (node.isMesh)
            {
                console.log("textcoors",node.geometry.attributes.uv.array.length);
                console.log("verts",node.geometry.attributes.position.array.length)

                let uv = node.geometry.attributes.uv.array
                for (var j = 0; j < uv.length; j= j+2)
                {
                    let text_C = vec2(uv[j],uv[j+1]);

                    textureCoords.push(text_C)
                }
                
                //console.log(node)
                let pos = node.geometry.attributes.position;
                //console.log(node)
                for (var i = 0; i < pos.count; i++)
                {
                    let vertex = new THREE.Vector3().fromBufferAttribute(pos, i);

                    let v = vec3(vertex.x,vertex.y,vertex.z);
                    object_vertices.push(v);
                }
                //console.log(object_vertices);

                //console.log(pos);

                //let vertex = new THREE.Vector3().fromBufferAttribute(pos, 1128);
                //console.log(vertex);
            }
        })
        //console.log(object_vertices);
        console.log("BABABOI",object_vertices.length)
        object_vertices = ojectMinMax(object_vertices);
        //console.log("YAHAN AYA");
        // object_vertices = [vec3(0,1.2,1.8)];
        hyperbolicObject = convertVerticesToHyperbolic(object_vertices);
        vertices = vertices.concat(hyperbolicObject);
        
        normals = []

        for(var i = 0; i < vertices.length; i += 3)
        {
            let v1 = vertices[i]
            let v2 = vertices[i+1]
            let v3 = vertices[i+2]
    
            // let vTemp = mixVerts(v2, v3, 0.5)
            // let vTemp2 = mixVerts(v1, vTemp, 0.5)
            // let vNorm = normalInHypAtVertex(vTemp2, tangentFromP1ToP2(vTemp2, v2), tangentFromP1ToP2(vTemp2, v3))
    
            // normals.push(vNorm)
            // normals.push(vNorm)
            // normals.push(vNorm)
    
            normals.push(normalInHypAtVertex(v1, tangentFromP1ToP2(v1, v2), tangentFromP1ToP2(v1, v3)))
            normals.push(normalInHypAtVertex(v2, tangentFromP1ToP2(v2, v1), tangentFromP1ToP2(v2, v3)))
            normals.push(normalInHypAtVertex(v3, tangentFromP1ToP2(v3, v1), tangentFromP1ToP2(v3, v2)))
        }

        //colors = []
        for(var i = 0; i < vertices.length / 3; i++)
        {
            // var localColor = vec4(Math.random(), Math.random(), Math.random())
            var localColor = vec4(1,0,0,1)
            for(var j = 0; j < 3; j++)
            {
                colors.push(localColor)
            }
        }

        bufferVertices()
        setAttributeVertVariableLocation()

        bufferColors()
        setAttributeColVariableLocation()
        //console.log(hyperbolicObject);

        bufferNormals()
        setAttributeNorVariableLocation()
        //console.log(hyperbolicObject);

        bufferTextureCoordinates()
        setAttributeTextureVariableLocation()

        

        //console.log(object.children[0].vertices.length);
        // for (var i = 0; i < object.scene.children.length; i++)
        // {
        //     for (var j = 0; j < object.scene.children[i].geometry.vertices.length; j++)
        //     {
        //         object_vertices = object_vertices.concat(object.scene.children[i].geometry.vertices[j]);   
        //     }
            
        // }
    })
    //console.log(object.geometry.vertices.length)
    //console.log("YAHAN PEHLE AAYA");
    //console.log(hyperbolicObject);

    var polSides = 4
    var polAtVertex = 5
    var sideLength = computeTilingLength(polSides, polAtVertex)
    var distO = Math.asinh(Math.sinh(sideLength) * Math.sin(Math.PI / polAtVertex) / Math.sin(Math.PI  * 2/ polSides))
	var cToCDist = Math.asinh(Math.sinh(distO) * Math.sin(Math.PI * 2 / polAtVertex / 2)) * 2

    var points = []

    for(var t = Math.PI / polSides; t < Math.PI * 2; t += Math.PI * 2/ polSides)
    {
        points.push(polarToXYZ(distO, t))
    }
	
	var startPol = new TilingPolygon(points)
	startPol.polType = 0
	
	var tilesByLevel = [[startPol]]

	var expCount = 2
	for(var i = 0; i < expCount; i++)
	{
		var currentLevel = tilesByLevel[tilesByLevel.length - 1]
		var newLevel = []
		for(var pol of currentLevel)
		{
			newLevel = newLevel.concat(pol.expandOut())
		}

        var newLevel2 = []
        for(var pol of newLevel)
        {
            newLevel2 = newLevel2.concat(pol.FanRight(polAtVertex))
        }
        newLevel = newLevel.concat(newLevel2)

		tilesByLevel.push(newLevel)
	}
		
    // var offsetMat = hypRotateYZ(-0.1)
    var offsetMat = mat4()
    var offsetMat2 = hypRotateYZ(0.5)
	for(var level = 0; level < tilesByLevel.length; level++)
	{
		for(var i = 0; i < tilesByLevel[level].length; i++)
		{

            // Triangles
            var localVs = []
            for(var v = 0; v < tilesByLevel[level][i].vertices.length; v++)
            {
                var groundLevel = -0.2
                var groundVert = tilesByLevel[level][i].vertices[v]
                var scaleFactor = Math.sqrt(groundLevel * groundLevel + 1)
                var someV = scale(scaleFactor, groundVert)
                localVs.push(vec4(someV[0], groundLevel, someV[1], someV[2]))
                // console.log(minkowskiIPRaw(localVs[localVs.length - 1], localVs[localVs.length - 1]))
            }

            var localTriangles = []
            var staticVert = localVs[0]
            for(var v = 1; v < localVs.length - 1; v++)
            {
                var vert1 = mult(offsetMat, staticVert)
                var vert2 = mult(offsetMat, localVs[v])
                var vert3 = mult(offsetMat, localVs[v+1])
                localTriangles.push(vert1, vert2, vert3)
            }

            var localVs2 = []
            for(var v = 0; v < localVs.length; v++)
            {
                var groundLevel = +1.4
                var groundVert = localVs[v].slice(1)
                var scaleFactor = Math.sqrt((groundLevel * groundLevel + 1) / -minkowskiIPRaw(groundVert, groundVert))
                // console.log(minkowskiIPRaw(groundVert, groundVert))
                localVs2.push(vec4(groundLevel, scale(scaleFactor, groundVert)))
                // console.log(minkowskiIPRaw(localVs2[localVs2.length - 1], localVs2[localVs2.length - 1]))
            }

            var localTriangles2 = []
            var staticVert = localVs2[0]
            for(var v = 1; v < localVs2.length - 1; v++)
            {
                var vert1 = mult(offsetMat, staticVert)
                var vert2 = mult(offsetMat, localVs2[v])
                var vert3 = mult(offsetMat, localVs2[v+1])
                localTriangles.push(vert1, vert2, vert3)
            }

            var walls = []
            for(var v = 0; v < localVs.length; v++)
            {
                var ind1 = v
                var ind2 = (v+1) % localVs.length
            
                // walls.push(localVs[ind1], localVs2[ind1], localVs[ind2], localVs[ind2], localVs2[ind2], localVs2[ind1])
            
                // var vert1 = localVs[ind1]
                // var vert2 = localVs2[ind1]
                // var vert3 = localVs2[ind2]
                // var vert4 = localVs[ind2]
                // var widthOfDoor = 0.4
                
                // var widthSpace = (1 - widthOfDoor) / 2
                // var doorBotLeft = mixVerts(vert1, vert4, widthSpace)
                // var doorBotRight = mixVerts(vert1, vert4, 1 - widthSpace)
            
                // var doorTop = mixVerts(vert2, vert3, 0.5)
            
                // walls.push(vert2, vert1, doorBotLeft)
                // walls.push(doorBotLeft, doorTop, vert2)
            
                // walls.push(vert4, vert3, doorTop)
                // walls.push(doorTop, doorBotRight, vert4)

                var vert1 = localVs[ind1]
                var vert2 = localVs2[ind1]
                var vert3 = localVs2[ind2]
                var vert4 = localVs[ind2]
                var heightOfDoor = 0.6
                var widthOfDoor = 0.4
                
                var widthSpace = (1 - widthOfDoor) / 2
                var doorBotLeft = mixVerts(vert1, vert4, widthSpace)
                var doorBotRight = mixVerts(vert1, vert4, 1 - widthSpace)

                var temp5 = mixVerts(vert2, vert3, widthSpace)
                var temp6 = mixVerts(vert2, vert3, 1 - widthSpace)

                // console.log("on")
                var doorTopLeft = mixVerts(doorBotLeft, temp5, heightOfDoor)
                // console.log("off")
                var doorTopRight = mixVerts(doorBotRight, temp6, heightOfDoor)

                walls.push(vert1, doorBotLeft, doorTopLeft)
                walls.push(vert1, doorTopLeft, vert2)
                walls.push(vert2, doorTopLeft, vert3)
                walls.push(doorTopLeft, doorTopRight, vert3)
                walls.push(vert4, vert3, doorTopRight)
                walls.push(vert4, doorTopRight, doorBotRight)

            }
            
            //vertices = vertices.concat(localTriangles)
		}		
	}

    //vertices = vertices.concat(hyperbolicObject);


    //colors = []
    for(var i = 0; i < vertices.length / 6; i++)
    {
        // var localColor = vec4(Math.random(), Math.random(), Math.random())
        var localColor = vec4(0,1,0,1)
        for(var j = 0; j < 6; j++)
        {
            colors.push(localColor)
        }
    }
        
    // compute model view matrix
    var eye = vec3(0, 0, 0)
    var at = vec3(0, 0, 1)
    var up = vec3(0, 1, 0)
    
    modelViewMat = lookAt(eye, at, up)
    gl.uniformMatrix4fv(modelViewMatL, false, flatten(modelViewMat))
    
    // projectionMat = ortho(-1, 1, -1, 1, -200, 200)
    projectionMat = perspective(120, canvas.width / canvas.height, 0.0001, 1000)
    gl.uniformMatrix4fv(projectionMatL, false, flatten(projectionMat))
    
    currentRotation = mat4()
    currentViewElevation = 0
    currentViewRot = mat4()
    currentWalkNudgeVal = 0
    timeKeeper = 0

    writeCurrentRotationMat()
        
    // bufferVertices()
    // setAttributeVertVariableLocation()

    // bufferColors()
    // setAttributeColVariableLocation()

    movementEpsilon = 0.02 * 4

    canvas.addEventListener("focus", function(event){
        canvas.requestPointerLock()
        isFocus = true
    })

    document.addEventListener("pointerlockchange", function(){
        if( document.pointerLockElement !== canvas)
        {
            isFocus = false
            document.activeElement.blur()
        }
    }, false)

    canvas.addEventListener("mousemove", e => {
        if(isFocus == true)
        {
            var x = e.movementX
            movementMultiply(hypRotateYW(x / 800))
            var y = e.movementY
            orientationMultiply(hypRotateXW(-y / 800), y / 800)
        }
    })

    canvas.addEventListener("keydown", function(event){
        if(event.keyCode == 65){ //strafe  left - key a
            nudgeCreater()
            movementMultiply(hypRotateYZ(-movementEpsilon))
        }
        else if(event.keyCode == 87){ //forward - key w
            nudgeCreater()
            movementMultiply(hypRotateXY(-movementEpsilon))
        }
        else if(event.keyCode == 68){ //strafe right - key d
            nudgeCreater()
            movementMultiply(hypRotateYZ(movementEpsilon))
        }
        else if(event.keyCode == 83){ //backward - key s
            nudgeCreater()
            movementMultiply(hypRotateXY(movementEpsilon))
        }
        else if(event.keyCode == 90){ //fly up - key z
            nudgeCreater()
            movementMultiply(hypRotateXZ(-movementEpsilon))
        }
        else if(event.keyCode == 67){ //fly down - key c
            nudgeCreater()
            movementMultiply(hypRotateXZ(movementEpsilon))
        }
        // else if(event.keyCode == 65) // a
        // {
        //     movementMultiply(hypRotateXW(-0.1))
        // }
        // else if(event.keyCode == 68) //d
        // {
        //     movementMultiply(hypRotateXW(0.1))
        // }
        // else if(event.keyCode == 87) //w
        // {
        //     orientationMultiply(hypRotateYW(-0.1), -0.1)
        // }
        // else if(event.keyCode == 83) //s
        // {
        //     orientationMultiply(hypRotateYW(0.1), 0.1)
        // }
    })

    render();
};

function ojectMinMax(object_vertices)
{
    //console.log(object_vertices[0]);
    let xmin = object_vertices[0][0];
    let xmax = object_vertices[0][0];
    let ymin = object_vertices[0][1];
    let ymax = object_vertices[0][1];
    let zmin = object_vertices[0][2];
    let zmax = object_vertices[0][2];
    for (var i = 0; i < object_vertices.length; i++)
    {
        if (object_vertices[i][0] < xmin)
        {
            xmin = object_vertices[i][0];
        }
        if (object_vertices[i][1] < ymin)
        {
            ymin = object_vertices[i][1];
        }
        if (object_vertices[i][2] < zmin)
        {
            zmin = object_vertices[i][2];
        }
        if (object_vertices[i][0] > xmax)
        {
            xmax = object_vertices[i][0];
        }
        if (object_vertices[i][1] > ymax)
        {
            ymax = object_vertices[i][1];
        }
        if (object_vertices[i][2] > zmax)
        {
            zmax = object_vertices[i][2];
        }

        object_vertices[i] = scale(1/50, object_vertices[i])
    }
    console.log(xmin,xmax,ymin,ymax,zmin,zmax)
    return object_vertices
}


function writeCurrentRotationMat()
{
    var orientationMat = hypRotateYZ(currentWalkNudgeVal)
    var modelViewmat = mult(orientationMat, currentRotation)
    var nudgedMat = mult(currentViewRot , modelViewmat)
    gl.uniformMatrix4fv(currentRotationL, false, flatten(nudgedMat))
}


function movementMultiply(mat)
{
    currentRotation = mult(mat, currentRotation)
}


function orientationMultiply(mat, val)
{
    if(Math.abs(currentViewElevation + val) < Math.PI / 2)
    {
        currentViewElevation += val
        currentViewRot = mult(mat, currentViewRot)
    }
}


function update()
{
    writeCurrentRotationMat()
}


function nudgeCreater()
{
    var timePeriod = 15
    var amplitude = 0.03
    // currentWalkNudgeVal = - amplitude - amplitude * Math.sin(timeKeeper * Math.PI * 2 / timePeriod - Math.PI / 2)
    currentWalkNudgeVal = 0
    timeKeeper += 1
}


function render()
{   
    update()
    gl.clear( gl.COLOR_BUFFER_BIT || gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length);
    window.requestAnimationFrame(render)
}