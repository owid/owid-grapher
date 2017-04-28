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
window.Backbone = require('backbone')
window.owid = require('./owid').default;


require('./libs/bootstrap.min.js')
require('./libs/admin-lte-app.min')
require('./libs/ion.rangeSlider.min')
require('./libs/jquery.nestable')
require('./libs/jquery.stickytabs')
require('./libs/jquery.timeago')
require('./libs/chosen.jquery')

require('./admin/admin.global')

require('./admin/App.Models.ChartVariableModel')
require('./admin/App.Models.EntityModel')

require('./admin/App.Collections.SearchDataCollection')
require('./admin/App.Collections.AvailableEntitiesCollection')

require('./admin/App.Views.UI.SelectVarPopup')
require('./admin/App.Views.UI.SettingsVarPopup')
require('./admin/App.Views.UI.ColorPicker')

require('./admin/App.Views.Form.ChartTypeSectionView')
require('./admin/App.Views.Form.AddDataSectionView')
require('./admin/App.Views.Form.EntitiesSectionView')
require('./admin/App.Views.Form.TimeSectionView')
require('./admin/App.Views.Form.DataTabView')
require('./admin/App.Views.Form.AxisTabView')
require('./admin/App.Views.Form.StylingTabView')
require('./admin/App.Views.Form.ExportTabView')
require('./admin/App.Views.Form.MapColorSection')
require('./admin/App.Views.Form.MapTabView')
require('./admin/App.Views.Form.SaveButtons')
window.Editor = require('./admin/ChartEditor').default

// Importer code

require('./libs/bootstrap3-wysihtml5.all')
window.Papa = require('./libs/papaparse')
window.moment = require('moment')
require('./admin/App.Models.ChartModel')        
require('./admin/App.Models.Import.DatasetModel')
require('./admin/App.Models.Importer')
require('./admin/App.Views.UI.ImportProgressPopup')
require('./admin/App.Views.Import.SourceSelector')
require('./admin/App.Views.Import.ChooseDatasetSection')
require('./admin/App.Views.Import.VariablesSection')
require('./admin/App.Views.Import.CategorySection')
App.Views.ImportView = require('./admin/App.Views.ImportView').default