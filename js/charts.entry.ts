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

//import 'preact/devtools'
require('./charts/constants');

window.d3 = require('./libs/d3old')

window.ChartView = require('./charts/ChartView').default;
window.ExportView = require('./charts/ExportView').default;
