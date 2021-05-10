var Game2020 = new Phaser.Class({

    Extends: Phaser.Scene,

    initialize: function Game2020()
    {
        Phaser.Scene.call(this, {key: 'game2020'});

        this.scene;
        this.player = null;
        this.swipeDir = [false, false, false, false]; // Stores boolean values in cardinals
        this.enemies = [];
        this.goal = null;
        this.viralLoad = 0;
        this.viralLoadBar;
        this.layer;
        this.timer = 0;
        this.scoreText;
        
        this.cursors;
        this.keys = [];
        
        this.NUM_ENEMIES = 13;
        
        this.PLAYER_VELOCITY = 160;
        
        this.GHOST_UPDATE_FREQUENCY = 200;
        
        this.D_UP = 0, D_RIGHT = 1, D_DOWN = 2, D_LEFT = 3;

        // The directions are 0(up), 1(right), 2(down), 3(left)
        this.directionDeltas = {
              0: [ 0, -32]
            , 1: [ 32,  0]
            , 2: [ 0,  32]
            , 3: [-32,  0]
        }

        this.shader = null;
        
    },

    preload: function()
    {
        this.load.spritesheet('enemies', 'img/enemies.png', { frameWidth: 16, frameHeight: 16 });
        this.load.spritesheet('player', 'img/player.png', { frameWidth: 16, frameHeight: 16 });

        this.load.image('maze', 'maze.png');
        this.load.tilemapCSV('maze', 'maze.csv');

        this.load.image('goal', 'goal.png');
        this.load.image('logo', 'img/logo.png');
        this.load.image('scanlines', 'img/scanlines.png');

        this.load.bitmapFont('8bit', 'fonts/8bit.png', 'fonts/8bit.xml');

        this.load.scenePlugin({
            key: 'rexgesturesplugin',
            url: 'rexgesturesplugin.min.js',
            sceneKey: 'rexGestures'
        });

    },

    create: function () {

        // Store the scene to a variable to make it easier to access later
        this.scene = this;

        // Load in the maze tilemap
        var map = this.make.tilemap({ key: 'maze', tileWidth: 32, tileHeight: 32 });
        var tileset = map.addTilesetImage('maze', null, 32, 32);
        layer = map.createLayer(0, tileset, 0, 0);

        // Make all of the tiles collidable except 11 which is our background (stupidly ... lol)
        layer.setCollisionBetween(0, 10);

        // Add the player sprite and make it react to arcade physics
        this.player = this.physics.add.sprite(48, 48, 'player', 0);
        this.player.body.setSize(8, 8, 16, 16);
        this.player.setScale(4);

        // Setup collider between player and the maze
        this.physics.add.collider(this.player, layer);

        // Add the goal sprite, set it up, and deactivate it until it's needed
        this.goal = this.physics.add.sprite(0, 0, 'goal');
        this.goal.active = false;
        this.goal.visible = false;

        viralLoadBar = this.add.rectangle(375, 497, 0, 30, 0x00ff00);

        this.scoreText = this.add.bitmapText(375, 417, '8bit', '', 32).setOrigin(0).setLeftAlign();
        this.setScore(0);

        // Spawn enemies all over the map
        for (var i = 0; i < this.NUM_ENEMIES; i++) {
            var xy = this.findValidRandomXY();
            var enemyTileIdx = (i % 10) * 4;
            var enemy = this.add.sprite(xy[0] * 32 + 16, xy[1] * 32 + 16, 'enemies', enemyTileIdx).setScale(4);
            enemy.data = [];
            enemy.data.tileIdx = enemyTileIdx;
            enemy.data.direction = this.rnd(0, 3);
            this.enemies.push(enemy);
        }
        updateEnemiesEvent = this.time.addEvent({ delay: this.GHOST_UPDATE_FREQUENCY, callback: this.updateEnemies, callbackScope: this, loop: true });

        this.startGoalTimer();

        // Setup the player control keys
        this.keys['KEY_W'] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W); 
        this.keys['KEY_A'] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A); 
        this.keys['KEY_S'] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S); 
        this.keys['KEY_D'] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        this.cursors = this.input.keyboard.createCursorKeys();

        // Setup the swipe controls
        this.swipeInput = this.rexGestures.add.swipe({ velocityThreshold: 1000 });

        // Setup scanlines in the middle of the screen
        this.scanlines = this.add.tileSprite(0, 0, 896, 1024, 'scanlines').setOrigin(0,0);
    },

    // Returns an integer random number within our min/max range
    rnd: function(min, max) { return Math.round(Math.random() * (max - min) + min); },

    // Returns right-most characters in a string
    right: function(str, chr) { return str.substr(str.length - chr, str.length); },
    
    // Returns left-most characters in a string
    left: function(str, chr) { return str.substr(0, chr); },
    
    setScore: function(score) {
        this.scoreText.setText('VIRAL\nLOAD:\n' + this.right('     ' + parseInt(score) + '%', 5));
        this.scoreText.visible = true;

        viralLoadBar.width = (32 * 5) * (score * 0.01);
        if (score > 90) {
            viralLoadBar.setFillStyle(0xff0000, 1);
        }
    },

    update: function ()
    {
        // Setup swipe to work like a virtual joystick that remembers the
        // last swipe until a new one is issued. Unlike the keyboard controls,
        // up+down and left+right are not possible, so one turns off the other.
        if (this.swipeInput.isSwiped) {

            // Reset the joystick
            this.swipeDir[this.D_UP] = this.swipeDir[this.D_RIGHT] = this.swipeDir[this.D_DOWN] = this.swipeDir[this.D_LEFT] = false;

            // Point the joystick in the new direction
            if (this.swipeInput['up']) {
                this.swipeDir[this.D_UP] = true;
            }
            if (this.swipeInput['right']) {
                this.swipeDir[this.D_RIGHT] = true;
            }
            if (this.swipeInput['down']) {
                this.swipeDir[this.D_DOWN] = true;
            }
            if (this.swipeInput['left']) {
                this.swipeDir[this.D_LEFT] = true;
            }
        } 

        // Handle the input to control the player
        if (this.keys['KEY_W'].isDown || this.cursors.up.isDown || this.swipeDir[this.D_UP]) {
            this.player.body.setVelocityY(-this.PLAYER_VELOCITY);
            this.player.setFrame(0);
        }
        if (this.keys['KEY_D'].isDown || this.cursors.right.isDown || this.swipeDir[this.D_RIGHT]) {
            this.player.body.setVelocityX(this.PLAYER_VELOCITY);
            this.player.setFrame(1);
        }
        if (this.keys['KEY_S'].isDown || this.cursors.down.isDown || this.swipeDir[this.D_DOWN]) {
            this.player.body.setVelocityY(this.PLAYER_VELOCITY);
            this.player.setFrame(2);
        }
        if (this.keys['KEY_A'].isDown || this.cursors.left.isDown || this.swipeDir[this.D_LEFT]) {
            this.player.body.setVelocityX(-this.PLAYER_VELOCITY);
            this.player.setFrame(3);
        }

        // This in the inner loop becomes the enemy being referenced
        var scene = this;

        // Sense if player is colliding with ghost
        this.enemies.forEach(function(e) {

            // If there's overlap, increase the player's viral load
            if(Phaser.Geom.Rectangle.Overlaps(e.getBounds(), scene.player.getBounds())) {
                scene.viralLoad += 0.25;
                scene.setScore(scene.viralLoad);
            }
        });
    },


    updateEnemies: function () {

        // Within the enemies.forEach loop, 'this' refers to the current enemy, not the scene
        var scene = this;

        this.enemies.forEach(function(e) {

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
            if (scene.goal.active) {
                if (possibleDirections.length > 1 && scene.goal.x > e.x && possibleDirections.includes(3)) {
                    possibleDirections = possibleDirections.filter(item => item !== 3);
                }
                if (possibleDirections.length > 1 && scene.goal.x < e.x && possibleDirections.includes(1)) {
                    possibleDirections = possibleDirections.filter(item => item !== 1);
                }
                if (possibleDirections.length > 1 && scene.goal.y < e.y && possibleDirections.includes(2)) {
                    possibleDirections = possibleDirections.filter(item => item !== 2);
                }
                if (possibleDirections.length > 1 && scene.goal.y > e.y && possibleDirections.includes(0)) {
                    possibleDirections = possibleDirections.filter(item => item !== 0);
                }
            }

            // Randomly choose a new direction out of the possibilties
            var r = scene.rnd(0, possibleDirections.length - 1);
            e.data.direction = possibleDirections[r];

            e.data.targetX = e.x + scene.directionDeltas[e.data.direction][0];
            e.data.targetY = e.y + scene.directionDeltas[e.data.direction][1];

            // Update the enemy's sprite to point in the correct direction
            e.setFrame(e.data.tileIdx + e.data.direction);
            
            e.data.tween = scene.tweens.add({
                duration: scene.GHOST_UPDATE_FREQUENCY - 1,
                targets: e,
                x: e.data.targetX,
                y: e.data.targetY,
                paused: false,
                yoyo: false,
                repeat: 0
            });
        
            // Test goal collisions
            if (scene.goal.active) {

                // Enemy grabbed the goal, so despawn it
                if (e.x == scene.goal.x && e.y == scene.goal.y) {

                    // Deactivate the goal
                    scene.goal.active = false;
                    scene.goal.visible = false;

                    // Set timer to respawn goal
                    scene.startGoalTimer();
                }
            }
        });

        if (this.goal != null && this.goal.active) {

            // Check to see if the player grabbed the goal
            if (Phaser.Geom.Rectangle.Overlaps(this.goal.getBounds(), this.player.getBounds())) {

                this.goal.active = false
                this.goal.visible = false;

                // Don't respawn the goal!

                // Tell the player to exit the maze with their loot
            }
        }
    },

    findValidRandomXY: function() {
        while (true) {
            var x = this.rnd(0, 28);
            var y = this.rnd(0, 32);
            var tile = layer.getTileAtWorldXY(x * 32, y * 32, true);
            if (tile != null && tile.index == 11) {
                return [x,y];
            }
        }
    },

    spawnGoal: function() {
        // This algorithm is dumb as hell. It randomly chooses coordinates and keeps
        // looping until it finds a valid position
        xy = this.findValidRandomXY();
        this.goal.x = xy[0] * 32 + 16;
        this.goal.y = xy[1] * 32 + 16;
        this.goal.active = true;
        this.goal.visible = true;
    },

    startGoalTimer: function() {
        spawnGoalEvent = this.time.addEvent({ delay: this.rnd(1000, 2000), callback: this.spawnGoal, callbackScope: this, loop: false});
    },

});

var config = {
    type: Phaser.AUTO,
    width: 896,
    height: 1024,
    parent: 'phaser-game',
    scene: [ Game2020 ],
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },    
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    pixelArt: false,
    backgroundColor: '#000000',
};

var game = new Phaser.Game(config);