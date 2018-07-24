
// This import has side-effects to do with React import binding, keep it up here
import {NODE_SERVER_PORT, NODE_SERVER_HOST, SLACK_ERRORS_WEBHOOK_URL} from '../settings'

import app from './app'
const errorToSlack = require('express-error-slack')

import * as db from '../db'
import * as wpdb from '../articles/wpdb'

db.connect()
wpdb.connect()

app.listen(NODE_SERVER_PORT, NODE_SERVER_HOST, () => {
    console.log(`Express started on ${NODE_SERVER_HOST}:${NODE_SERVER_PORT}`)
})

// Send errors to slack
if (SLACK_ERRORS_WEBHOOK_URL) {
    app.use(errorToSlack({ webhookUri: SLACK_ERRORS_WEBHOOK_URL }))
}