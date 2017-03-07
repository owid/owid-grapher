// CSS

import 'bootstrap.css'
import 'font-awesome.css'
import 'nv.d3.css'
import '../css/chart.css'

// JS

// Babel-polyfill emulates a proper ES6 environment in older browsers
import 'babel-polyfill'
// Polyfill for the new AJAX function "fetch"
import 'whatwg-fetch'

import './libs/modernizr-custom'
import _ from 'underscore'

window.d3 = require('./libs/d3old');
require('./libs/nv.d3')
_.extend(window, require('./libs/saveSvgAsPng'));

//import 'preact/devtools'
require('./app/constants');
require('./app/App.Utils');

window.owid = {}
owid.chart = require('./app/owid.chart').default;