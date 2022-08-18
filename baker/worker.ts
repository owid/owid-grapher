// Creates a worker using the workerpool library.
// This way, we can spawn multiple threads that work away at our tasks in parallel.

import workerpool from "workerpool"
import * as grapherBaker from "./GrapherBaker.js"

// create a worker and register public functions
workerpool.worker({
    bakeVariableData: grapherBaker.bakeVariableData,
    bakeSingleGrapherChart: grapherBaker.bakeSingleGrapherChart,
})
