require('./charts.entry.js')

// Admin only CSS

require('AdminLTE.min.css')
require('datepicker3.css')
require('_all-skins.min.css')
require('ion.rangeSlider.css')
require('ion.rangeSlider.skinFlat.css')
require('bootstrap3-wysihtml5.css')
require('bootstrap-chosen.css')
require('../css/admin.css')

// Admin only code

require('./libs/bootstrap.min');
require('./libs/bootstrap-datepicker')
require('./libs/admin-lte-app.min')
require('./libs/ion.rangeSlider.min')
require('./libs/jquery.nestable')
require('./libs/jquery.stickytabs')
require('./libs/jquery.timeago')
require('./libs/chosen.jquery');
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

// Importer code

require('./libs/bootstrap3-wysihtml5.all')
require('./libs/jszip.js')
window.Papa = require('./libs/papaparse.js')
window.moment = require('moment')
require('./app/App.Utils.js')
require('./app/App.Models.ChartModel.js')        
require('./app/App.Models.Import.DatasetModel.js')
require('./app/App.Models.Importer.js')
require('./app/App.Views.UI.ImportProgressPopup.js')
require('./app/App.Views.Import.SourceSelector.js')
require('./app/App.Views.Import.ChooseDatasetSection.js')
require('./app/App.Views.Import.VariablesSection.js')
require('./app/App.Views.Import.CategorySection.js')
App.Views.ImportView = require('./app/App.Views.ImportView.js').default