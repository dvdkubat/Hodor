const http = require('http');
var express = require('express');
const app = express();
const fs = require('fs');
var url = require('url');

// var events = require('events');
// var eventEmitter = new events.EventEmitter();

const hostname = '127.0.0.1';
const port = 3000;


/*
app.use(express.bodyParser());
*/

app.use(
    express.urlencoded({
        extended: true,
    })
)


var server = require('http').Server(app);
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});


app.get("", (req, res) => {
    res.sendFile(__dirname + "/index.html")
})

/// takhle bych to zvládl přes odkaz > a href a tam co chci stáhnout > musím udělat parse pro url
app.get("/*", (req, res) => {
    console.log("*", req.url);
    res.redirect('http://127.0.0.1:3000/');
    return;
    res.sendFile(__dirname + "/index.html")
})




// form - post > ale vše na hromadě přes url bych pak musel udělat parse (zbavit se lomítka)
/*
app.post("/*", async (req, res) => {
    console.log("*", req.url, req.params,  )
    res.redirect('http://127.0.0.1:3000/');
})
*/

/// nebo by to šlo rozjet přes form - action > mám přímo operaci v inputu
app.post("/index", async (req, res) => {
    const searchItem = await req.body.operaction
    console.log(searchItem)
    res.redirect('http://127.0.0.1:3000/');
})

app.post("/karel", async (req, res) => {
    const searchItem = await req.body.operaction
    console.log(searchItem)

    res.redirect('http://127.0.0.1:3000/');
})






/*
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
var server = require('http').Server(app);
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
*/

