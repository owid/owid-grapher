// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "./instrument.js"

import "./admin.scss"
import "@ourworldindata/grapher/src/core/grapher.scss"
import "../adminSiteClient/ExplorerCreatePage.scss"
import "handsontable/dist/handsontable.full.css"
import updateLocale from "dayjs/plugin/updateLocale"
import { dayjs } from "@ourworldindata/utils"
import { Admin } from "./Admin"

// Start the antd Datepicker week on Monday (see GdocsDateline.tsx)
dayjs.extend(updateLocale)
dayjs.updateLocale("en", {
    weekStart: 1,
})

declare let window: any

window.Admin = Admin
