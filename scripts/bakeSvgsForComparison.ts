#! /usr/bin/env yarn tsn

import { bakeAllSVGS } from "site/server/bakeChartsToImages"

const devDir = __dirname + "/../public/devSvgs/"
const liveDir = __dirname + "/../public/liveSvgs/"

if (process.argv[2] === "dev") bakeAllSVGS(devDir)
else if (process.argv[2] === "live") bakeAllSVGS(liveDir)
else console.log("Specify live or dev")
