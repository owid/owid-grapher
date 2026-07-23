// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../serverUtils/instrument.js"

import {
    ADMIN_SERVER_HOST,
    ADMIN_SERVER_PORT,
    ENV,
} from "../settings/serverSettings.js"
import { OwidAdminApp } from "./appClass.js"

if (require.main === module)
    new OwidAdminApp({
        isDev: ENV === "development",
    })
        .startListening(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST)
        .catch((err: Error) => {
            console.error(err.message)
            process.exit(1)
        })
