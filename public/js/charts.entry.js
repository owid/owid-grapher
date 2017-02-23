// CSS

require('bootstrap.css')
require('font-awesome.css')
require('nv.d3.css')
require('../css/chart.css')

// JS

require('babel-polyfill');
require('./libs/modernizr-custom');
window.jQuery = require('jquery');
window.d3 = require('./libs/d3old');
require('./libs/nv.d3');
window.d3v4 = require('d3');
window._ = require('underscore');
_.extend(window, require('./libs/saveSvgAsPng'));
window.s = require('underscore.string');
window.Backbone = require('./libs/backbone');
window.colorbrewer = require('./libs/colorbrewer');
require('./libs/innersvg');

window.owid = require('./owid').default;
require('./app/owid.bounds');
owid.dataflow = require('./app/owid.dataflow').default;
require('./app/owid.colorbrewer');
require('preact/devtools');
require('./app/constants');
require('./app/App.Utils');
require('./app/App.Models.ChartModel');
require('./app/App.Models.MapModel');
require('./app/owid.models.mapdata');
require('./app/App.Models.VariableData');
require('./app/App.Models.ChartData');
require('./app/App.Models.Colors');
require('./app/App.Views.Chart.Header');
require('./app/owid.view.tooltip');
require('./app/owid.view.scaleSelectors');
require('./app/owid.view.axis');
require('./app/owid.view.axisBox');
require('./app/owid.view.timeline');
require('./app/owid.view.scatter');
require('./app/owid.viz.scatter');
require('./app/owid.view.entitySelect');
require('./app/App.Views.Chart.Legend');
require('./app/App.Views.Chart.ChartTab');
require('./app/DataTab');
require('./app/SourcesTab');

require('./app/App.Views.Chart.Map.Legend');

require('./app/App.Views.ChartURL');
require('./app/App.Views.Export');
require('./app/App.Views.DebugHelper');
owid.chart = require('./app/owid.chart').default;