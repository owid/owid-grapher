import './charts.entry'

// Admin only CSS

import 'AdminLTE.min.css'
import 'datepicker3.css'
import '_all-skins.min.css'
import 'ion.rangeSlider.css'
import 'ion.rangeSlider.skinFlat.css'
import 'bootstrap3-wysihtml5.css'
import '../css/admin.css'

// Admin only code

window.$ = window.jQuery = require('jquery')
window.owid = require('./owid').default;

require('./libs/bootstrap.min.js')
require('./libs/bootstrap-treeview.min.js')
require('./libs/admin-lte-app.min')
require('./libs/ion.rangeSlider.min')
require('./libs/jquery.nestable')
require('./libs/jquery.timeago')

require('./admin/admin.global')

window.ChartEditorView = require('./admin/ChartEditorView').default

// Importer code

require('./libs/bootstrap3-wysihtml5.all')
window.moment = require('moment')
window.Importer = require('./admin/Importer').default