// CSS
import "site/client/owid.scss"
import "grapher/core/grapher.scss"

// Enable mobx-formatters
import * as Mobx from "mobx"
const mobxFormatters = require("mobx-formatters").default
mobxFormatters(Mobx)
//Mobx.useStrict(true)

import { GrapherPageUtils } from "site/client/GrapherPageUtils"
import { Grapher } from "grapher/core/Grapher"
declare var window: any
window.GrapherPageUtils = GrapherPageUtils
window.Grapher = Grapher
