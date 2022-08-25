// CSS
import "site/owid.scss"
import "grapher/core/grapher.scss"

// Enable mobx-formatters
import * as Mobx from "mobx"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mobxFormatters = require("mobx-formatters").default
mobxFormatters(Mobx)
//Mobx.useStrict(true)

import { Grapher } from "../core/Grapher.js"
declare let window: any
window.Grapher = Grapher
