// ---------------------------------
// Flappy Cube with Three.JS
// Author: Huilong
// ---------------------------------

// scene object variables
var renderer, scene, camera;
var cube;

// gameplay variables
var gameOver = false;
var cubeDied = false; // cube died when it no longer moves
var gameStarted = false; // flag for indicating whether waiting for start or started, used only before the first round
var cubeSize = 40;
var interspace = cubeSize*3.5;
var movingSpeed = 80; // obstacle moving speed per second
var obstacleDistance = 300;
var obstacleWidth = 100;
var obstacleContainer = new Array();
var clock = new THREE.Clock();
var deltaTime;
var g = 600;
var cubeSpeedY = 15;
var cubeFlySpeedY = 270;
var cubeFlyHeight = 50;
var score = 0;

// to control the scoring time and avoid score increasing per frame
var scoringTimeInterval = obstacleDistance/movingSpeed;
var scoringTimer = scoringTimeInterval;

// playing field variables
var fieldWidth = 1000, fieldHeight = 500, fieldDepth = 100;

/*
 * setup(): The start point for the game
*/
function setup(){
	createScene();
	draw();
}

/*
 * createScene(): create the game scene
*/
function createScene(){
	// set the scene size
	var WIDTH = 640;
	var HEIGHT = 360;
	
	// set camera attributes
	var VIEW_ANGLE = 50,
		ASPECT = WIDTH/HEIGHT,
		NEAR = 0.1,
		FAR = 10000;
	
	// create a WebGL renderer, camera and a scene
	renderer = new THREE.WebGLRenderer();
	// start the renderer
	renderer.setSize(WIDTH, HEIGHT);

	camera = new THREE.OrthographicCamera(-500,500,250, -250, 0.1, 1000);
	
	scene = new THREE.Scene();

	// Add the camera to the scene
	scene.add(camera);
	
	// Set a default position for the camera
	camera.position.z = 200;

	// Attach the render-supplied DOM element to the gameCanvas
	var c = document.getElementById("gameCanvas");
	c.appendChild(renderer.domElement);
	
	// Make a cube with Lambert material
	// ---------------------------------
	// Lower fragments can increase performance
	var cubeWidth = cubeSize,
		cubeHeight = cubeSize,
		cubeDepth = cubeSize,
		cubeQuality = 1;
	// create the cube's material
	var cubeMaterial = new THREE.MeshLambertMaterial(
		{
			color: 0xb22222
		}
		);
	// create a cube with sphere geometry and the meterial
	cube = new THREE.Mesh(
		new THREE.BoxGeometry(
			cubeWidth, 
			cubeHeight, 
			cubeDepth,
			cubeQuality,
			cubeQuality,
			cubeQuality
			),
		cubeMaterial);
	// lift the cube to half of the playing space height
	cube.position.z = fieldDepth/2;
	// set the cube x position in the left of the play field
	cube.position.x = -fieldWidth/3;

	// add the cube to the scene
	scene.add(cube);
	
	// Make sky background plane
	// ---------------------------------
	// sky plane vars
	var planeWidth = fieldWidth,
		planeHeight = fieldHeight,
		planeQuality = 10;
	// create plane's material
	var planeMaterial = new THREE.MeshLambertMaterial(
	{
		color: 0x87ceeb
	}
	);
	// create the playing surface plane
	// PlaneGeometry(width, height, widthSegments, heightSegments)
	// width ¡ª Width along the X axis. height ¡ª Height along the Y axis.
	var plane = new THREE.Mesh(
		// changed PlaneGeometry to PlaneBufferGeometry for lower memory footprint
		new THREE.PlaneBufferGeometry(
			planeWidth,
			planeHeight,
			planeQuality,
			planeQuality
		),
		planeMaterial);

	scene.add(plane);
	
	// Obstacles
	// ---------------------------------
	initObstacles();

	// Lights
	// ---------------------------------
	// create a directional light
	var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
	directionalLight.position.set( 0, 0, 100 );
	directionalLight.rotation.x = 90*Math.PI/180;
	scene.add( directionalLight );
}

/*
 * draw(): Run every frame, handle all the rendering and game logic
*/
function draw(){
	// get delta time
	deltaTime = clock.getDelta();
	
	// draw THREE.js scene
	renderer.render(scene, camera);
	
	// This will loop the draw() function
	// Attention: requestAnimationFrame() does not guarantee a fixed frame-rate
	// and not all browsers natively support the call.
	// You need time-deltas to calculate the realistic physics
	requestAnimationFrame(draw);
	
	// process game logic
	if(!gameStarted){
		waitStart();
	}else{
		if(!gameOver){
			moveObstacles();
			cubeUpdate();
		}
		else{
			if(cubeDied){
				waitReStart();
			}
			else{
				cubeFall();
			}
		}
	}
}

function initObstacles(){
	// Obstacles
	// ---------------------------------
	// set up the column vars
	// If you declare a variable, without using "var", the variable always becomes GLOBAL.
	var columnWidth = obstacleWidth,
		columnHeight = 500,
		columnDepth = 100,
		columnQuality = 1;
	// create the column's material
	var columnMaterial = new THREE.MeshLambertMaterial(
		{
		  color: 0x228b22
		}
	);
	var columnGeometry = new THREE.BoxGeometry(
			columnWidth,
			columnHeight,
			columnDepth,
			columnQuality,
			columnQuality,
			columnQuality);
	// make sure that the obstacles fill up the scene with an obstacle distance specified by obstacleDistance
	for(var i=0; i<fieldWidth/obstacleDistance+1; i++){
		// create obstacle as an empty object container of two column1s
		var obstacle = new THREE.Object3D();

		// set up column1
		var column1 = new THREE.Mesh(
			// Use BoxGeometry instead of CubeGeometry
			columnGeometry,
			columnMaterial);
		// make column1 the upper column
		column1.position.y = columnHeight/2 + interspace/2;
		// set up column2
		var column2 = new THREE.Mesh(
			// Use BoxGeometry instead of CubeGeometry
			columnGeometry,
			columnMaterial);
		// make column1 the lower column
		column2.position.y = -columnHeight/2 - interspace/2;
		// add the columns to the obstacle
		obstacle.add(column1);
		obstacle.add(column2);
		// lift obstacle at the same height of cube
		obstacle.position.z = cube.position.z;
		// differ the positions of obstacles
		obstacle.position.x = i*obstacleDistance;
		// randomize the interspace height
		obstacle.position.y = (Math.random()*2 - 1) * 0.9 * (fieldHeight/2 - interspace/2);
		// push obstacle to the container
		obstacleContainer.push(obstacle);
		// add column1 to the scene
		scene.add(obstacle);
	}
}

/*
 * moveObstacles(): Move the obstacles towards the cube
*/
function moveObstacles(){
	//When updating the position movingSpeed * deltaTime end up with a floating point value. 
	//It sometimes rounds up to the next highest pixel position, sometimes down, making movement not smoothed
	// So the Math.ceil function is very important for smoothing the movement!
	var translation = (movingSpeed * deltaTime);
	var maxPositionX = -10000;
	for(var i=0; i<obstacleContainer.length; i++){
		var obstacle = obstacleContainer[i];
		// obtain the max x position of obstacles for putting back the obstacle out of the left bound to the very right
		if(obstacle.position.x > maxPositionX){
			maxPositionX = obstacle.position.x;
		}
	}
	scoringTimer += deltaTime;
	for(var i=0; i<obstacleContainer.length; i++){
		var obstacle = obstacleContainer[i];
		if(obstacle.position.x < fieldWidth/-2 + obstacleWidth/-2){
			obstacle.position.x = maxPositionX + obstacleDistance;
			// modify the interspace height
			obstacle.position.y = (Math.random()*2 - 1) * 0.9 * (fieldHeight/2 - interspace/2);
		}
		obstacle.position.x -= translation;
		// check if the cube passed the obstacle and scored
		var scoringPositionX = obstacle.position.x + obstacleWidth/2 + cubeSize;
		if(scoringPositionX <= cube.position.x+cubeSize/2
			&& scoringPositionX >= cube.position.x-cubeSize/2){
				if(scoringTimer >= scoringTimeInterval){
					scoringTimer = 0;
					score ++;
					document.getElementById("score").innerHTML = score;	
					if(score >= 10 && score < 20){
						document.getElementById("message").innerHTML = "Not Bad!";	
					}
					else if(score >=20 && score < 50){
						document.getElementById("message").innerHTML = "Very good!";	
					}
					else if(score >=50 && score < 100){
						document.getElementById("message").innerHTML = "Excellent!";	
					}
					else if(score >=100){
						document.getElementById("message").innerHTML = "You are the hero!";	
					}
				}
		}
		// cube collision detection
		if(cube.position.x <= obstacle.position.x + obstacleWidth/2 + cubeSize/2
			&& cube.position.x >= obstacle.position.x - obstacleWidth/2 - cubeSize/2
			&& !(cube.position.y < obstacle.position.y + interspace/2 - cubeSize/2 
				&& cube.position.y > obstacle.position.y - interspace/2 + cubeSize/2)
			){
				gameOverFun();
			}
	}
}

/*
 * cubeUpdate(): update the cube
*/
function cubeUpdate(){
	// fly up if key pressed
	if(Key.isDown(Key.F)){
		cubeSpeedY = -cubeFlySpeedY;
	}
	// gravity effect
	cube.position.y -= Math.ceil(deltaTime*cubeSpeedY+g*deltaTime*deltaTime/2);
	cubeSpeedY += g*deltaTime;
	// if cube touch the floor
	if(cube.position.y < -fieldHeight/2+cubeSize/2){
		gameOverFun();
		cubeDied = true;
		cube.position.y = -fieldHeight/2+cubeSize/2;
	}
	// limit the cube under the ceiling of the field
	if(cube.position.y > fieldHeight/2-cubeSize/2){
		cube.position.y = fieldHeight/2-cubeSize/2;
		cubeSpeedY = 0;
	}
}

/*
 * waitStart(): wait for space key pressed to start
*/
function waitStart(){
	if(Key.isDown(Key.F)){
		gameStarted = true;
	}
}

/*
 * waitReStart(): wait restart game after cube died
*/
function waitReStart(){
	if(Key.isDown(Key.F)){
		// re-init the cube color/position and obstacles
		cube.position.y = 0;
		cube.material.color.setHex(0xb22222);
		
		// reset the positions of obstacles
		//-----------------------------------
		// get the most left obstacle's position
		var minPositionX = 10000;
		for(var i=0; i<obstacleContainer.length; i++){
			var obstacle = obstacleContainer[i];
			if(obstacle.position.x < minPositionX){
				minPositionX = obstacle.position.x;
			}
		}
		// all the obstacle move to right
		for(var i=0; i<obstacleContainer.length; i++){
			var obstacle = obstacleContainer[i];
			obstacle.position.x += 0 - minPositionX;
			// set the height of obstacle
			obstacle.position.y = (Math.random()*2 - 1) * 0.9 * (fieldHeight/2 - interspace/2);
		}
		// move the obstacle
		movingSpeed = 80;
		// reset flags
		gameOver = false;
		cubeDied = false;
		// reset score
		score = 0;
		document.getElementById("score").innerHTML = score;	
		// reset message
		document.getElementById("message").innerHTML = "Come on!";
	}
}
/*
 * gameOverFun(): called when game over detected
*/
function gameOverFun(){
	gameOver = true;
	cubeSpeedY = 0;
	movingSpeed = 0;
	document.getElementById("message").innerHTML = "Game Over";
	cube.material.color.setHex(0x8b8989);
}

/*
 * cubeFall(): called after game over
*/
function cubeFall(){
	// gravity effect fall
	cube.position.y -= Math.ceil(deltaTime*cubeSpeedY+g*deltaTime*deltaTime/2);
	cubeSpeedY += g*deltaTime;
	// if cube touch the floor
	if(cube.position.y < -fieldHeight/2+cubeSize/2){
		cube.position.y = -fieldHeight/2+cubeSize/2;
		cubeDied = true;
	}
	// if cube touch the upper face of column
	// using cubeSize/3 as left and right border margin for more real effect
	for(var i=0; i<obstacleContainer.length; i++){
		var obstacle = obstacleContainer[i];
		if(cube.position.x < obstacle.position.x + obstacleWidth/2 + cubeSize/3
			&& cube.position.x > obstacle.position.x - obstacleWidth/2 - cubeSize/3
			&& cube.position.y < obstacle.position.y - interspace/2 + cubeSize/2){
				cube.position.y = obstacle.position.y - interspace/2 + cubeSize/2;
				cubeDied = true;
				break;
			}
	}
}