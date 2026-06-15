// ============================================================================
//  hello-svc  —  Milestone 1
//  A deliberately tiny Express service. Its only job is to prove that nginx
//  can forward a request to it and hand the answer back to the browser.
//
//  Notice: it listens on port 3000 *inside its own container*. It is NOT
//  published to your machine. The only way to reach it is THROUGH nginx.
// ============================================================================

const express = require('express');
const os = require('os');

const app = express();
const PORT = 3000;
const NAME = process.env.SERVICE_NAME || 'hello-svc';

// Main endpoint. We return JSON that includes the container's hostname —
// that becomes useful later (Milestone 6) when we run TWO copies and watch
// nginx load-balance between them: the hostname will flip back and forth.
app.get('/', (req, res) => {
  res.json({
    service: NAME,
    message: 'Hello from a Node service, reached THROUGH nginx!',
    servedBy: os.hostname(),       // the container id — proof of who answered
    youAskedFor: req.originalUrl,  // shows what path the service actually saw
  });
});

// A health endpoint — a microservices convention. Orchestrators (and nginx,
// later) use a path like this to check "is this service alive?".
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: NAME });
});

app.listen(PORT, () => {
  console.log(`[${NAME}] listening on port ${PORT}`);
});
