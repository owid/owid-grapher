import { createRoot, hydrateRoot } from "react-dom/client"
import { parseIntOrUndefined } from "@ourworldindata/utils"
import { Footnote } from "./Footnote.js"

interface FootnoteContent {
    index: number
    htmlContent: string
}

function getFootnoteContent(element: Element): FootnoteContent | null {
    const href = element.closest("a.ref")?.getAttribute("href")
    if (!href) return null

    const index = parseIntOrUndefined(href.split("-")[1])
    if (index === undefined) return null

    const referencedEl = document.querySelector(href)
    if (!referencedEl?.innerHTML) return null
    return { index, htmlContent: referencedEl.innerHTML }
}

export function hydrateFootnotes({
    container = document,
    hydrate = true,
}: {
    container?: ParentNode
    hydrate?: boolean
} = {}): void {
    const footnotes = container.querySelectorAll("a.ref")

    footnotes.forEach((footnote) => {
        if (!(footnote instanceof HTMLElement)) return
        if (footnote.dataset.owidFootnote === "true") return

        const footnoteContent = getFootnoteContent(footnote)
        if (!footnoteContent) return

        footnote.dataset.owidFootnote = "true"
        const element = (
            <Footnote
                index={footnoteContent.index}
                htmlContent={footnoteContent.htmlContent}
                triggerTarget={footnote}
            />
        )

        if (hydrate) hydrateRoot(footnote, element)
        else createRoot(footnote).render(element)
    })
}
