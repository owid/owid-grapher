// Currently chart editor only entry point; will eventually become entire app

import './charts.entry'

import '../css/editor.scss'

declare var window: any
window.Admin = require('./admin/Admin').default
