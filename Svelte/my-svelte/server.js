const path = require("path");
const express = require("express");
const app = require("./public/App.js");

const server = express();

server.use(express.static(path.join(__dirname, "public")));

server.get("*", function(req, res) {
    const { html } = app.render({ url: req.url });

    res.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset='UTF-8' />
    <meta name='viewport' content='width=device-width, initial-scale=1.0' />
    <link rel='stylesheet' href='/global.css'>
    <link rel='stylesheet' href='/bundle.css'>
    <link rel="icon" type="image/png" href="/favicon.png">
    <title>Svelte</title>
    </head>
    <body>
    <div id="app">${html}</div>
    </body>
    <script src="/bundle.js"></script>
    </html>
  `);

    res.end();
});

const port = 3000;
server.listen(port, () => console.log(`Listening on port ${port}`));