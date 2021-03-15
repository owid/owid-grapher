#! /usr/bin/env node

import { bakeAndSaveResultsFile } from "./SVGTester"
const limit =
    process.argv[2] && !isNaN(parseInt(process.argv[2]))
        ? parseInt(process.argv[2])
        : undefined
bakeAndSaveResultsFile(limit)
