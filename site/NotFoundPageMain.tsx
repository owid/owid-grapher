import { SiteAnalytics } from "./SiteAnalytics"

const analytics = new SiteAnalytics()

export function runNotFoundPage() {
    const query = window.location.pathname.split("/")
    const searchInput = document.getElementById("search_q") as HTMLInputElement
    if (searchInput && query.length)
        searchInput.value = decodeURIComponent(query[query.length - 1]).replace(
            /[\-_\+|]/g,
            " "
        )
    analytics.logPageNotFoundError(window.location.href)
}
