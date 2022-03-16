import workerpool from "workerpool"

import * as utils from "./utils.js"

// create a worker and register public functions
workerpool.worker({
    renderAndVerifySvg: utils.renderAndVerifySvg,
})
