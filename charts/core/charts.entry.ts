// CSS
import "site/client/owid.scss"
import "charts/core/chart.scss"

// Enable mobx-formatters
import * as Mobx from "mobx"
const mobxFormatters = require("mobx-formatters").default
mobxFormatters(Mobx)
//Mobx.useStrict(true)

import { Grapher } from "site/client/Grapher"
import { ChartView } from "charts/core/ChartView"
declare var window: any
window.Grapher = Grapher
window.ChartView = ChartView
window.App = window.App || {}
