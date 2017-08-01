// CSS

import 'bootstrap.css'
import 'font-awesome.css'
import 'nv.d3.css'
import 'normalize.css'
import '../css/chart.css'

// JS

// Babel-polyfill emulates a proper ES6 environment in older browsers
import 'babel-polyfill'
// Polyfill for the new AJAX function "fetch"
import 'whatwg-fetch'

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
