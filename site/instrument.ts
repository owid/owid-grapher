import { LOAD_SENTRY } from "../settings/clientSettings.js"
import { initializeSentry } from "./SentryUtils.js"

if (LOAD_SENTRY) {
    void initializeSentry()
}
