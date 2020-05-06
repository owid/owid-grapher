import { tippyCore } from "charts/Tippy"

export function runPageTooltips() {
    const tooltips = document.querySelectorAll("a.ref sup")

    tippyCore(tooltips, {
        appendTo: () => document.body,
        allowHTML: true,
        content: el => {
            const referencedId = el.closest("a.ref")?.getAttribute("href")
            if (!referencedId) return ""
            const referencedEl = document.querySelector(referencedId)
            return referencedEl?.innerHTML ?? ""
        },
        interactive: true,
        theme: "owid-reference",
        placement: "auto"
    })
}
