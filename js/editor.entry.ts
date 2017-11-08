// Currently chart editor only entry point; will eventually become entire app

import './charts.entry'

import '../css/editor.css'
import 'preact-material-components/style.css'

window.Admin = require('./admin/Admin').default
