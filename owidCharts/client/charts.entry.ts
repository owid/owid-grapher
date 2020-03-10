// CSS

import "charts/client/chart.scss"

// Enable mobx-formatters
const Mobx = require("mobx")
const mobxFormatters = require("mobx-formatters").default
mobxFormatters(Mobx)
//Mobx.useStrict(true)

import { Grapher } from "site/client/Grapher"
import { ChartView } from "../ChartView"
declare var window: any
window.Grapher = Grapher
window.ChartView = ChartView
window.App = window.App || {}

import { Debug } from "../Debug"
Debug.expose()
