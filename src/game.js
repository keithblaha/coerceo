var _ = _ || require('underscore');
var Backbone = Backbone || require('backbone');

var Game = Backbone.Model.extend({
  getPieceId: function(face, col, row, filter) {
    if(filter) {
      var tile = this.getTileId(col, row);
      if(tile < 0) return -1;
    }

    switch(col) {
      case 0:
        if(row > 2) return -1;
        else return row * 6 + face;
      case 1:
        if(row > 3) return -1;
        else return (3 + row) * 6 + face;
      case 2:
        if(row > 4) return -1;
        else return (7 + row) * 6 + face;
      case 3:
        if(row > 3) return -1;
        else return (12 + row) * 6 + face;
      case 4:
        if(row > 2) return -1;
        else return (16 + row) * 6 + face;
    }
  },

  getPiece: function(id) {
    var face = id % 6;

    var tile = this.getTile(Math.floor(id / 6));

    var player = id % 2;

    return {id: id, col: tile.col, row: tile.row, face: face, tile: tile.id, player: player};
  },

  getTileId: function(col, row) {
    if(col < 0 || col > 4 || row < 0) return -1;

    var id = row;
    switch(col) {
      case 0:
        if(row > 2) return -1;
        break;
      case 1:
        if(row > 3) return -1;
        id += 3;
        break;
      case 2:
        if(row > 4) return -1;
        id += 7;
        break;
      case 3:
        if(row > 3) return -1;
        id += 12;
        break;
      case 4:
        if(row > 2) return -1;
        id += 16;
        break;
    }
    if(id < 0 || id > 18 || this.get('tiles')[id].isRemoved) return -1;
    return id;
  },

  getTile: function(id) {
    var col = _.indexOf([0, 3, 7, 12, 16], (_.find([16, 12, 7, 3, 0], function(m) {
      return id >= m;
    })));
    var m = 0;
    switch(col) {
      case 4:
        m += 4
      case 3:
        m += 5
      case 2:
        m += 4
      case 1:
        m += 3
        break;
    }
    var row = id - m;
    return {id: id, col: col, row: row};
  },

  isTurn: function(pieceId) {
    return pieceId % 2 !== this.get('turn') % 2;
  },

  isInvalidMove: function(move) {
    if(!_.isUndefined(move.from)) {
      return !(move.from < 19 * 6 && move.from >= 0 &&
               move.to < 19 * 6 && move.to >= 0 &&
               this.isTurn(move.from) &&
               _.contains(this.validMoves(move.from, true), move.to));
    }
    else if(!_.isUndefined(move.nuke)) {
      return !(move.nuke < 19 * 6 && move.nuke >= 0 &&
               !this.isTurn(move.nuke) &&
               this.get('players')[move.nuke % 2 ^ 1].tiles >= 2 &&
               this.get('tiles')[Math.floor(move.nuke / 6)].faces[move.nuke % 6]);
    }
    else return false;
  },

  updateWithMove: function(move) {
    var from;
    var to;
    var nuke;

    if(!_.isUndefined(move.from)) {
      from = this.getPiece(move.from);
      to = this.getPiece(move.to);
      this.get('tiles')[from.tile].faces[from.face] = false;
      this.get('tiles')[to.tile].faces[to.face] = true;

      if(_.isUndefined(move.remove)) {
        var removeTiles = this.removeTiles(from.tile);
        this.get('players')[from.player].tiles += removeTiles.length;
        move.remove = {
          tiles: removeTiles,
          pieces: this.coercions(removeTiles, to.player, to)
        };
      }
    }
    else if(!_.isUndefined(move.nuke)) {
      nuke = this.getPiece(move.nuke);
      this.get('tiles')[nuke.tile].faces[nuke.face] = false;
      this.get('players')[nuke.player ^ 1].tiles -= 2;

      if(_.isUndefined(move.remove)) {
        var removeTiles = this.removeTiles(nuke.tile);
        move.remove = {
          tiles: removeTiles,
          pieces: this.coercions(removeTiles, nuke.player ^ 1).concat(nuke.id)
        };
      }
    }

    if(!_.isEmpty(move.remove.tiles)) {
      _.forEach(move.remove.tiles, function(id) {
        this.get('tiles')[id].isRemoved = true;
      }, this);
    }

    if(!_.isEmpty(move.remove.pieces)) {
      _.forEach(move.remove.pieces, function(id) {
        this.get('tiles')[Math.floor(id / 6)].faces[id % 6] = false;
      }, this);
    }

    this.set('turn', this.get('turn') + 1);
  },

  removeTiles: function(startTile) {
    var removeTiles = [];
    var shouldRemove = this.shouldRemoveTile(startTile);
    if(shouldRemove) {
      removeTiles.push(startTile);
      this.get('tiles')[startTile].isRemoved = true;

      var maybeRemove = this.getNeighbors(startTile, true);
      while(maybeRemove.length > 0) {
        var next = maybeRemove.pop();
        shouldRemove = this.shouldRemoveTile(next);
        if(shouldRemove) {
          removeTiles.push(next);
          this.get('tiles')[next].isRemoved = true;
          maybeRemove.concat(this.getNeighbors(next, true));
        }
      }
    }
    return removeTiles;
  },

  getNeighbors: function(id, filter) {
    var tile = this.getTile(id);
    var col = tile.col;
    var row = tile.row;
    var neighbors = [this.getTileId(col, row - 1),
                     this.getTileId(col + 1, row + (col < 2 ? 0 : -1)),
                     this.getTileId(col + 1, row + (col < 2 ? 1 : 0)),
                     this.getTileId(col, row + 1),
                     this.getTileId(col - 1, row + (col > 2 ? 1 : 0)),
                     this.getTileId(col - 1, row + (col > 2 ? 0 : -1))];

    if(filter) {
      return _.filter(neighbors, function(i) {
        return i > -1;
      });
    }
    else return neighbors;
  },

  shouldRemoveTile: function(id) {
    var isEmpty = _.reduce(this.get('tiles')[id].faces, function(a, isOccupied) {
      return a && !isOccupied;
    }, true);
    if(!isEmpty) return false;

    var neighbors = this.getNeighbors(id, false);
    var consecutives = [];
    var currentlyConsecutive;
    var count = 0;
    for(var i = 0; i < neighbors.length; i++) {
      if(neighbors[i] > -1) {
        if(currentlyConsecutive) {
          count += 1;
        }
        else {
          currentlyConsecutive = true;
          count = 1;
        }
      }
      else {
        if(currentlyConsecutive) {
          consecutives.push(count);
          count = 0;
          consecutives.push(-1);
        }
        else if(_.isUndefined(currentlyConsecutive)) {
          consecutives.push(-1);
        }
        currentlyConsecutive = false
      }
    }

    if(currentlyConsecutive) {
      consecutives.push(count);
    }
    if(consecutives.length > 1) {
      if(consecutives[0] > 0 && consecutives[consecutives.length - 1] > 0) {
        consecutives[0] += consecutives.pop();
      }
      else if(consecutives[0] === -1 && consecutives[consecutives.length - 1] === -1) {
        consecutives.pop();
      }
    }

    if(1 < _.filter(consecutives, function(i) { return i === -1; }).length) {
      return false;
    }
    else {
      return 3 >= _.find(consecutives, function(i) { return i > -1; });
    }
  },

  coercions: function(removeTiles, player, to) {
    var coerced = [];

    if(!_.isEmpty(removeTiles)) {
      var neighbors = _.uniq(_.flatten(_.map(removeTiles, function(tile) {
        return this.getNeighbors(tile, true);
      }, this)));
      var pieces = _.flatten(_.map(neighbors, function(tile) {
        var base = tile * 6 + player % 2 ^ 1;
        return _.filter([base, base + 2, base + 4], function(i) {
          return this.get('tiles')[tile].faces[i % 6];
        }, this);
      }, this));

      pieces = _.filter(pieces, function(p) {
        if(this.isTurn(p)) return false;

        var numMovesToTile = _.reduce(_.range(19), function(a, k) { a[k] = 0; return a; }, {});
        var maybeCoerced = false;
        _.forEach(this.validMoves(p, false), function(v) {
          var tile = this.getPiece(v).tile;
          if(++numMovesToTile[tile] >= 2) {
            maybeCoerced = _.contains(removeTiles, tile);
          }
        }, this);
        return maybeCoerced;
      }, this);

      _.forEach(pieces, function(p) {
        var o = this.getOpponentInfo(this.getPiece(p));
        if(o.numPossible === o.pieces.length) {
          coerced.push(p);
        }
      }, this);
    }

    if(!_.isUndefined(to)) {
      var opponents = this.getOpponentInfo(to);
      coerced = coerced.concat(_.filter(opponents.pieces, function(o) {
        var opposingOpponents = this.getOpponentInfo(this.getPiece(o));
        return opposingOpponents.numPossible === opposingOpponents.pieces.length;
      }, this));
    }

    return coerced;
  },

  getOpponentInfo: function(piece) {
    var id = piece.id;
    var col = piece.col;
    var row = piece.row;
    var face = piece.face;

    var opponents;
    switch(face) {
      case 0:
        opponents = [id+1, id+5].concat(_.filter([this.getPieceId(3, col, row -1, true),
                                                 ], function(i) { return i > -1 }));
        break;
      case 1:
        opponents = [id-1, id+1].concat(_.filter([this.getPieceId(4, col + 1, row + (col >= 2 ? -1 : 0), true),
                                                 ], function(i) { return i > -1 }));
        break;
      case 2:
        opponents = [id-1, id+1].concat(_.filter([this.getPieceId(5, col + 1, row + (col >= 2 ? 0 : 1), true),
                                                 ], function(i) { return i > -1 }));
        break;
      case 3:
        opponents = [id-1, id+1].concat(_.filter([this.getPieceId(0, col, row + 1, true),
                                                 ], function(i) { return i > -1 }));
        break;
      case 4:
        opponents = [id-1, id+1].concat(_.filter([this.getPieceId(1, col - 1, row + (col > 2 ? 1 : 0), true),
                                                 ], function(i) { return i > -1 }));
        break;
      case 5:
        opponents = [id-1, id-5].concat(_.filter([this.getPieceId(2, col - 1, row + (col > 2 ? 0 : -1), true),
                                                 ], function(i) { return i > -1 }));
        break;
    }

    var numPossible = opponents.length;
    opponents = _.filter(opponents, function(i) {
      return this.get('tiles')[Math.floor(i / 6)].faces[i % 6];
    }, this);
    return {
      pieces: opponents,
      numPossible: numPossible
    };
  },

  validMoves: function(id, filter) {
    var piece = this.getPiece(id);
    var col = piece.col;
    var row = piece.row;
    var face = piece.face;

    var validMoves;
    switch(face) {
      case 0:
        validMoves = [id+2, id+4].concat(_.filter([this.getPieceId(2, col - 1, row + (col > 2 ? 0 : -1), filter),
                                                   this.getPieceId(4, col + 1, row + (col >= 2 ? -1 : 0), filter),
                                                   this.getPieceId(2, col, row - 1, filter),
                                                   this.getPieceId(4, col, row - 1, filter)
                                                  ], function(i) { return i > -1 }));
        break;
      case 1:
        validMoves = [id+2, id+4].concat(_.filter([this.getPieceId(3, col + 1, row + (col >= 2 ? -1 : 0), filter),
                                                   this.getPieceId(5, col + 1, row + (col >= 2 ? -1 : 0), filter),
                                                   this.getPieceId(5, col + 1, row + (col >= 2 ? 0 : 1), filter),
                                                   this.getPieceId(3, col, row - 1, filter)
                                                  ], function(i) { return i > -1 }));
        break;
      case 2:
        validMoves = [id-2, id+2].concat(_.filter([this.getPieceId(0, col, row + 1, filter),
                                                   this.getPieceId(4, col + 1, row + (col >= 2 ? -1 : 0), filter),
                                                   this.getPieceId(0, col + 1, row + (col >= 2 ? 0 : 1), filter),
                                                   this.getPieceId(4, col + 1, row + (col >= 2 ? 0 : 1), filter)
                                                  ], function(i) { return i > -1 }));
        break;
      case 3:
        validMoves = [id-2, id+2].concat(_.filter([this.getPieceId(1, col - 1, row + (col > 2 ? 1 : 0), filter),
                                                   this.getPieceId(5, col + 1, row + (col >= 2 ? 0 : 1), filter),
                                                   this.getPieceId(1, col, row + 1, filter),
                                                   this.getPieceId(5, col, row + 1, filter)
                                                  ], function(i) { return i > -1 }));
        break;
      case 4:
        validMoves = [id-2, id-4].concat(_.filter([this.getPieceId(0, col, row + 1, filter),
                                                   this.getPieceId(2, col - 1, row + (col > 2 ? 1 : 0), filter),
                                                   this.getPieceId(0, col - 1, row + (col > 2 ? 1 : 0), filter),
                                                   this.getPieceId(2, col - 1, row + (col > 2 ? 0 : -1), filter),
                                                  ], function(i) { return i > -1 }));
        break;
      case 5:
        validMoves = [id-2, id-4].concat(_.filter([this.getPieceId(3, col, row - 1, filter),
                                                   this.getPieceId(1, col - 1, row + (col > 2 ? 0 : -1), filter),
                                                   this.getPieceId(3, col - 1, row + (col > 2 ? 0 : -1), filter),
                                                   this.getPieceId(1, col - 1, row + (col > 2 ? 1 : 0), filter),
                                                  ], function(i) { return i > -1 }));
        break;
    }

    if(filter) {
      return _.filter(validMoves, function(i) {
        return !this.get('tiles')[Math.floor(i / 6)].faces[i % 6] && !this.get('tiles')[Math.floor(i / 6)].isRemoved;
      }, this);
    }
    else return validMoves;
  }
});

if(typeof window === 'undefined') {
  module.exports = Game;
}

