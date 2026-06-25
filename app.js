//server init !!
const { Console } = require('console');
var express = require('express');
var app = express();
var serv = require('http').Server(app);
 
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));
 
serv.listen(process.env.PORT || 2000);
console.log("Server started.");

// muzu to strcit do game ?
var SOCKET_LIST = {};
function sendPacket (functionName, packet){
	for(var i in SOCKET_LIST){
      SOCKET_LIST[i].emit(functionName, packet);
	}
}






// jede to zhruba i na 250 fps
const fps = 60.0;
const playerWidth = 30;
const playerHeight = 30;
const arenaWidth = 800;
const arenaHeight = 800;
const playerSpeed = 250.0 / fps;
const bulletSpeed = 750.0 / fps;
const bulletSpeedDiagonal = Math.pow(bulletSpeed, 2) / Math.sqrt(bulletSpeed*bulletSpeed + bulletSpeed*bulletSpeed); // pistol diagonal


const points = {

  "flagSpawns" : [[180,339],[402,357],[519,284],[469,551],[167,559],[23,759],[634,696],[693,529],[455,353],[298,355],[273,278]]
  ,"spawnPoints" : [[17,68],[103,197],[374,352],[590,278],[626,44],[189,563],[14,776],[767,772],[635,682],[653,529],[616,390],[765,117],[772,33],[25,196],[32,523],[20,761],[318,557],[210,316],[523,276],[424,30],[649,555],[253,554],[218,772],[623,763],[737,761],[772,139],[161,343],[76,460],[28,194],[43,107],[36,30],[475,35],[595,31],[289,25],[231,330],[549,290],[716,526],[269,588],[617,766]]
  ,"hitBoxesList" : [[61,58],[133,164],[62,222],[121,398],[201,413],[426,504],[58,620],[408,726],[429,622],[490,725],[490,638],[588,699],[675,625],[739,729],[537,335],[594,458],[651,187],[743,413],[662,53],[734,87],[221,57],[578,245]]
  


}

/// toto bych asi taky pořeboval ržet v slovníku, aby to bylo prohromade
var flagSpawns = [[180,339],[402,357],[519,284],[469,551],[167,559],[23,759],[634,696],[693,529],[455,353],[298,355],[273,278]];
var spawnPoints = [[17,68],[103,197],[374,352],[590,278],[626,44],[189,563],[14,776],[767,772],[635,682],[653,529],[616,390],[765,117],[772,33],[25,196],[32,523],[20,761],[318,557],[210,316],[523,276],[424,30],[649,555],[253,554],[218,772],[623,763],[737,761],[772,139],[161,343],[76,460],[28,194],[43,107],[36,30],[475,35],[595,31],[289,25],[231,330],[549,290],[716,526],[269,588],[617,766]]
var hitBoxesList = [[61,58],[133,164],[62,222],[121,398],[201,413],[426,504],[58,620],[408,726],[429,622],[490,725],[490,638],[588,699],[675,625],[739,729],[537,335],[594,458],[651,187],[743,413],[662,53],[734,87],[221,57],[578,245]];
function generateMap(){
  for(k=0; k < hitBoxesList.length; k+=2){
    var ax = hitBoxesList[k][0];
    var ay = hitBoxesList[k][1];
    var bx = hitBoxesList[k+1][0];
    var by = hitBoxesList[k+1][1];
                      
    game.add( new component (false, true, true, 'wall', ax, ay, bx-ax, by-ay, 0) );
  }
}


setTimeout(generateMap, 1000); // protoze uz nevim
const game = new GameObjects ();


function GameObjects (){
  this.list={};  
  this.score={};
  this.remove = [];

  // udelat misto toho spawn list ?  spawnList[gameId] < 0 ? ... {gameId : 100}
  this.spawnPlayers = 0;
  this.spawnList = {};


  // prevazne ctf promenny
  this.scoreCTF={"blue": 0, "black" : 0};
  this.flagFollow='';
  this.flag='';
  this.blueBase='';
  this.blackBase='';

  this.playerCount = 0;
  this.retardedPlayers = 0;
}



GameObjects.prototype.init = function(){
  if(true /*|| mode == 'ctf'*/){
    this.flag = game.add(new component(true, true, false, 'flag', -100, -100, 30, 30, 1, layer = 1));
    this.blueBase = game.add(new component(true, false,  true, 'base', -100, -100, 50, 50, 1, "blue", layer = 1));
    this.blackBase = game.add(new component(true, false,  true, 'base', -100, -100, 50, 50, 1, "black", layer = 1));

    // meni se i pozice cile
    this.registerSpawn(this.flag, (2000 + Math.random() * 3000), "flagSpawns")
  }
}

GameObjects.prototype.generateId = function(size){
  var res = "";
  for(i=0;i<size;i++){ 
    var char = Math.floor(Math.random() * 61);
    res += String.fromCharCode(char + (char<10?48:(char<=35?55:61)));
  }
  return res;
}

GameObjects.prototype.add = function(newItem){
  var id = this.generateId(8);

  while (id in this.list) {
    id = this.generateId(8);
  }

  newItem.id = id; 
  this.list[id] = newItem;
  return id;
}

GameObjects.prototype.removeById = function(id){
  if(this.list[id].tag == 'player' && id == game.flagFollow)
    game.dropFlag();

  delete this.list[id];
}

GameObjects.prototype.registerSpawn = function(id, time, listName){
  this.list[id].alive = false;
  if(!this.spawnList.hasOwnProperty(id)){
    this.spawnList[id] = {update: time/fps, origin: listName}
  }
}

GameObjects.prototype.checkSpawn = function(mode){
  var toDelete = [];  

  for(id in this.spawnList){
    var item = this.spawnList[id];
    if(item.update-- < 0){
      this.list[id].alive = true;
      this.list[id].active = true;
      this.list[id].setSpawn(points[item.origin]);

      // nebo je taky zaregistrovat ? --- asi bych měl spíš zaregistrovat spaěn i pro základny
      if(this.list[id].tag == 'flag'){
        game.list[this.blueBase].setSpawn(points[item.origin]); // chci menit pozice ?
        game.list[this.blackBase].setSpawn(points[item.origin]);// chci menit pozice ?
      }

      toDelete.push(id);
    }
  }

  for(i = 0;i<toDelete.length;i++ ){ // id in Object.values(remove)
    delete this.spawnList[toDelete[i]];
  }
}


GameObjects.prototype.dropFlag = function(id){
  this.flagFollow = '';
  this.list[this.flag].loadAnimation('flagIdle', true);
}

//todo - všechno se čte z listu, tak musím udělat jinak
GameObjects.prototype.getPacket = function(){ 
  var output = [];
  
// musím to jendou někde nastavit... tak proč ne třeba tady.  -->> ale chtelo by to nekam logicky 
  if(game.flag != ''){
    if(game.list[game.flag].animation == ""){
      game.list[game.flag].loadAnimation('flagIdle', true);
      game.list[game.blueBase].loadAnimation('blueBase', true);
      game.list[game.blackBase].loadAnimation('blackBase', true);
    }
  }
  
  for(var i in this.list){
    var item = this.list[i];
    
    item.updatePosition(); //abych nemusel 2x procházet slovník, tak to muzu nechat tady (update + anime) 
    item.animate();
    
    if(item.send && item.active)
      output.push( item.packet() );
  }

  return output;
}


GameObjects.prototype.checkCollisions = function(){
  // this.remove = [];
  for(var i in this.list){
    var item = this.list[i]; // item bude nej�ast�ji tag == 'bulet'

    if((item.speedX != 0 || item.speedY != 0) && item.alive){ // hejbu se a ziju - ma cenu to kontrolovat
      if(item.x < -30 || item.y < -30 || item.x > arenaWidth + 10 || item.y > arenaHeight + 10){ // opustil jsem zemeplochu ! - prepadl jsem pres okraj a zemrel
        if(item.tag == 'player'){
          this.updateScore(null, item.name, null);
          this.registerSpawn(item.id, 3000, "spawnPoints");

          if(item.id == game.flagFollow){ // hrac vlezl s vlajkou
            this.dropFlag();
            this.registerSpawn(this.flag, (2000 + Math.random() * 3000), "flagSpawns");
            this.scoreCTF[(item.type == "blue"?"black":"blue")]++;
          }
        } 
        else{ // prevazne strela
          item.alive = false;
          item.active = false;
          game.remove.push(item.id);
        }
      }

      for(var j in this.list){ // nemusim kontrolovat vsechny ! muzu v poli pokracovat ! optimalizace na pozdějc
        var check = this.list[j];
        if(!item.alive || !check.alive || item.name == check.name) // pokud neco umrelo || kontoluju sebe -> nepokracuju
          continue;

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
/*** co všechno se muze potkat ?
* a - player || bullet
* b - vše -> player || bullet || wall || flag || base
*/

// zasah zdi
  if(a.tag == 'bullet' && b.tag == 'wall'){
    a.alive = false;
    a.active = false;
    game.remove.push(a.id);
    return; //// upg - tady bych mohl udelat zablest nebo neco ... 
  }
    
  // zasaht hrace
  if(a.tag == 'bullet' && b.tag == 'player' || b.tag == 'bullet' && a.tag == 'player' ){
    var bullet = (a.tag=='bullet'?a:b);
    var player = (a.tag=='player'?a:b);
    
    a.alive = false;
    bullet.alive = false;
    game.remove.push(bullet.id); 

    player.setSpeed(0,0); // kdyby mě střelili za běhu, nechci třeba jen ubrat ?
    player.index = 0; //reset animace
    this.registerSpawn(player.id, 3000, "spawnPoints");
    player.loadAnimation("death" + Math.floor(Math.random() * deathAnimations).toString() , false);
    player.finish = function(){
      var c = new component(true, true, true, 'blood', this.x-5, this.y+10, 30, 30, 0);
      var i = Math.floor(Math.random() * misc["blood"].length);
      c.img = "client/animation/" + misc["blood"][i] + ".png";
      c.fixed = true;
      game.add(c);
    };

    if(player.id == game.flagFollow) // drzim vlajku -> padne
      game.dropFlag();


    if(bullet.type == player.type) // team kill
      game.updateScore(null, player.name, bullet.name);
    else
      game.updateScore(bullet.name, player.name, null);

    game.spawnPlayers++;
    return;
  }

  // hrac muze sebrat vlajku
  if(a.tag == 'player' && b.tag == 'flag' && a.alive && b.alive) {
    game.flagFollow = a.id;
    return;
  }
  
  // hrac dosel do zakladny a ma vlajku a je to jeho zakladna 
  if(a.tag == 'player' && b.tag == 'base' && a.id == game.flagFollow && a.type == b.type){
    game.dropFlag();
    this.registerSpawn(this.flag, (2000 + Math.random() * 3000), "flagSpawns")
    game.scoreCTF[a.type]++;
    var base = game.list[(a.type == "blue"?this.blueBase:this.blackBase)];
    game.list[this.flag].setPosition(base.x, base.y);
  } 
}

GameObjects.prototype.updateScore = function(kill, death, teamkill){
  if(kill != null && this.score[kill] != undefined) 
    this.score[kill].kill++;
  
  if(death != null && this.score[death] != undefined) 
    this.score[death].death++;

  if(teamkill != null && this.score[teamkill] != undefined) 
    this.score[teamkill].kill--;
}


var names = ["Zemtek", "Debil", "Blbecek", "Imbecil", "Kreten", "Hovado", "Pakun", "Vemeno", "Vylizanec", "Curak", "Skoda slov", "Tady je blbcu.."]
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

  this.registerSpawn(player.id, 1000, "spawnPoints");

  if( !this.score.hasOwnProperty(player.name) )
    this.score[player.name] = {"kill": 0, "death" : 0}; //, "teamkill" : 0, "points" : 0};
}


GameObjects.prototype.playerUpdate = function(player){
  if(this.list[player.id] == undefined)
    return;
    
  if(!this.list[player.id].alive)
    return;
    
  this.list[player.id].setSpeed(player.speedX * playerSpeed, player.speedY * playerSpeed);
}


GameObjects.prototype.playerShoot = function(player){
  if(!game.list[player.id].alive)
    return;

  //var gunn = Math.floor(Math.random() * playerGun.length)
  var localSpeed = bulletSpeed;
  /* if(playerGun[gunn] == "shotgun") localSpeed = 5; */
  var bsx = player.aimX * localSpeed;
  var bsy = player.aimY * localSpeed;

  if(bsx == 0 && bsy == 0)
    return;

  /// shotgun shels
  var sgx = player.aimX;
  var sgy = player.aimY;

  // �hlop���ka - men�� rychlost st�ely
  if(player.aimX != 0 && player.aimY != 0){
    bsx = bulletSpeedDiagonal * player.aimX;
    bsy = bulletSpeedDiagonal * player.aimY;

    sgx = player.aimX;
    sgy = player.aimY;
  }

  // player x, y musim přepočítat podle směru, kterým střílím, ... časem
  var bullet = new component(true, true, true, 'bullet', player.x, player.y, 5, 5, 0, this.list[player.id].type, layer = 2);
  bullet.setSpeed(bsx, bsy);
  bullet.name = player.name;
  bullet.color = "black";
  bullet.sound = "client/sounds/pistol.mp3";  // todo

  game.add(bullet);
}



game.init();


var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket){
  socket.on('disconnect',function(){ 
    console.log("Disconnected ", game.list[playerId].name);
    delete SOCKET_LIST[playerId];
    game.removeById(playerId);
  });


  // 1 - pripojim se
  console.log("Connected");
  game.playerCount++;
  // 2 - zalozim hrace
  var playerId = game.add(new component(false, false, false, 'player', 0, 0, playerWidth, playerHeight, 1, undefined, 2));
  socket.id = playerId;
  SOCKET_LIST[playerId] = socket;

  // 3 - poslu to na clienta -> melo by stacit ID
  socket.emit('onConnect' , { 'id' : playerId, 'count': game.playerCount });
 
  // 4 - client zada jmeno + server potvrdí - kdyby client nic nezadat, aby se to nepostralo
  socket.on('myNameIs', function(e){ game.playerInit(playerId, e); 
    socket.emit('nameIsOk' , { 'name' : game.list[playerId].name, 'type':  game.list[playerId].type });
  });

  /// update player speed
  socket.on('updatePos', function(data){ game.playerUpdate(data.player); });

  /// tood -> game.shoot(); .. ?
  socket.on('shoot', function(data){game.playerShoot(data.player); });

  // todo - chtelo by vracet data nejak podle gamemodu ?
  socket.on('getScore', function(){ socket.emit('onGetScore' , {ctf: game.scoreCTF, score: game.score} ); });   

});




// 60 fps posila pakety na clienta -->> game update !
setInterval(function(){

    // pokud nekoho zabiju, tak se musim kouknout, jestli nahodou nedrzel vlajku, kdzytak smazat propojeni
    //toto nacpat do game.update ?
    if(game.flagFollow != ''){
      var player = game.list[game.flagFollow];
      
      if(player.speedX < 0) {
        game.list[game.flag].loadAnimation('flagRight', true);
        game.list[game.flag].x = player.x + 5;
        game.list[game.flag].y = player.y - 10;
      }
      else if(player.speedX > 0) {
        game.list[game.flag].loadAnimation('flagLeft', true);
        game.list[game.flag].x = player.x - 5;
        game.list[game.flag].y = player.y - 10;
      }
      else { // jdu nahoru
        game.list[game.flag].x = player.x;
        game.list[game.flag].y = player.y - 10;
      }
    }
    
    game.checkSpawn();
    game.checkCollisions();
    var pack = game.getPacket();

    sendPacket('newPositions', pack);
},1000/fps);






const deathAnimations = 4;
var animations = {
  "idle" : {speed : 10, list :["walk/idle"]},
  "walkUp" : {speed : 10, list :["walk/idle", "walk/ud1", "walk/idle", "walk/ud2"]},
  "walkLeft" : {speed : 10, list :["walk/idle", "walk/l1", "walk/idle2", "walk/l1"]},
  "walkRight" : {speed : 10, list :["walk/idle", "walk/r1", "walk/idle2", "walk/r1"]},
   
  "death0" : {speed : 4, list :["death/head0", "death/head1", "death/head2", "death/head3", "death/head4" ]},
  "death1" : {speed : 6, list :["death/legs1", "death/legs2", "death/legs3", "death/legs4" ]},
  "death2" : {speed : 7, list :["death/arm0","death/arm1", "death/arm2", "death/arm3", "death/arm4", "death/arm5" ]},
  "death3" : {speed : 3, list :["death/body0", "death/body1", "death/body2", "death/body3", "death/body3", "death/body4", "death/body5" ]},
 
  "flagIdle" : {speed : 70, list :["flag/right_down", "flag/left_down"]}, 
  "blueBase" : {speed : 10, list :["circle/blu_circle1", "circle/blu_circle2", "circle/blu_circle3", "circle/blu_circle4", "circle/blu_circle3", "circle/blu_circle2", ]}, 
  "blackBase" : {speed : 10, list :["circle/circle1", "circle/circle2", "circle/circle3", "circle/circle4", "circle/circle3", "circle/circle2", ]},   

  "flagLeft" : {speed : 10, list :["flag/left_1", "flag/left_2", "flag/left_3", "flag/left_4", "flag/left_3", "flag/left_1", "flag/left_3", "flag/left_4", "flag/left_2" ]}, 
  "flagRight" : {speed : 10, list :["flag/right_1", "flag/right_2", "flag/right_3", "flag/right_4", "flag/right_3", "flag/right_1", "flag/right_3", "flag/right_4", "flag/right_2" ]}, 
 


}  


var misc = {
   "blood" : ["floor/blood_floor1", "floor/blood_floor2", "floor/blood_floor3", "floor/blood_floor4", "floor/blood_floor5"]
}


function component (send, alive, active, tag, x, y, width, height, frame, type, layer){

  this.id='';
  this.layer=(layer==undefined?0:layer);; // vrstva pro vykreslovani v canvasu

  this.send=send; 
  this.alive=alive;
  this.active=active;
  this.fixed=false; // vykreslujou se jako první.. ? asi jo, uz nevim

  this.tag=tag;
  this.name="";
  this.type=(type==undefined?"":type);

  // pssition, dimension
  this.x=x;
  this.y=y;
  this.speedX=0;
  this.speedY=0;
  this.width=width;
  this.height=height;
  this.spawn=0;

// animace
  this.repeat=false;  
  this.finish=null; // vykona se po dokonceni animace ktera se neopakuje (zatim, slo by pri vsech ?)
  this.frame=(frame==undefined?0:frame);
  this.index=0;
  this.animation = "";
  this.img="";

  // todo  
  this.color=""; // pokud nemam -> pouzivam pouze pro bullet 
  this.sound = "";
}


component.prototype.animate = function(type){
  if(this.frame == 0 || !this.active)  // nemam animaci
    return;
  
  if (this.tag == 'player'){
    if(this.alive){
      this.finish = null;
      this.loadAnimation('idle', true);
    
      if(this.speedX < 0)
        this.loadAnimation('walkLeft', true);
      else if(this.speedX > 0)
        this.loadAnimation('walkRight', true);
      if(this.speedY != 0)
        this.loadAnimation('walkUp', true);    
    }
  }


  if(this.animation != '')
    this.setImage();
}


component.prototype.setImage = function(){ 
  if(!(this.animation in animations)){
    return;
  }

  var curent = Math.floor(this.index++/this.frame);

  if(animations[this.animation].list.length <= curent){
    if(this.repeat){
      this.index = 0; 
      curent = 0;
    }
    
    else{
      if(this.finish != null) {
        this.finish();
        this.finish = null;
      }
       
      return;
    }
  }

  this.img = "client/animation/" + animations[this.animation].list[curent] + ".png";
}

//musim zavolat toto
component.prototype.loadAnimation = function(name, repeat){
    this.repeat = repeat;
    this.animation = name;
    this.frame = animations[name].speed;
}

// casto se asi bude menit... 
component.prototype.packet = function(){
  if(!this.send)
    return null;

  return {
    id:this.id
    ,layer:this.layer
    ,tag: this.tag
    ,type:this.type
    ,x:this.x
    ,y:this.y
    ,width: this.width
    ,height: this.height
    ,img: this.img
    ,color: this.color
    ,audio: this.sound

    ,fixed: this.fixed
  }
}


/// tuto v podstate HOTOVO
component.prototype.updatePosition = function(){
  this.x += this.speedX;
  this.y += this.speedY;
}

component.prototype.setPosition = function(x, y){
  this.x = x;
  this.y = y;
}                                 
                   
component.prototype.setSpeed = function(x, y){
  this.speedX = x;
  this.speedY = y;
}

component.prototype.setSpawn = function(points){
  this.alive = true;
  // this.active = true;
  if(points.length == 0){
    this.x = 0;
    this.y = 0;
  }else{
    var point = spawnPoints[ Math.floor(Math.random() * spawnPoints.length)];

    this.x = (point[0]-this.width/2);
    this.y = (point[1]-this.height/2);  
  }
}


component.prototype.collision = function(item){ 

  var myleft = this.x;
  var myright = this.x + (this.width);
  var mytop = this.y;
  var mybottom = this.y + (this.height);
  var otherleft = item.x;
  var otherright = item.x + (item.width);
  var othertop = item.y;
  var otherbottom = item.y + (item.height);
  
  
  if ((mybottom < othertop) || (mytop > otherbottom) || (myright < otherleft) || (myleft > otherright)) {
    return false;
  }
  
  if(this.name == item.name) // this.tag == 'bullet' && // abych se netrefil pri vystrelu..
    return false;
    
  return true;
}


/*
/// tohlle by si zaslou�ilo optimalizaci, a� bych blil !! 
///// mus�m n�jak proj�t staticObject a zjitit, jestli se n�jak� strany nedot�kaj 
var playerR = getR(playerWidth, playerHeight)

function getR(x, y){
  return Math.sqrt(Math.pow(x)+Math.pow(y)) / 2;
}


function checkPlayerCollison(){

  var top = 1;
  var right = 1;
  var bottom = 1;
  var left = 1;
// ted do�astn� seru na kolize
 return { "top":top, "right":right,"bottom":bottom,"left":left };

 
// levej horn�
  var LTx = myGamePiece.x;
  var LTy = myGamePiece.y;
// preavej horn�  
  var RTx = myGamePiece.x + playerWidth;
  var RTy = myGamePiece.y;
// levej doln�  
  var LBx = myGamePiece.x;
  var LBy = myGamePiece.y + playerHeight;
// pravej doln�
  var RBx = myGamePiece.x + playerWidth;
  var RBy = myGamePiece.y + playerHeight;
  

  for (i = 0; i < staticObject.length; i++) { 

    var item = staticObject[i];
     
    var Ax = item.x;
    var Ay = item.y;
    
    var Bx = item.x + item.width;
    var By = item.y;
    
    var Cx = item.x;
    var Cy = item.y + item.height;
    
    var Dx = item.x + item.width;
    var Dy = item.y + item.height;

    var itemR = getR(item.width, item.height);

    // kontrola vyd�lenopst, abych nevyhodnocoval pro moc dalek� (mo�n� je v�po�et pomalej��) 
    if( ! Math.pow((Ax-item.width/2) - (LTx-playerWidth/2), 2) + Math.pow((Ay-item.height/2)-(LTy-playerHeight/2), 2) < Math.pow(playerR+itemR,2) )
      return;
      
    if(top == 1){  // proto�e sta�� vynulovat jednou
      top = compareLines(Cx, LTx, Dx, LTy, Cy, LBy);
      if(top == 1)
        top = compareLines(Cx, RTx, Dx, RTy, Cy, RBy);
    }

    if(right == 1){  // proto�e sta�� vynulovat jednou
      right = compareLines(Ay, LTy, Cy, LTx, Ax, RTx);
      if(right == 1)
        right = compareLines(Ay, LBy, Cy, LBx, Ax, RBx);
    }

    if(bottom == 1){  // proto�e sta�� vynulovat jednou
      bottom = compareLines(Ax, LBx, Bx, LTy, Ay, LBy);
      if(bottom == 1) // po��d ?
        bottom = compareLines(Ax, RBx, Bx, RTy, Ay, RBy);
    }
    
    if(left == 1){  // proto�e sta�� vynulovat jednou
      left = compareLines(LTx, Bx, RTx, By, LTy, Dy);
      if(left == 1)
        left = compareLines(LBx, Bx, RBx, By, LBy, Dy);
    }
  }
      
  return { "top":top, "right":right,"bottom":bottom,"left":left };
}

// horn� statick�ho porovn�v�m s bo�n�ma playera  || levej statick�ho porovn�v�m s horn� a doln� playera  || ,...
// porovn�m sou�adnice 4 bod�
function compareLines(A, B, C, D, E, F){
  if((A < B && B < C) && (D < E && E < F))  // || (Hy < Ay && Ay < Hy) && (Ax < Hx && Hx < Bx))
    return 0;
   
  return 1;
}

*/
