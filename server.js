
const
    fs = require("fs"),
    http = require("http"),
    express = require("express"),
    socketio = require("socket.io");

const SERVER_PORT = 5999;

const join_q = 'user_join'

const content = fs.readFileSync('config.json')
const config = JSON.parse(content)

async function sendMessage(rabbitMQUrl, message, exchange, exchangeType, routingKey) {
    const amqp = require('amqplib')
    const conn = await amqp.connect(rabbitMQUrl)
    const channel = await conn.createChannel()
    await channel.assertExchange(exchange, exchangeType, {durable: true})
    await channel.publish(exchange, routingKey, new Buffer(message))
    await channel.close()
    await conn.close()
}

function onNewWebsocketConnection(socket) {
    //you can check cookie in socket.handshake.headers
    // https://stackoverflow.com/a/9385745/819804
    console.info(`Socket ${socket.id} has connected.`, socket.handshake.headers);

    socket.on("disconnect", () => {
        console.info(`Socket ${socket.id} has disconnected.`);
    });

    socket.on("join", room => {
        console.log('on join room', room)
        let message = JSON.stringify({room_id: room})
        let _message = Buffer.from(message)
        socket.join(room)
        const url = `amqp://${config["rabbitmq_address"]}`
        sendMessage(url, _message, 'system023', 'topic', join_q)
            .then((data) => {
                console.log(data)
            })
    })

    socket.on("leave", room => {
        console.log('on leave room', room)
        socket.leave(room)
    })
}

function startServer() {
    // create a new express app
    const app = express();
    // create http server and wrap the express app
    const server = http.createServer(app);
    // bind socket.io to that server
    const io = socketio(server);

    app.use(express.json())

    app.post("/message", (req, res) => {
        console.log(`message ${req.query.room}`, req.body)
        const messageType = req.query.message_type
        const room = req.query.room
        if (room != null) {
            io.sockets.in(room).emit(messageType, req.body);
        } else {
            io.emit(messageType, req.body);
        }
        res.end()
    });

    app.post("/mission", (req, res) => {
        console.log(`room ${req.query.room} type ${req.query.type}`, req.body);
        io.sockets.in(`${req.query.room}`).emit(req.query.type, req.body);
        res.end()
    });

    // example on how to serve static files from a given folder
    app.use(express.static("public"));

    // will fire for every new websocket connection
    io.on("connection", onNewWebsocketConnection);

    // important! must listen from `server`, not `app`, otherwise socket.io won't function correctly
    server.listen(SERVER_PORT, () => console.info(`Listening on port ${SERVER_PORT}.`));

}

startServer();
