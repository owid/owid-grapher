import * as React from "react"
import { hydrate } from "react-dom"
import NotFoundPageForm from "./NotFoundPageForm.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

export function runNotFoundPage() {
    analytics.logPageNotFoundError(window.location.href)
    hydrate(
        <NotFoundPageForm />,
        document.getElementById("not-found-page-form")
    )
}
