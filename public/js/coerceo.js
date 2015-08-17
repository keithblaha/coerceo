(function() {
  var ioConnection = io.connect();

  var gameViewGet = $.get('/static/views/board.html', function(templateHtml) {
    window.GameView = Backbone.View.extend({
      id: 'board-container',

      initialize: function() {
        this.render();
        $('#'+this.id).find('.piece').click($.proxy(this.clickPiece, this));
        return this;
      },

      clickPiece: function(event) {
        event.preventDefault();
        var piece = d3.select(event.delegateTarget);
        var pieceId = parseInt(piece.attr('data-id'));

        if(piece.classed('nukable')) {
          ioConnection.emit('move', {nuke: pieceId});
          return;
        }
        if(!this.model.isTurn(pieceId) || pieceId % 2 !== this.model.get('player')) return;

        if(_.isUndefined(this.selectedPiece)) {
          this.selectedPiece = piece;
          this.selectedPiece.classed('selected', true);
          var validMoves = this.model.validMoves(pieceId, true);
          _.forEach(validMoves, function(id) {
            d3.select($('.piece[data-id=' + id + ']')[0]).classed('valid', true);
          });
        }
        else if(this.selectedPiece.attr('data-id') == pieceId) {
          this.selectedPiece.classed('selected', false);
          d3.selectAll('.valid').classed('valid', false);
          delete this.selectedPiece;
        }
        else {
          if(_.isUndefined(this.moving) && piece.classed('valid')) {
            this.moving = true;
            ioConnection.emit('move', {from: this.selectedPiece.attr('data-id'), to: pieceId});
          }
        }
      },

      finishMoving: function(move) {
        d3.selectAll('.valid').classed('valid', false);
        d3.selectAll('.nukable').classed('nukable', false);
        d3.select($('.piece[data-id=' + move.from + ']')[0]).classed('selected', false);
        d3.select($('.piece[data-id=' + move.from + ']')[0]).classed('occupied', false);
        d3.select($('.piece[data-id=' + move.to + ']')[0]).classed('occupied', true);

        if(!_.isEmpty(move.remove.tiles)) {
          _.forEach(move.remove.tiles, function(id) {
            d3.select($('#tile-' + id)[0]).classed('removed', true);
          });
        }

        if(!_.isEmpty(move.remove.pieces)) {
          _.forEach(move.remove.pieces, function(id) {
            d3.select($('.piece[data-id=' + id + ']')[0]).classed('occupied', false);
          });
        }

        delete this.moving;
        delete this.nuking;
        delete this.selectedPiece;
      },

      toggleValidNukes: function(player, turnOn) {
        var otherPlayer = player === 0 ? 'black' : 'white';
        d3.selectAll($('.piece.occupied.' + otherPlayer)).classed('nukable', turnOn);
      },

      render: function() {
        this.template = _.template(templateHtml);
        this.el = this.template(this.model.attributes);
        $('body').append(this.el);
        d3.selectAll('.white').moveToFront();
        d3.selectAll('.black').moveToFront();
        return this;
      }
    });
  });

  var statsViewGet = $.get('/static/views/stats.html', function(templateHtml) {
    window.StatsView = Backbone.View.extend({
      id: 'stats-container',

      events: {
        'click .nuke': function(e) {
          if(_.isUndefined(this.gameView.nuking)) {
            this.gameView.nuking = true;
            this.gameView.toggleValidNukes(this.model.get('player'), true);
          }
          else {
            this.gameView.toggleValidNukes(this.model.get('player'), false);
            delete this.gameView.nuking;
          }
        }
      },

      initialize: function() {
        this.template = _.template(templateHtml);
        if(this.model.get('player') === 0) {
          this.$el.addClass('white');
        }
        else if(this.model.get('player') === 1) {
          this.$el.addClass('black');
        }
        $('body').append(this.el);
        this.render();
        return this;
      },

      render: function() {
        this.$el.html(this.template(this.model.attributes));
        return this;
      }
    });
  });

  var room = location.search.substr(location.search.indexOf('room=')+5, 36+5);

  var game;
  var gameView;
  var statsView;

  $.when(gameViewGet, statsViewGet).done(function() {
    eventHandlers = {
      'start': function(d) {
        game = new Game(d);
        gameView = new GameView({
          model: game
        });
        statsView = new StatsView({
          model: game
        });
        statsView.gameView = gameView;
      },
      'update': function(d) {
        game.updateWithMove(d.move);
        gameView.finishMoving(d.move);
        game.set('players', d.players);
        statsView.render();
      }
    };

    _.forEach(eventHandlers, function(eventHandler, event) {
      ioConnection.on(event, function(d) {
        eventHandlers[event](d);
      });
    });

    ioConnection.emit('ready', {room: room});
  });
})();

