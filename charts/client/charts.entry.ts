// CSS

import "charts/client/chart.scss"
import { Grapher } from "site/client/Grapher"

import { ChartView } from "../ChartView"
import { Debug } from "../Debug"

// Enable mobx-formatters
const Mobx = require("mobx")
const mobxFormatters = require("mobx-formatters").default
mobxFormatters(Mobx)
//Mobx.useStrict(true)

declare var window: any
window.Grapher = Grapher
window.ChartView = ChartView
window.App = window.App || {}

Debug.expose()
