// CSS

import 'bootstrap.css'
import 'font-awesome.css'
import 'normalize.css'
import '../css/chart.css'

// Enable mobx-formatters
var Mobx = require('mobx')
var mobxFormatters = require('mobx-formatters').default

mobxFormatters(Mobx)
//Mobx.useStrict(true)

//import 'preact/devtools'

import ChartView from './charts/ChartView'
import ExportView from './charts/ExportView'
declare var window: any
window.ChartView = ChartView
window.ExportView = ExportView

import Debug from './charts/Debug'
Debug.expose()
