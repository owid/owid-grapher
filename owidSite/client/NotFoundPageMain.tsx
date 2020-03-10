import { Analytics } from "./Analytics"

export function runNotFoundPage() {
    const query = window.location.pathname.split("/")
    const searchInput = document.getElementById("search_q") as HTMLInputElement
    if (searchInput && query.length)
        searchInput.value = decodeURIComponent(query[query.length - 1]).replace(
            /[\-_\+|]/g,
            " "
        )
    Analytics.logEvent("NOT_FOUND", { href: window.location.href })
}
