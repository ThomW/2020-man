var config = {
    type: Phaser.AUTO,
    width: 896,
    height: 1024,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    parent: 'phaser-game',
    pixelArt: true,
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: {
            debug: true
        }
    },    
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);
var scene;
var player;
var swipeDir = [false, false, false, false]; // Stores boolean values in cardinals
var enemies = [];
var goal = null;
var viralLoad = 0;
var viralLoadBar;
var layer;
var timer = 0;
var scoreText;

var cursors;
var keys = [];

var NUM_ENEMIES = 13;

var PLAYER_VELOCITY = 160;

var GHOST_UPDATE_FREQUENCY = 200;

var D_UP = 0, D_RIGHT = 1, D_DOWN = 2, D_LEFT = 3;

function preload ()
{
    this.load.image('maze', 'maze.png');
    this.load.tilemapCSV('maze', 'maze.csv');

    this.load.image('player', 'player.png');
    this.load.image('goal', 'goal.png');
    this.load.image('enemy', 'enemy.png');
    this.load.image('logo', 'img/logo.png');

    this.load.bitmapFont('8bit', 'fonts/8bit.png', 'fonts/8bit.xml');

    this.load.scenePlugin({
        key: 'rexgesturesplugin',
        url: 'rexgesturesplugin.min.js',
        sceneKey: 'rexGestures'
    });
}

// The directions are 0(up), 1(right), 2(down), 3(left)
var directionDeltas = {
    0: [ 0, -32]
  , 1: [ 32,  0]
  , 2: [ 0,  32]
  , 3: [-32,  0]
}

function update() {

    // Setup swipe to work like a virtual joystick that remembers the
    // last swipe until a new one is issued. Unlike the keyboard controls,
    // up+down and left+right are not possible, so one turns off the other.
    if (this.swipeInput.isSwiped) {

        // Reset the joystick
        swipeDir[D_UP] = swipeDir[D_RIGHT] = swipeDir[D_DOWN] = swipeDir[D_LEFT] = false;

        // Point the joystick in the new direction
        if (this.swipeInput['up']) {
            swipeDir[D_UP] = true;
        }
        if (this.swipeInput['right']) {
            swipeDir[D_RIGHT] = true;
        }
        if (this.swipeInput['down']) {
            swipeDir[D_DOWN] = true;
        }
        if (this.swipeInput['left']) {
            swipeDir[D_LEFT] = true;
        }
    } 

    // Handle the input to control the player
    if (keys['KEY_W'].isDown || cursors.up.isDown || swipeDir[D_UP]) {
        player.body.setVelocityY(-PLAYER_VELOCITY);
        player.angle = -90;
        player.flipX = false;
    }
    if (keys['KEY_D'].isDown || cursors.right.isDown || swipeDir[D_RIGHT]) {
        player.body.setVelocityX(PLAYER_VELOCITY);
        player.angle = 0;
        player.flipX = false;
    }
    if (keys['KEY_S'].isDown || cursors.down.isDown || swipeDir[D_DOWN]) {
        player.body.setVelocityY(PLAYER_VELOCITY);
        player.angle = 90;
        player.flipX = false;
    }
    if (keys['KEY_A'].isDown || cursors.left.isDown || swipeDir[D_LEFT]) {
        player.body.setVelocityX(-PLAYER_VELOCITY);
        player.angle = 0;
        player.flipX = true;
    }

    // Sense if player is colliding with ghost
    enemies.forEach(function(e) {

        // If there's overlap, increase the player's viral load
        if(Phaser.Geom.Rectangle.Overlaps(e.getBounds(), player.getBounds())) {
            this.viralLoad += 0.25;
            setScore(this.viralLoad);
        }
    });
}

function updateEnemies() {

    enemies.forEach(function(e) {

        // Make sure the ghosts are at their target position to eliminate weird positioning
        if (e.data.tween) {
            e.data.tween.stop();
            e.x = e.data.targetX;
            e.y = e.data.targetY;
        }

        // Build an array containing all of the posssible directions the enemy could move
        // from their current position, omitting the opposite of their current direction.
        var possibleDirections = [];
        if (e.data.direction != 2) {
            if (layer.getTileAtWorldXY(e.x, e.y - 32, true).index == 11) {
                possibleDirections.push(0);
            }
        }
        if (e.data.direction != 0) {
            if (layer.getTileAtWorldXY(e.x, e.y + 32, true).index == 11) {
                possibleDirections.push(2);
            }
        }
        if (e.data.direction != 3) {
            if (layer.getTileAtWorldXY(e.x + 32, e.y, true).index == 11) {
                possibleDirections.push(1);
            }
        }
        if (e.data.direction != 1) {
            if (layer.getTileAtWorldXY(e.x - 32, e.y, true).index == 11) {
                possibleDirections.push(3);
            }
        }

        // If goal is visible, steer enemy toward it
        if (goal.active) {
            if (possibleDirections.length > 1 && goal.x > e.x && possibleDirections.includes(3)) {
                possibleDirections = possibleDirections.filter(item => item !== 3);
            }
            if (possibleDirections.length > 1 && goal.x < e.x && possibleDirections.includes(1)) {
                possibleDirections = possibleDirections.filter(item => item !== 1);
            }
            if (possibleDirections.length > 1 && goal.y < e.y && possibleDirections.includes(2)) {
                possibleDirections = possibleDirections.filter(item => item !== 2);
            }
            if (possibleDirections.length > 1 && goal.y > e.y && possibleDirections.includes(0)) {
                possibleDirections = possibleDirections.filter(item => item !== 0);
            }
        }

        // Randomly choose a new direction out of the possibilties
        var r = rnd(0, possibleDirections.length - 1);
        e.data.direction = possibleDirections[r];

        e.data.targetX = e.x + directionDeltas[e.data.direction][0];
        e.data.targetY = e.y + directionDeltas[e.data.direction][1];
        
        e.data.tween = scene.tweens.add({
            duration: GHOST_UPDATE_FREQUENCY - 1,
            targets: e,
            x: e.data.targetX,
            y: e.data.targetY,
            paused: false,
            yoyo: false,
            repeat: 0
        });
    
        // Test goal collisions
        if (goal.active) {

            // Enemy grabbed the goal, so despawn it
            if (e.x == goal.x && e.y == goal.y) {

                // Deactivate the goal
                goal.active = false;
                goal.visible = false;

                // Set timer to respawn goal
                startGoalTimer();
            }

            // Check to see if the player grabbed the goal
            if(Phaser.Geom.Rectangle.Overlaps(goal.getBounds(), player.getBounds())) {
                goal.active = false;
                goal.visible = false;

                // Don't respawn the goal!

                // Tell the player to exit the maze with their loot
            }

        }
    });
}

function setScore(score) {
    scoreText.setText('VIRAL\nLOAD:\n' + right('     ' + parseInt(score) + '%', 5));
    scoreText.visible = true;

    viralLoadBar.width = (32 * 5) * (score * 0.01);
    if (score > 90) {
        viralLoadBar.setFillStyle(0xff0000, 1);
    }
}

function create () {
    // Store the scene to a variable to make it easier to access later
    scene = this;

    // Load in the maze tilemap
    var map = this.make.tilemap({ key: 'maze', tileWidth: 32, tileHeight: 32 });
    var tileset = map.addTilesetImage('maze', null, 32, 32);
    layer = map.createLayer(0, tileset, 0, 0);

    // Make all of the tiles collidable except 11 which is our background (stupidly ... lol)
    layer.setCollisionBetween(0, 10);

    // Add the player sprite and make it react to arcade physics
    player = this.physics.add.sprite(48, 48, 'player');

    // Setup collider between player and the maze
    this.physics.add.collider(player, layer);

    // Add the goal sprite, set it up, and deactivate it until it's needed
    goal = this.physics.add.sprite(0, 0, 'goal');
    goal.active = false;
    goal.visible = false;

    viralLoadBar = this.add.rectangle(375, 495, 0, 37, 0x00ff00);

    scoreText = this.add.bitmapText(375, 417, '8bit', '', 32).setOrigin(0).setLeftAlign();
    setScore(0);

    var enemyColors = [
        0x7FDBFF,
        0x39CCCC,
        0x2ECC40,
        0x01FF70,
        0xFFDC00,
        0xFF851B,
        0xFF4136,
        0xF012BE,
        0xB10DC9 ];

    // Spawn enemies all over the map
    for (var i = 0; i < NUM_ENEMIES; i++) {
        var xy = findValidRandomXY();
        var enemy = this.add.sprite(xy[0] * 32 + 16, xy[1] * 32 + 16, 'enemy');
        console.log(enemyColors[i % enemyColors.length]);
        enemy.tint = enemyColors[i % enemyColors.length]; // rnd(0x666666, 0xffffff); // Math.random() * 0xffffff;
        enemy.data = [];
        enemy.data.direction = rnd(0, 3);
        enemies.push(enemy);
    }
    updateEnemiesEvent = this.time.addEvent({ delay: GHOST_UPDATE_FREQUENCY, callback: updateEnemies, callbackScope: this, loop: true });

    startGoalTimer();

    // Setup the player control keys
    keys['KEY_W'] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W); 
    keys['KEY_A'] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A); 
    keys['KEY_S'] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S); 
    keys['KEY_D'] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    cursors = this.input.keyboard.createCursorKeys();

    // Setup the swipe controls
    this.swipeInput = this.rexGestures.add.swipe({ velocityThreshold: 1000 });
}

function findValidRandomXY() {
    while (true) {
        var x = rnd(0, 28);
        var y = rnd(0, 32);
        var tile = layer.getTileAtWorldXY(x * 32, y * 32, true);
        if (tile != null && tile.index == 11) {
            return [x,y];
        }
    }
}

function spawnGoal() {
    // This algorithm is dumb as hell. It randomly chooses coordinates and keeps
    // looping until it finds a valid position
    xy = findValidRandomXY();
    goal.x = xy[0] * 32 + 16;
    goal.y = xy[1] * 32 + 16;
    goal.active = true;
    goal.visible = true;
}

function startGoalTimer() {
    spawnGoalEvent = scene.time.addEvent({ delay: rnd(1000, 2000), callback: spawnGoal, callbackScope: scene, loop: false});
}

// Returns an integer random number within our min/max range
function rnd(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

// Returns right-most characters in a string
function right(str, chr) {
    return str.substr(str.length - chr, str.length);
}
// Returns left-most characters in a string
function left(str, chr) {
    return str.substr(0, chr);
}
