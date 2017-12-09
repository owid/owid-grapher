// CSS

import 'font-awesome.css'
import '../css/chart.css'

// Enable mobx-formatters
const Mobx = require('mobx')
const mobxFormatters = require('mobx-formatters').default
mobxFormatters(Mobx)
//Mobx.useStrict(true)

//import 'preact/devtools'

import Grapher from './charts/Grapher'
import ChartView from './charts/ChartView'
declare var window: any
window.Grapher = Grapher
window.ChartView = ChartView

import Debug from './charts/Debug'
Debug.expose()
