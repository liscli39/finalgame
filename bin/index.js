const express = require('express');
const app = express();
const http = require('http');
const socketio = require("socket.io");
const { createClient } = require("redis");

const WAIT = 0
const PLAYING = 1

function Server() {
  this.io = null;
  this.db = null;
  this.sub = null;

  this.sockets = {};
  this.teams = [];
  this.questions = [{
    question_id: 1,
    question_text: "question_text",
    choices: [
      {
        choice_id: 1,
        choice_text: "choice_text",
        is_correct: true,
      }
    ]
  }];

  this.turn_countdown = 4000;
  this.game_status = WAIT;

  this.question = null;
  this.flag = null;
}

Server.prototype.start = function (instance_id) {
  const server = this;

  this.db = createClient({
    socket: {
      host: "redis",
      port: 6379,
    },
    tls: undefined,
  });
  
  this.db.on("error", console.log);
  this.db.connect().then(() => console.log('connected!'));

  const httpserver = http.createServer(app);
  this.io = new socketio.Server(httpserver);

  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });

  this.io.on("connection", function (socket) {
    server.onConnected(socket);
  });

  httpserver.listen(5000, () => {
    console.log('listening on *:5000');
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
        ret: "Invalid rpc req",
      });
      return;
    }

    if (req.args && typeof req.args !== "object") {
      socket.emit("rpc_ret", {
        seq: req.seq,
        err: 400,
        ret: "Invalid type args",
      });
      return;
    }

    var func_name = "on_" + req.f;
    var method = server[func_name];

    req.socket_id = socket.id;
    if (typeof method === "function") {
      method.call(server, req, function (err, ret) {
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

Server.prototype.notifyAll = async function (event, args) {
  const teams = this.teams;
  for (const team of teams) {
    this.sockets[team.socket_id].emit("notify", {
      team_id: team.team_id,
      e: event,
      args: args,
    })
  }
}

Server.prototype.notifyTo = async function (to, event, args) {
  const socket = this.sockets[to];
  if (socket) {
    socket.emit("notify", {
      team_id: to,
      e: event,
      args: args,
    })
  }
}

Server.prototype.on_login = async function (req, func) {
  const { team_id, team_name } = req.args;
  const db = this.db;

  const exist = this.teams.find(t => t.team_id == team_id);
  if (exist) {
    return func(400, 'Team ID logined')
  }

  this.teams.push({ team_id, team_name, socket_id: req.socket_id })
  await db.set('teams', JSON.stringify(this.teams))
  return func(0, 'ok')
}

Server.prototype.on_teams = async function (req, func) {
  const db = this.db;

  const teams = JSON.parse(await db.get('teams') || "[]");
  return func(0, teams)
}

Server.prototype.on_questions = async function (req, func) {
  const db = this.db;

  const questions = JSON.parse(await db.get('questions') || "[]");
  return func(0, questions)
}

Server.prototype.on_start_question = async function (req, func) {
  const server = this;
  const { question_id } = req.args;

  const questions = JSON.parse(await this.db.get('questions') || JSON.stringify(server.questions));
  const question = questions.find(q => q.question_id == question_id)
  if (!question) return func(400, "Question not exists");

  server.game_status = PLAYING
  server.question = question
  server.notifyAll('start_question', question)

  setTimeout(() => server.tickTurn(), 1000);

  return func(0, 'ok')
}

Server.prototype.tickTurn = function () {
  const server = this;

  if (server.game_status != PLAYING) {

  } else if (server.turn_countdown > 0) {
    server.turn_countdown--;
    server.notifyAll("countdown", {
      sec: server.turn_countdown,
    });

    setTimeout(() => server.tickTurn(), 1000);
  } if (server.turn_countdown <= 0) {
    server.game_status = WAIT;
    server.notifyAll("timeout", {});
  }
};

Server.prototype.on_ringbell = function (req, func) {
  if (this.game_status != PLAYING) return func(400, "Question not start");
  if (this.flag) return func(400, "Out turn");

  const server = this;
  server.game_status = WAIT;

  const team = this.teams.find(t => t.socket_id == req.socket_id);
  this.flag = team;

  server.notifyAll("ringbell", team);
  func(0, "ok");
}

Server.prototype.on_answer = async function (req, func) {
  if (this.game_status != PLAYING) return func(400, "Question not start");
  if (this.question != PLAYING) return func(400, "Question not start");
  const { team_id, choice_id } = req.args;

  const server = this;
  const choices = server.question.choices;
  if (!choices.find(c => c.choice_id == choice_id && c.is_correct)) {
    return func(400, "Choice incorrect!")
  }

  const team = this.teams.find(t => t.team_id == team_id)
  team.point = server.question.point || 50;

  server.notifyAll("answer", team)
  func(0, "ok");
}

Server.prototype.on_kquestions = function (req, func) { }
Server.prototype.on_start_kgame = function (req, func) { }

new Server().start()