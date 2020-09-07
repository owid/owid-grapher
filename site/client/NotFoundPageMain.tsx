import { Analytics } from "grapher/core/Analytics"
import { ENV } from "settings"

const analytics = new Analytics(ENV)

export function runNotFoundPage() {
    const query = window.location.pathname.split("/")
    const searchInput = document.getElementById("search_q") as HTMLInputElement
    if (searchInput && query.length)
        searchInput.value = decodeURIComponent(query[query.length - 1]).replace(
            /[\-_\+|]/g,
            " "
        )
    analytics.logPageNotFound(window.location.href)
}
