import './charts.entry.js'

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

import './libs/bootstrap.min'
import './libs/bootstrap-datepicker'
import './libs/admin-lte-app.min'
import './libs/ion.rangeSlider.min'
import './libs/jquery.nestable'
import './libs/jquery.stickytabs'
import './libs/jquery.timeago'
import './libs/chosen.jquery'
import './admin'


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
App.Views.ImportView = require('./app/App.Views.ImportView').default