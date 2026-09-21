import { createContext, useContext } from "react"
import { ArchiveContext, OwidGdocType } from "@ourworldindata/types"

export const DocumentContext = createContext<{
    isPreviewing: boolean
    archiveContext?: ArchiveContext
    gdocType?: OwidGdocType
}>({
    isPreviewing: false,
})

export function useDocumentContext() {
    return useContext(DocumentContext)
}
