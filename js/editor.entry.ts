// Currently chart editor only entry point; will eventually become entire app

import './charts.entry'

import '../css/editor.css'
import 'material-components-web/dist/material-components-web.css'
import autoInit from '@material/auto-init'

window.Admin = require('./admin/Admin').default
autoInit()