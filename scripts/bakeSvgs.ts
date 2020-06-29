#! /usr/bin/env yarn tsn

import { bakeAllSVGS } from "site/server/bakeChartsToImages"

const outputDir = process.argv[2]
bakeAllSVGS(outputDir)
