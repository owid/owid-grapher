import {
    ADMIN_SERVER_HOST,
    ADMIN_SERVER_PORT,
    ENV,
    SLACK_ERRORS_WEBHOOK_URL,
} from "../settings/serverSettings.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { OwidAdminApp } from "./OwidAdminApp.js"

new OwidAdminApp({
    slackErrorsWebHookUrl: SLACK_ERRORS_WEBHOOK_URL,
    gitCmsDir: GIT_CMS_DIR,
    isDev: ENV === "development",
}).startListening(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST)
