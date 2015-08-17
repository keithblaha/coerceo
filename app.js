var _ = require('underscore');
var consolidate = require('consolidate');
var express = require('express.io');
var uuid = require('uuid');

app = express().http().io();

app.engine('html', consolidate.underscore);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

app.use('/static', express.static('public'));
app.use('/static/js', express.static('src'));
app.use('/static/js', express.static('third_party'));

var Game = require(__dirname + '/src/game.js');

var createGame = function() {
  return {
    game: new Game({
      turn: 1,
      players: [{tiles: 0}, {tiles: 0}],
      tiles: _.reduce(_.range(19), function(o, i) {
        o[i] = {
          faces: {
            0: _.contains([0,1,4,13,16,17], i),
            1: _.contains([3,7,8,14,15,18], i),
            2: _.contains([6,10,11,12,13,16], i),
            3: _.contains([1,2,5,14,17,18], i),
            4: _.contains([0,3,4,10,11,15], i),
            5: _.contains([2,5,6,7,8,12], i)
          },
          isRemoved: false
        };
        return o;
      }, {}),
    }),
    connections: 0,
    getPlayer: function() {
      return this.game.get('turn') % 2 ^ 1;
    }
  };
};

var gameInfos = {};

app.io.route('ready', function(req) {
  var room = req.data.room;
  req.io.join(room);
  req.socket.room = room;
  var gameInfo = gameInfos[room];
  if(!_.isUndefined(gameInfo)) {
    req.socket.player = gameInfo.connections++;
    var game = gameInfo.game;
    req.io.emit('start', _.extend({player: req.socket.player}, game.attributes));
  }
});
app.io.route('move', function(req) {
  try {
    var move = {};
    if(!_.isUndefined(req.data.from) && !_.isUndefined(req.data.to)) {
      move.from = parseInt(req.data.from);
      move.to = parseInt(req.data.to);
    }
    else if(!_.isUndefined(req.data.nuke)) {
      move.nuke = parseInt(req.data.nuke);
    }
    else return;
  } catch(e) {return;}
  var gameInfo = gameInfos[req.socket.room];
  if(!_.isUndefined(gameInfo)) {
    var player = gameInfo.getPlayer();
    if(player !== req.socket.player) return;
    var game = gameInfo.game;
    if(game.isInvalidMove(move)) return;
    game.updateWithMove(move);
    app.io.room(req.socket.room).broadcast('update', {move: move, players: game.get('players')});
  }
});

app.get('/', function(req, res) {
  var room = req.param('room');
  if(_.isUndefined(room)) {
    room = uuid.v1();
    var game = gameInfos[room];
    if(_.isUndefined(game)) {
      game = createGame();
      gameInfos[room] = game;
    };
    res.redirect('/?room=' + room);
  }
  else {
    res.render('index');
  }
});

app.listen(3000)

