import { createContext, useContext } from "react"
import { ArchiveContext } from "@ourworldindata/types"

export const DocumentContext = createContext<{
    isPreviewing: boolean
    archiveContext?: ArchiveContext
    // True when the current gdoc post uses the `layout: bespoke-viz` article
    // variant. Read by ArticleBlock to enable the bespoke-viz viz enhancements
    // (Full-screen lightbox, fit-sizing, hidden viz heading) wherever the
    // bespoke-component sits (e.g. inside an author's sticky-left container).
    isBespokeViz?: boolean
    // v2: the article metadata (from the gdoc front-matter) that the bespoke-viz
    // layout renders at the top of the sticky-left RIGHT column (/latest-style),
    // instead of a full-width header band. Only set when isBespokeViz.
    bespokeVizMeta?: {
        title?: string
        subtitle?: string
        authors?: string[]
        authorRoles?: Record<string, string>
    }
}>({
    isPreviewing: false,
})

export function useDocumentContext() {
    return useContext(DocumentContext)
}
