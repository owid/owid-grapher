import { hydrateRoot } from "react-dom/client"
import NotFoundPageForm from "./NotFoundPageForm.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

export function runNotFoundPage() {
    analytics.logPageNotFoundError(window.location.href)
    const container = document.getElementById("not-found-page-form")
    if (!container) return
    hydrateRoot(container, <NotFoundPageForm />)
}
