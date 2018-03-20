// Legacy admin code entry point

import 'AdminLTE.min.css'
import '_all-skins.min.css'
import '../css/oldadmin.scss'
import '../css/libs/bootstrap.css'

declare var window: any
window.$ = window.jQuery = require('jquery')

require('./libs/bootstrap-treeview.min.js')
require('./libs/admin-lte-app.min')
require('./libs/bootstrap.min.js')

require('./admin/oldadmin')

window.Importer = require('./admin/Importer').default
window.Admin = require('./admin/Admin').default