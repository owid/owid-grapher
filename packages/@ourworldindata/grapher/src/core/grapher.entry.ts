import "./grapher.scss"

// Enable mobx-formatters
import * as Mobx from "mobx"
// eslint-disable-next-line @typescript-eslint/no-var-requires
import mobxFormatters from "mobx-formatters"
mobxFormatters(Mobx)
//Mobx.useStrict(true)

import { Grapher } from "./Grapher"
declare let window: any
window.Grapher = Grapher
