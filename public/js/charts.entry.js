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

import _ from 'underscore'

window.d3 = require('./libs/d3old');
require('./libs/nv.d3')

//import 'preact/devtools'
require('./app/constants');

import owid from './owid'
owid.chart = require('./app/owid.chart').default;