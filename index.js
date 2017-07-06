const http = require('http');
const proxyServer = require('http-proxy');
const fs = require('fs');
const express = require('express');
const app = express();
const appRouter = express.Router();
app.use(require('helmet')());
app.use(require('cors')());
app.use(require('body-parser').json());
app.use(require('compression')());
app.use('/api', appRouter);

let args = process.argv.splice(2);
let proxyPort; // Port for proxyn hosts
let port; // Port for crud of hosts
let hostList;
function readServers () {
  try {
    hostList = JSON.parse(fs.readFileSync('hosts.json', 'utf8'));
    console.log('Hosts loaded.');
    proxyPort = parseInt(args[0] || "80");
    servicePort = proxyPort + 1;
    server.listen(proxyPort, () => {
      console.log(`Proxy server on port ${proxyPort}`);
    });
    app.listen(servicePort, () => {
      console.log(`Server on port ${servicePort}`);
    });
  } catch (ex) {
    throw ex;
  }
};

function writeServers () {
  try {
    fs.writeFileSync('hosts.json', JSON.stringify(hostList));
    console.log('Hosts saved.');
  } catch (ex) {
    throw ex;
  }
};

function sendError(res, err) {
    res.writeHeader(500);
    res.write(JSON.stringify({
      error: err
    }));
    res.end();
};

let proxy = proxyServer.createProxyServer({});
const server = http.createServer((req, res) => {
  let hosts = hostList[req.headers['x-host']];
  if (!hosts && (args[1] === 'true')) {
    hosts = hostList['default'];
  }
  if (!hosts) {
    res.writeHeader(404, res.headers)
    res.write(JSON.stringify({
      error: 'Servers for proxying not sent on headers x-host.'
    }));
    return res.end();
  }
  let address = hosts.url[hosts.curr];
  hosts.curr = (hosts.curr + 1) % hosts.url.length;
  console.log(address);
  try {
    proxy.web(req, res, {
      target: address
    }, (err) => {
      console.log(`Error: ${JSON.stringify(err, null, ' ')}`);
      sendError(res, err);
    });
  } catch (ex) {
    sendError(res, err);
  }
});

readServers();

appRouter.get('/status', (req, res) => {
  res.send();
});

appRouter.get('/hosts', (req, res) => {
  res.json(hostList);
});

appRouter.get('/hosts/:id', (req, res) => {
  if (!hostList[req.params.id]) {
    return res.status(404).send('Server not found.');
  }
  res.json(hostList[req.params.id]);
});

appRouter.post('/hosts', (req, res) => {
  if (!req.body.host || !req.body.port) {
    return res.status(404).json({
      err: 'Host or port not sent. Payload structure: {"host":"<host>", "port": <port>}'
    });
  }
  let hosts = hostList[req.headers['x-host']];
  if (!hosts) {
    hosts = {
      url: [],
      curr: -1
    };
    hostList[req.headers['x-host']] = hosts;
  }
  let indexSrv = -1;
  hosts.url.forEach((url, index) => {
    if ((url.host === req.body.host) && (url.port === parseInt(req.body.port))) {
      indexSrv = index;
    }
  });
  if (indexSrv === -1) {
    hosts.url.push({
      host: req.body.host,
      port: parseInt(req.body.port)
    });
  }
  writeServers();
  res.status(200).send();
});

// Must send like query params host and port
appRouter.delete('/hosts', (req, res) => {
  let hosts = hostList[req.headers['x-host']];
  let found = false;
  if (!hosts) {
    return res.status(404).json({
      error: `Host not found ${req.headers['x-host']}`
    });
  }
  hosts.url.forEach((url, index) => {
    if ((url.host === req.query.host) && (url.port === parseInt(req.query.port))) {
      hosts.url.splice(index, 1);
      found = true;
    }
  });
  hosts.curr = hosts.url.length;
  res.status(found ? 200 : 404).send(found ? undefined : `Host ${req.query.host} and port ${req.query.port} not found.`);
});