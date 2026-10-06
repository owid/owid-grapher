import { createContext, useContext } from "react"
import {
    ArchiveContext,
    OwidGdocType,
    RefDictionary,
} from "@ourworldindata/types"

export const DocumentContext = createContext<{
    isPreviewing: boolean
    archiveContext?: ArchiveContext
    footnotes?: RefDictionary
    gdocType?: OwidGdocType
}>({
    isPreviewing: false,
})

export function useDocumentContext() {
    return useContext(DocumentContext)
}
