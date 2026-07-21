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
}>({
    isPreviewing: false,
})

export function useDocumentContext() {
    return useContext(DocumentContext)
}
