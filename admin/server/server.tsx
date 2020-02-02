// This import has side-effects to do with React import binding, keep it up here
import { ADMIN_SERVER_HOST, ADMIN_SERVER_PORT } from "settings"

import { app } from "./app"

import * as db from "db/db"
import * as wpdb from "db/wpdb"
import { log } from "utils/server/log"

async function main() {
    try {
        await db.connect()

        // The Grapher should be able to work without Wordpress being set up.
        try {
            await wpdb.connect()
        } catch (error) {
            console.error(error)
            console.log(
                "Could not connect to Wordpress database. Continuing without Wordpress..."
            )
        }

        app.listen(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST, () => {
            console.log(
                `owid-admin server started on ${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
            )
        })
    } catch (e) {
        log.error(e)
        process.exit(1)
    }
}

main()
