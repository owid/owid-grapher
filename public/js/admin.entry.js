import './charts.entry'

// Admin only CSS

import 'AdminLTE.min.css'
import 'datepicker3.css'
import '_all-skins.min.css'
import 'ion.rangeSlider.css'
import 'ion.rangeSlider.skinFlat.css'
import 'bootstrap3-wysihtml5.css'
import 'bootstrap-chosen.css'
import '../css/admin.css'

// Admin only code

window.$ = window.jQuery = require('jquery')
import _ from 'underscore'
window._ = _

require('./libs/bootstrap.min.js')
require('./libs/admin-lte-app.min')
require('./libs/ion.rangeSlider.min')
require('./libs/jquery.nestable')
require('./libs/jquery.stickytabs')
require('./libs/jquery.timeago')
require('./libs/chosen.jquery')
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
window.Editor = require('./editor/Editor').default

// Importer code

require('./libs/bootstrap3-wysihtml5.all')
require('./libs/jszip')
window.Papa = require('./libs/papaparse')
window.moment = require('moment')
require('./app/App.Utils')
require('./app/App.Models.ChartModel')        
require('./app/App.Models.Import.DatasetModel')
require('./app/App.Models.Importer')
require('./app/App.Views.UI.ImportProgressPopup')
require('./app/App.Views.Import.SourceSelector')
require('./app/App.Views.Import.ChooseDatasetSection')
require('./app/App.Views.Import.VariablesSection')
require('./app/App.Views.Import.CategorySection')
App.Views.ImportView = require('./app/App.Views.ImportView').default