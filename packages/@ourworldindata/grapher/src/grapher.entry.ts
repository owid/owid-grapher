// Vite library entry point for @ourworldindata/grapher
// This bundles everything needed for external consumers:
// the full JS API plus grapher styles.

import "./core/grapher.scss"

import { Grapher } from "./core/Grapher.js"
import { FetchingGrapher } from "./core/FetchingGrapher.js"
import { GrapherInterface } from "@ourworldindata/types"

export { Grapher, FetchingGrapher, type GrapherInterface }
