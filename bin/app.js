const createError = require('http-errors');
const express = require('express');
const session = require("express-session");
const path = require('path');
const socketio = require("socket.io");
const http = require("http");
const redis = require("redis");
const morgan = require("morgan");
const ioredis = require("socket.io-redis");
const cors = require("cors");
const RedisStore = require("connect-redis")(session);

function Server() {
  this.io = null;
  this.db = null;

}

// Server.prototype.start = function () {
//   const app = express();
//   app.use("/", express.static(path.join(__dirname, "../www")));
//   // view engine setup
//   app.use(logger('dev'));
//   app.use(express.json());
//   app.use(express.urlencoded({ extended: false }));
//   app.use(cookieParser());

  
//   // catch 404 and forward to error handler
//   app.use(function(req, res, next) {
//     next(createError(404));
//   });
  
//   // error handler
//   app.use(function(err, req, res, next) {
//     // set locals, only providing error in development
//     res.locals.message = err.message;
//     res.locals.error = req.app.get('env') === 'development' ? err : {};
  
//     // render the error page
//     res.status(err.status || 500);
//     res.render('error');
//   });
  
//   app.set('port', 3000);
//   app.set('views', path.join(__dirname, 'views'));
//   app.set('view engine', 'jade');
//   // --------------------------
//   const httpserver = http.createServer(app);
//   const io = (this.io = socketio(httpserver, {
//     cors: {
//       origin: "*",
//     },
//   }));
  
//   io.adapter(
//     ioredis({
//       host: "127.0.0.1",
//       port: "63790",
//       no_ready_check: true,
//       auth_pass: "A2Dp/B0+b8BGpidH8I2FmBnSqAvFZeFNiDQezT6zQISEsK5V3wWQhDTtDM2mRKNacnA1KH8pWp9K4/Kg",
//     })
//   );
  
//   io.on("connection", function (socket) {
//     server.onConnected(socket, db, io);
//   });
  
//   httpserver.listen(3000, function () {
//     console.log("listening on " + "127.0.0.1" + ":" + 3000);
//   });
  
//   httpserver.on('error', onError);
//   function onError(error) {
//     if (error.syscall !== 'listen') {
//       throw error;
//     }
  
//     var bind = typeof port === 'string'
//       ? 'Pipe ' + 3000
//       : 'Port ' + 3000;
  
//     // handle specific listen errors with friendly messages
//     switch (error.code) {
//       case 'EACCES':
//         console.error(bind + ' requires elevated privileges');
//         process.exit(1);
//         break;
//       case 'EADDRINUSE':
//         console.error(bind + ' is already in use');
//         process.exit(1);
//         break;
//       default:
//         throw error;
//     }
//   }

//   // ---------------------------
//   const db = (this.db = redis.createClient({
//     host: "127.0.0.1",
//     port: "63790",
//     no_ready_check: true,
//     auth_pass: "A2Dp/B0+b8BGpidH8I2FmBnSqAvFZeFNiDQezT6zQISEsK5V3wWQhDTtDM2mRKNacnA1KH8pWp9K4/Kg",
//   }));

//   db.on("error", function (err) {
//     console.log("redis error: " + err);
//   });

//   app.use(
//     session({
//       store: new RedisStore({ client: db }),
//       secret: "GzBfAtLw6B",
//       resave: true,
//       saveUninitialized: false,
//       cookie: {
//         domain: "pokerstargame.net",
//       },
//     })
//   );
//   app.use(
//     cors({
//       credentials: true,
//       preflightContinue: true,
//       methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//       origin: true,
//     })
//   );
// }

Server.prototype.start = function () {
  var server = this;

  var db = (this.db = redis.createClient({
    host: '127.0.0.1',
    port: 6379,
    no_ready_check: true,
    auth_pass: 'A2Dp/B0+b8BGpidH8I2FmBnSqAvFZeFNiDQezT6zQISEsK5V3wWQhDTtDM2mRKNacnA1KH8pWp9K4/Kg',
    legacyMode: true
  }));

  db.on("error", function (err) {
    console.log("redis error: " + err);
  });

  db.incr("server:seq", function (err, instance_id) {
    if (err || !instance_id) instance_id = 0;
    server.startInstance(instance_id);
  });
  return this;
};


Server.prototype.startInstance = function (instance_id) {
  this.id = instance_id;

  var server = this;
  var db = this.db;

  var app = express();
  app.use("/", express.static(path.join(__dirname, "../www")));

  // Set middlewares
  app.use(express.json());
  app.use(morgan("dev"));
  app.use(
    session({
      store: new RedisStore({ client: db }),
      secret: "GzBfAtLw6B",
      resave: true,
      saveUninitialized: false,
      cookie: {
        domain: "pokerstargame.net",
      },
    })
  );
  // Cors
  app.use(
    cors({
      credentials: true,
      preflightContinue: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      origin: true,
    })
  );

  app.set("view engine", "ejs");
  app.set("views", "./views");

  var httpserver = http.createServer(app);
  var io = (this.io = new socketio.Server(httpserver, {
    cors: {
      origin: "*",
    },
  }));

  io.adapter(
    ioredis({
      host: "127.0.0.1",
      port: "6379",
      no_ready_check: true,
      auth_pass: "A2Dp/B0+b8BGpidH8I2FmBnSqAvFZeFNiDQezT6zQISEsK5V3wWQhDTtDM2mRKNacnA1KH8pWp9K4/Kg",
    })
  );

  io.on("connection", function (socket) {
    server.onConnected(socket, db, io);
  });

  httpserver.listen(3000, function () {
    console.log("listening on " + '127.0.0.1' + ":" + 3000);
  });
};

Server.prototype.onMessage = function (message) {
  console.log("server onMessage:", message);
};

Server.prototype.onConnected = function (socket, db, io) {
  var server = this;
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
