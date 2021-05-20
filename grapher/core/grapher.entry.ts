// CSS
import "site/owid.scss"
import "grapher/core/grapher.scss"

// Enable mobx-formatters
import * as Mobx from "mobx"
const mobxFormatters = require("mobx-formatters").default
mobxFormatters(Mobx)
//Mobx.useStrict(true)

import { Grapher } from "../core/Grapher"
declare let window: any
window.Grapher = Grapher
