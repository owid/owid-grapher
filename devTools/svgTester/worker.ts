// Creates a worker using the workerpool library.
// This way, we can spawn multiple threads that work away at our tasks in parallel.

import workerpool from "workerpool"

import * as utils from "./utils.js"

// create a worker and register public functions
workerpool.worker({
    renderAndVerifySvg: utils.renderAndVerifySvg,
    renderSvgAndSave: utils.renderSvgAndSave,
})
