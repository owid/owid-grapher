require('./libs/modernizr-custom');
window.jQuery = require('./libs/jquery');
window.d3 = require('./libs/d3');
require('./libs/nv.d3');
window.d3v4 = require('./libs/d3.v4');
window._ = require('./libs/underscore');
_.extend(window, require('./libs/saveSvgAsPng'));
require('./libs/topojson');
window.s = require('./libs/underscore.string');
window.Backbone = require('./libs/backbone');
require('./libs/bootstrap.min');
require('./libs/chosen.jquery');
window.colorbrewer = require('./libs/colorbrewer');
require('./libs/jquery.lazyloadxt.extra');
window.async = require('./libs/async');
window.Cookies = require('./libs/js.cookie');
window.ResizeSensor = require('./libs/ResizeSensor');
window.ElementQueries = require('./libs/ElementQueries');
window.Fuse = require('./libs/fuse');
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
owid.component = {};
owid.component.footer = require('./app/owid.component.footer').default;
require('./app/owid.view.tooltip');
require('./app/owid.view.scaleSelectors');
require('./app/owid.view.axis');
require('./app/owid.view.axisBox');
require('./app/owid.view.scatter');
require('./app/owid.viz.scatter');
require('./app/owid.view.entitySelect');
owid.view.controlsFooter = require('./app/ControlsFooter').default;
require('./app/App.Views.Chart.Legend');
owid.component.slopeChart = require('./app/owid.component.slopeChart').default;
require('./app/App.Views.Chart.ChartTab');
require('./app/DataTab');
require('./app/owid.component.sourcesTab');
require('./app/owid.component.shareTab');

require('./app/owid.data.world');
require('./app/App.Views.Chart.Map.MapControls');
require('./app/App.Views.Chart.Map.Projections');
require('./app/App.Views.Chart.Map.Legend');
owid.component.mapTab = require('./app/owid.component.mapTab').default;

require('./app/App.Views.ChartURL');
require('./app/App.Views.Export');
require('./app/App.Views.DebugHelper');
require('./app/owid.chart');

// Admin only code

require('./libs/bootstrap-datepicker')
require('./libs/admin-lte-app.min')
require('./libs/ion.rangeSlider.min')
require('./libs/jquery.nestable')
require('./libs/jquery.stickytabs')
require('./libs/jquery.timeago')
require('./admin')

require('./app/App.Models.ChartVariableModel')
require('./app/App.Models.EntityModel')

require('./app/App.Collections.SearchDataCollection')
require('./app/App.Collections.AvailableEntitiesCollection')

require('./app/App.Views.UI.SelectVarPopup')
require('./app/App.Views.UI.SettingsVarPopup')
require('./app/App.Views.UI.ColorPicker')

require('./app/owid.config.scatter')
require('./app/App.Views.Form.ChartTypeSectionView')
require('./app/App.Views.Form.AddDataSectionView')
require('./app/App.Views.Form.EntitiesSectionView')
require('./app/App.Views.Form.TimeSectionView')
require('./app/App.Views.Form.DataTabView')
require('./app/App.Views.Form.AxisTabView')
require('./app/App.Views.Form.StylingTabView')
require('./app/App.Views.Form.ExportTabView')
require('./app/App.Views.Form.MapColorSection')
require('./app/App.Views.Form.MapTabView')
require('./app/App.Views.Form.SaveButtons')
window.Editor = require('./editor/Editor.jsx').default