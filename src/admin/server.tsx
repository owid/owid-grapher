
// This import has side-effects to do with React import binding, keep it up here
import {ADMIN_SERVER_PORT, ADMIN_SERVER_HOST} from '../settings'

import { app } from './app'

import * as db from '../db'
import * as wpdb from '../articles/wpdb'

db.connect()
wpdb.connect()

app.listen(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST, () => {
    console.log(`owid-admin server started on ${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`)
})