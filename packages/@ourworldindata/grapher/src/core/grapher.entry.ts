import "./grapher.scss"

// Enable mobx-formatters
import * as Mobx from "mobx"
import mobxFormatters from "mobx-formatters"
mobxFormatters(Mobx)
//Mobx.useStrict(true)

import { Grapher } from "./Grapher"
declare let window: any
window.Grapher = Grapher
