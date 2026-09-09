// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "./instrument.js"

// Plain CSS that admin.scss used to `@import`; see the note at its top.
// (Fonts come from public/fonts.css, linked in adminSiteServer/IndexPage.tsx.)
import "tippy.js/dist/tippy.css"
import "tippy.js/themes/light.css"
import "react-querybuilder/dist/query-builder.css"
import "./admin.scss"
import "@ourworldindata/grapher/src/core/grapher.scss"
import "./ExplorerCreatePage.scss"
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
