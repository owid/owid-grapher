import './charts.entry'

// Admin only CSS

import 'AdminLTE.min.css'
import '_all-skins.min.css'
import '../css/admin.css'

// Admin only code


declare var window: any
window.$ = window.jQuery = require('jquery')

require('./libs/bootstrap-treeview.min.js')
require('./libs/admin-lte-app.min')
require('./libs/bootstrap.min.js')

require('./admin/admin.global')

window.ChartEditorView = require('./admin/ChartEditorView').default

// Importer code

window.Importer = require('./admin/Importer').default