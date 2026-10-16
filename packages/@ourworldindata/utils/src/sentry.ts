import type { BrowserOptions } from "@sentry/browser"

// (Mostly) preserve v10's data collection defaults; v11 enables broader collection by default.
// See https://blog.sentry.io/datacollection-control-panel/#2-previous-senddefaultpii-false-or-unset-5
export const SENTRY_DATA_COLLECTION: BrowserOptions["dataCollection"] = {
    userInfo: false,
    cookies: false,
    httpHeaders: {
        request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
        response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
}
