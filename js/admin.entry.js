import './charts.entry'

// Admin only CSS

import 'AdminLTE.min.css'
import '_all-skins.min.css'
import '../css/admin.css'

// Admin only code

window.$ = window.jQuery = require('jquery')
window.owid = require('./owid').default;

require('./libs/bootstrap-treeview.min.js')
require('./libs/admin-lte-app.min')

require('./admin/admin.global')

window.ChartEditorView = require('./admin/ChartEditorView').default

// Importer code

window.moment = require('moment')
window.Importer = require('./admin/Importer').default