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
require('./libs/jquery.timeago')
require('./libs/chosen.jquery')

require('./admin/admin.global')

require('./admin/App.Views.UI.SelectVarPopup')
require('./admin/App.Views.UI.SettingsVarPopup')

window.ChartEditorView = require('./admin/ChartEditorView').default

// Importer code

require('./libs/bootstrap3-wysihtml5.all')
window.Papa = require('./libs/papaparse')
window.moment = require('moment')
require('./charts/App.Models.ChartModel')
window.Importer = require('./admin/Importer').default