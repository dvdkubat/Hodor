//server init !!
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

var SOCKET_LIST = {};
function sendPacket(functionName, packet){
  for(var i in SOCKET_LIST){
    SOCKET_LIST[i].emit(functionName, packet);
  }
}

const fps = 60.0;
const playerWidth = 30;
const playerHeight = 30;
const arenaWidth = 800;
const arenaHeight = 800;
const playerSpeed = 250.0 / fps;
const bulletSpeed = 750.0 / fps;
const bulletSpeedDiagonal = Math.pow(bulletSpeed, 2) / Math.sqrt(bulletSpeed*bulletSpeed + bulletSpeed*bulletSpeed);

// Shotgun
const shotgunSpeed = 550.0 / fps;
const shotgunPellets = 5;
const shotgunSpread = 0.35; // radians

// Sniper
const sniperSpeed = 1800.0 / fps;

// Max blood spots to prevent memory leak / crash
const MAX_BLOOD_SPOTS = 20;

const points = {
  "flagSpawns" : [[180,339],[402,357],[519,284],[469,551],[167,559],[23,759],[634,696],[693,529],[455,353],[298,355],[273,278]],
  "spawnPoints" : [[17,68],[103,197],[374,352],[590,278],[626,44],[189,563],[14,776],[767,772],[635,682],[653,529],[616,390],[765,117],[772,33],[25,196],[32,523],[20,761],[318,557],[210,316],[523,276],[424,30],[649,555],[253,554],[218,772],[623,763],[737,761],[772,139],[161,343],[76,460],[28,194],[43,107],[36,30],[475,35],[595,31],[289,25],[231,330],[549,290],[716,526],[269,588],[617,766]],
  "hitBoxesList" : [[61,58],[133,164],[62,222],[121,398],[201,413],[426,504],[58,620],[408,726],[429,622],[490,725],[490,638],[588,699],[675,625],[739,729],[537,335],[594,458],[651,187],[743,413],[662,53],[734,87],[221,57],[578,245]]
};

var flagSpawns = points.flagSpawns;
var spawnPoints = points.spawnPoints;
var hitBoxesList = points.hitBoxesList;

function generateMap(){
  for(var k=0; k < hitBoxesList.length; k+=2){
    var ax = hitBoxesList[k][0];
    var ay = hitBoxesList[k][1];
    var bx = hitBoxesList[k+1][0];
    var by = hitBoxesList[k+1][1];
    game.add( new component(false, true, true, 'wall', ax, ay, bx-ax, by-ay, 0) );
  }
}

setTimeout(generateMap, 1000);
const game = new GameObjects();

function GameObjects(){
  this.list = {};
  this.score = {};
  this.remove = [];
  this.spawnPlayers = 0;
  this.spawnList = {};
  this.scoreCTF = {"blue": 0, "black": 0};
  this.flagFollow = '';
  this.flag = '';
  this.blueBase = '';
  this.blackBase = '';
  this.playerCount = 0;
  this.retardedPlayers = 0;

  // Blood spot tracking to prevent crash
  this.bloodSpots = [];
}

GameObjects.prototype.init = function(){
  this.flag = game.add(new component(true, true, false, 'flag', -100, -100, 30, 30, 1, undefined, 1));
  this.blueBase = game.add(new component(true, false, true, 'base', -100, -100, 50, 50, 1, "blue", 1));
  this.blackBase = game.add(new component(true, false, true, 'base', -100, -100, 50, 50, 1, "black", 1));
  this.registerSpawn(this.flag, (2000 + Math.random() * 3000), "flagSpawns");
}

GameObjects.prototype.generateId = function(size){
  var res = "";
  for(var i=0; i<size; i++){
    var char = Math.floor(Math.random() * 61);
    res += String.fromCharCode(char + (char<10?48:(char<=35?55:61)));
  }
  return res;
}

GameObjects.prototype.add = function(newItem){
  var id = this.generateId(8);
  while(id in this.list){ id = this.generateId(8); }
  newItem.id = id;
  this.list[id] = newItem;
  return id;
}

GameObjects.prototype.removeById = function(id){
  if(!this.list[id]) return;
  if(this.list[id].tag == 'player' && id == game.flagFollow)
    game.dropFlag();
  delete this.list[id];
}

GameObjects.prototype.registerSpawn = function(id, time, listName){
  this.list[id].alive = false;
  // active stays true for players so death animation can play.
  // Non-player objects (flag, bullet) set active=false themselves.
  if(this.list[id].tag != 'player'){
    this.list[id].active = false;
  }
  if(!this.spawnList.hasOwnProperty(id)){
    this.spawnList[id] = {update: time/fps, origin: listName};
  }
}

GameObjects.prototype.checkSpawn = function(){
  var toDelete = [];
  for(var id in this.spawnList){
    var item = this.spawnList[id];
    if(item.update-- < 0){
      this.list[id].alive = true;
      this.list[id].active = true;
      this.list[id].setSpawn(points[item.origin]);
      if(this.list[id].tag == 'flag'){
        game.list[this.blueBase].setSpawn(points[item.origin]);
        game.list[this.blackBase].setSpawn(points[item.origin]);
      }
      toDelete.push(id);
    }
  }
  for(var i=0; i<toDelete.length; i++){
    delete this.spawnList[toDelete[i]];
  }
}

GameObjects.prototype.dropFlag = function(){
  this.flagFollow = '';
  this.list[this.flag].loadAnimation('flagIdle', true);
}

GameObjects.prototype.getPacket = function(){
  var output = [];
  if(game.flag != ''){
    if(game.list[game.flag].animation == ""){
      game.list[game.flag].loadAnimation('flagIdle', true);
      game.list[game.blueBase].loadAnimation('blueBase', true);
      game.list[game.blackBase].loadAnimation('blackBase', true);
    }
  }
  for(var i in this.list){
    var item = this.list[i];
    item.updatePosition();
    item.animate();
    if(item.send && item.active)
      output.push(item.packet());
  }
  return output;
}

GameObjects.prototype.checkCollisions = function(){
  for(var i in this.list){
    var item = this.list[i];
    if((item.speedX != 0 || item.speedY != 0) && item.alive){
      if(item.x < -30 || item.y < -30 || item.x > arenaWidth + 10 || item.y > arenaHeight + 10){
        if(item.tag == 'player'){
          this.updateScore(null, item.name, null);
          this.registerSpawn(item.id, 3000, "spawnPoints");
          if(item.id == game.flagFollow){
            this.dropFlag();
            this.registerSpawn(this.flag, (2000 + Math.random() * 3000), "flagSpawns");
            this.scoreCTF[(item.type == "blue"?"black":"blue")]++;
          }
        } else {
          item.alive = false;
          item.active = false;
          game.remove.push(item.id);
        }
      }

      for(var j in this.list){
        var check = this.list[j];
        if(!item.alive || !check.alive || item.name == check.name) continue;
        if(item.collision(check))
          this.proccesCollision(item, check);
      }
    }
  }
  for(var i in this.remove){
    game.removeById(this.remove[i]);
  }
  this.remove = [];
}

GameObjects.prototype.proccesCollision = function(a, b){
  if(a.tag == 'bullet' && b.tag == 'wall'){
    a.alive = false;
    a.active = false;
    game.remove.push(a.id);
    return;
  }

  if((a.tag == 'bullet' && b.tag == 'player') || (b.tag == 'bullet' && a.tag == 'player')){
    var bullet = (a.tag=='bullet'?a:b);
    var player = (a.tag=='player'?a:b);

    // Sniper does not kill on same-team; shotgun pellets each count
    if(bullet.type == player.type && bullet.weaponType != 'sniper') {
      // team kill for non-sniper
    }

    bullet.alive = false;
    game.remove.push(bullet.id);

    player.setSpeed(0,0);
    player.index = 0;
    this.registerSpawn(player.id, 3000, "spawnPoints");
    player.loadAnimation("death" + Math.floor(Math.random() * deathAnimations).toString(), false);

    // finish fires when the death animation ends: spawn blood then hide corpse
    var self = this;
    player.finish = function(){
      self.addBloodSpot(this.x-5, this.y+10);
      this.active = false; // hide corpse after animation completes
    };

    if(player.id == game.flagFollow) game.dropFlag();

    if(bullet.type == player.type)
      game.updateScore(null, player.name, bullet.name);
    else
      game.updateScore(bullet.name, player.name, null);

    game.spawnPlayers++;
    return;
  }

  if(a.tag == 'player' && b.tag == 'flag' && a.alive && b.alive){
    game.flagFollow = a.id;
    return;
  }

  if(a.tag == 'player' && b.tag == 'base' && a.id == game.flagFollow && a.type == b.type){
    game.dropFlag();
    this.registerSpawn(this.flag, (2000 + Math.random() * 3000), "flagSpawns");
    game.scoreCTF[a.type]++;
    var base = game.list[(a.type == "blue"?this.blueBase:this.blackBase)];
    game.list[this.flag].setPosition(base.x, base.y);
  }
}

// --- Blood spot management: cap at MAX_BLOOD_SPOTS, remove oldest ---
GameObjects.prototype.addBloodSpot = function(x, y){
  if(this.bloodSpots.length >= MAX_BLOOD_SPOTS){
    var oldest = this.bloodSpots.shift();
    if(this.list[oldest]) this.removeById(oldest);
  }
  var c = new component(true, true, true, 'blood', x, y, 30, 30, 0);
  var i = Math.floor(Math.random() * misc["blood"].length);
  c.img = "client/animation/" + misc["blood"][i] + ".png";
  c.fixed = true;
  var id = game.add(c);
  this.bloodSpots.push(id);
}

GameObjects.prototype.updateScore = function(kill, death, teamkill){
  if(kill != null && this.score[kill] != undefined) this.score[kill].kill++;
  if(death != null && this.score[death] != undefined) this.score[death].death++;
  if(teamkill != null && this.score[teamkill] != undefined) this.score[teamkill].kill--;
}

var names = ["Zemtek","Debil","Blbecek","Imbecil","Kreten","Hovado","Pakun","Vemeno","Vylizanec","Curak","Skoda slov","Tady je blbcu.."]
GameObjects.prototype.playerInit = function(id, data){
  var player = this.list[id];
  player.send = true;
  player.type = data.team;

  if(data.name == ''){
    if(names.length <= this.retardedPlayers)
      data.name = "Retard " + (this.retardedPlayers - names.length + 1);
    else
      data.name = names[this.retardedPlayers];
    this.retardedPlayers++;
  }
  player.name = data.name;
  player.weapon = data.weapon || 'pistol'; // default weapon
  this.registerSpawn(player.id, 1000, "spawnPoints");

  if(!this.score.hasOwnProperty(player.name))
    this.score[player.name] = {"kill": 0, "death": 0};
}

GameObjects.prototype.playerUpdate = function(player){
  if(this.list[player.id] == undefined) return;
  if(!this.list[player.id].alive) return;
  this.list[player.id].setSpeed(player.speedX * playerSpeed, player.speedY * playerSpeed);

  // Allow weapon switch from client
  if(player.weapon && ['pistol','shotgun','sniper'].includes(player.weapon)){
    this.list[player.id].weapon = player.weapon;
  }
}

GameObjects.prototype.playerShoot = function(player){
  if(!game.list[player.id] || !game.list[player.id].alive) return;

  var weapon = player.weapon || game.list[player.id].weapon || 'pistol';

  if(weapon == 'shotgun'){
    this._shootShotgun(player);
  } else if(weapon == 'sniper'){
    this._shootSniper(player);
  } else {
    this._shootPistol(player);
  }
}

GameObjects.prototype._shootPistol = function(player){
  var bsx = player.aimX * bulletSpeed;
  var bsy = player.aimY * bulletSpeed;
  if(bsx == 0 && bsy == 0) return;

  if(player.aimX != 0 && player.aimY != 0){
    bsx = bulletSpeedDiagonal * player.aimX;
    bsy = bulletSpeedDiagonal * player.aimY;
  }

  var bullet = new component(true, true, true, 'bullet', player.x + 12, player.y + 12, 5, 5, 0, this.list[player.id].type, 2);
  bullet.setSpeed(bsx, bsy);
  bullet.name = player.name;
  bullet.color = "black";
  bullet.sound = "client/sounds/pistol.mp3";
  bullet.weaponType = 'pistol';
  // Store trail info for client
  bullet.trail = true;
  game.add(bullet);
}

GameObjects.prototype._shootShotgun = function(player){
  if(player.aimX == 0 && player.aimY == 0) return;

  var baseAngle = Math.atan2(player.aimY, player.aimX);
  var speed = shotgunSpeed;

  for(var p = 0; p < shotgunPellets; p++){
    var spread = (p - Math.floor(shotgunPellets/2)) * (shotgunSpread / (shotgunPellets-1));
    var angle = baseAngle + spread;
    var bsx = Math.cos(angle) * speed;
    var bsy = Math.sin(angle) * speed;

    var bullet = new component(true, true, true, 'bullet', player.x + 12, player.y + 12, 5, 5, 0, this.list[player.id].type, 2);
    bullet.setSpeed(bsx, bsy);
    bullet.name = player.name;
    bullet.color = "#8B0000";
    bullet.weaponType = 'shotgun';
    bullet.trail = false;
    if(p == 0) bullet.sound = "client/sounds/shotgun.mp3";
    game.add(bullet);
  }
}

GameObjects.prototype._shootSniper = function(player){
  if(player.aimX == 0 && player.aimY == 0) return;

  var bsx = player.aimX * sniperSpeed;
  var bsy = player.aimY * sniperSpeed;

  if(player.aimX != 0 && player.aimY != 0){
    var diag = Math.pow(sniperSpeed, 2) / Math.sqrt(sniperSpeed*sniperSpeed + sniperSpeed*sniperSpeed);
    bsx = diag * player.aimX;
    bsy = diag * player.aimY;
  }

  var bullet = new component(true, true, true, 'bullet', player.x + 12, player.y + 12, 8, 3, 0, this.list[player.id].type, 2);
  bullet.setSpeed(bsx, bsy);
  bullet.name = player.name;
  bullet.color = "#FFD700";
  bullet.weaponType = 'sniper';
  bullet.trail = true;
  bullet.sound = ""; // no sound for now, sniper silent
  game.add(bullet);
}

game.init();

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket){
  console.log("Connected");
  game.playerCount++;

  var playerId = game.add(new component(false, false, false, 'player', 0, 0, playerWidth, playerHeight, 1, undefined, 2));
  socket.id = playerId;
  SOCKET_LIST[playerId] = socket;

  socket.emit('onConnect', {'id': playerId, 'count': game.playerCount});

  socket.on('disconnect', function(){
    if(game.list[playerId])
      console.log("Disconnected", game.list[playerId].name);
    delete SOCKET_LIST[playerId];
    game.removeById(playerId);
  });

  socket.on('myNameIs', function(e){
    game.playerInit(playerId, e);
    socket.emit('nameIsOk', {'name': game.list[playerId].name, 'type': game.list[playerId].type});
  });

  socket.on('updatePos', function(data){ game.playerUpdate(data.player); });
  socket.on('shoot', function(data){ game.playerShoot(data.player); });
  socket.on('getScore', function(){ socket.emit('onGetScore', {ctf: game.scoreCTF, score: game.score}); });
});

// 60fps game loop
setInterval(function(){
  if(game.flagFollow != ''){
    var player = game.list[game.flagFollow];
    if(player){
      if(player.speedX < 0){
        game.list[game.flag].loadAnimation('flagRight', true);
        game.list[game.flag].x = player.x + 5;
        game.list[game.flag].y = player.y - 10;
      } else if(player.speedX > 0){
        game.list[game.flag].loadAnimation('flagLeft', true);
        game.list[game.flag].x = player.x - 5;
        game.list[game.flag].y = player.y - 10;
      } else {
        game.list[game.flag].x = player.x;
        game.list[game.flag].y = player.y - 10;
      }
    }
  }

  game.checkSpawn();
  game.checkCollisions();
  var pack = game.getPacket();
  sendPacket('newPositions', pack);
}, 1000/fps);


const deathAnimations = 4;
var animations = {
  "idle"       : {speed:10, list:["walk/idle"]},
  "walkUp"     : {speed:10, list:["walk/idle","walk/ud1","walk/idle","walk/ud2"]},
  "walkLeft"   : {speed:10, list:["walk/idle","walk/l1","walk/idle2","walk/l1"]},
  "walkRight"  : {speed:10, list:["walk/idle","walk/r1","walk/idle2","walk/r1"]},
  "death0"     : {speed:4,  list:["death/head0","death/head1","death/head2","death/head3","death/head4"]},
  "death1"     : {speed:6,  list:["death/legs1","death/legs2","death/legs3","death/legs4"]},
  "death2"     : {speed:7,  list:["death/arm0","death/arm1","death/arm2","death/arm3","death/arm4","death/arm5"]},
  "death3"     : {speed:3,  list:["death/body0","death/body1","death/body2","death/body3","death/body3","death/body4","death/body5"]},
  "flagIdle"   : {speed:70, list:["flag/right_down","flag/left_down"]},
  "blueBase"   : {speed:10, list:["circle/blu_circle1","circle/blu_circle2","circle/blu_circle3","circle/blu_circle4","circle/blu_circle3","circle/blu_circle2"]},
  "blackBase"  : {speed:10, list:["circle/circle1","circle/circle2","circle/circle3","circle/circle4","circle/circle3","circle/circle2"]},
  "flagLeft"   : {speed:10, list:["flag/left_1","flag/left_2","flag/left_3","flag/left_4","flag/left_3","flag/left_1","flag/left_3","flag/left_4","flag/left_2"]},
  "flagRight"  : {speed:10, list:["flag/right_1","flag/right_2","flag/right_3","flag/right_4","flag/right_3","flag/right_1","flag/right_3","flag/right_4","flag/right_2"]}
};

var misc = {
  "blood": ["floor/blood_floor1","floor/blood_floor2","floor/blood_floor3","floor/blood_floor4","floor/blood_floor5"]
};

function component(send, alive, active, tag, x, y, width, height, frame, type, layer){
  this.id = '';
  this.layer = (layer==undefined?0:layer);
  this.send = send;
  this.alive = alive;
  this.active = active;
  this.fixed = false;
  this.tag = tag;
  this.name = "";
  this.type = (type==undefined?"":type);
  this.weapon = 'pistol';
  this.x = x;
  this.y = y;
  this.speedX = 0;
  this.speedY = 0;
  this.width = width;
  this.height = height;
  this.spawn = 0;
  this.repeat = false;
  this.finish = null;
  this.frame = (frame==undefined?0:frame);
  this.index = 0;
  this.animation = "";
  this.img = "";
  this.color = "";
  this.sound = "";
  this.weaponType = 'pistol';
  this.trail = false;
}

component.prototype.animate = function(){
  if(this.frame == 0 || !this.active) return;
  if(this.tag == 'player'){
    if(this.alive){
      // Only set walk/idle animations when alive (not dying)
      this.finish = null;
      this.loadAnimation('idle', true);
      if(this.speedX < 0) this.loadAnimation('walkLeft', true);
      else if(this.speedX > 0) this.loadAnimation('walkRight', true);
      if(this.speedY != 0) this.loadAnimation('walkUp', true);
    }
    // When dead (alive=false), let the death animation play out via setImage().
    // The finish callback will fire when the animation ends.
  }
  if(this.animation != '') this.setImage();
}

component.prototype.setImage = function(){
  if(!(this.animation in animations)) return;
  var curent = Math.floor(this.index++/this.frame);
  if(animations[this.animation].list.length <= curent){
    if(this.repeat){
      this.index = 0;
      curent = 0;
    } else {
      if(this.finish != null){
        this.finish.call(this);
        this.finish = null;
      }
      return;
    }
  }
  this.img = "client/animation/" + animations[this.animation].list[curent] + ".png";
}

component.prototype.loadAnimation = function(name, repeat){
  this.repeat = repeat;
  this.animation = name;
  this.frame = animations[name].speed;
}

component.prototype.packet = function(){
  if(!this.send) return null;
  return {
    id: this.id,
    layer: this.layer,
    tag: this.tag,
    type: this.type,
    x: this.x,
    y: this.y,
    width: this.width,
    height: this.height,
    img: this.img,
    color: this.color,
    audio: this.sound,
    fixed: this.fixed,
    weapon: this.weapon,
    weaponType: this.weaponType,
    trail: this.trail
  };
}

component.prototype.updatePosition = function(){
  this.x += this.speedX;
  this.y += this.speedY;
  this.sound = ""; // Only send sound once
}

component.prototype.setPosition = function(x, y){ this.x = x; this.y = y; }
component.prototype.setSpeed = function(x, y){ this.speedX = x; this.speedY = y; }

component.prototype.setSpawn = function(spawnList){
  this.alive = true;
  this.active = true;
  this.animation = '';
  this.index = 0;
  this.finish = null;
  if(!spawnList || spawnList.length == 0){
    this.x = 0; this.y = 0;
  } else {
    var point = spawnList[Math.floor(Math.random() * spawnList.length)];
    this.x = (point[0] - this.width/2);
    this.y = (point[1] - this.height/2);
  }
}

component.prototype.collision = function(item){
  var myleft = this.x, myright = this.x + this.width;
  var mytop = this.y, mybottom = this.y + this.height;
  var otherleft = item.x, otherright = item.x + item.width;
  var othertop = item.y, otherbottom = item.y + item.height;

  if((mybottom < othertop)||(mytop > otherbottom)||(myright < otherleft)||(myleft > otherright))
    return false;
  if(this.name == item.name) return false;
  return true;
}
