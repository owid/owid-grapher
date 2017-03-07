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

//window.owid = require('./owid').default;
//owid.dataflow = require('./app/owid.dataflow').default;
//require('./app/owid.colorbrewer');
//import 'preact/devtools'
require('./app/constants');
require('./app/App.Utils');
require('./app/owid.view.tooltip');
require('./app/owid.view.axis');
require('./app/owid.view.axisBox');
require('./app/owid.view.timeline');
require('./app/owid.view.scatter');
require('./app/owid.viz.scatter');
require('./app/owid.view.entitySelect');
require('./app/App.Views.Chart.Legend');
require('./app/App.Views.Chart.ChartTab');

require('./app/App.Views.ChartURL');
require('./app/App.Views.Export');
require('./app/App.Views.DebugHelper');
window.owid = {}
owid.chart = require('./app/owid.chart').default;