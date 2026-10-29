"use strict";
const { parentPort, workerData } = require("node:worker_threads");
require("./extraction")
  .readPresentation(workerData)
  .then((slides) => parentPort.postMessage({ slides }))
  .catch((error) => parentPort.postMessage({ error: error.message }));
