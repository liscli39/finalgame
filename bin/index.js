const express = require('express');
const app = express();
const http = require('http');
const socketio = require("socket.io");

const httpserver = http.createServer(app);
const io = new socketio.Server(httpserver);

function Server() {
  this.io = null;
  this.db = null;
  this.sockets = {};
}

Server.prototype.start = function (instance_id) {
  const server = this;

  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });

  io.on("connection", function (socket) {
    server.onConnected(socket);
  });

  httpserver.listen(3000, () => {
    console.log('listening on *:3000');
  });
}

Server.prototype.onConnected = function (socket) {
  const server = this;
  console.log("New connection from " + socket.conn.remoteAddress);

  socket.on("rpc", function (req) {
    if (typeof req !== "object" || typeof req.f !== "string") {
      socket.emit("rpc_ret", {
        seq: req.seq,
        err: 400,
        ret: "invalid rpc req",
      });
      return;
    }

    var func_name = "on_" + req.f;
    var method = server[func_name];
    if (typeof method === "function") {
      method.call(server, socket, req, function (err, ret) {
        socket.emit("rpc_ret", {
          seq: req.seq,
          err: err,
          ret: ret,
        });
      });
    }
  });

  socket.on("disconnect", function () {
    server.onDisconnected(socket);
  });

  server.sockets[socket.id] = socket;
  server.sockets_count++;
};

Server.prototype.onDisconnected = function (socket) {
  var server = this;
  console.log("Disconnect from " + socket.conn.remoteAddress);

  delete server.sockets[socket.id];
  server.sockets_count--;
};

Server.prototype.on_login = function (socket, req, func) {
  const db = this.db;

  func(0, 'ok')
}

Server.prototype.on_questions = function (socket, req, func) {}
Server.prototype.on_start_game = function (socket, req, func) {}
Server.prototype.on_ringbell = function (socket, req, func) {}
Server.prototype.on_answer = function (socket, req, func) {}

Server.prototype.on_kquestions = function (socket, req, func) {}
Server.prototype.on_start_kgame = function (socket, req, func) {}

new Server().start()