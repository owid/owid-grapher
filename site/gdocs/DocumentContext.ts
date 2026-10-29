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

/** The URL of the versions file, on live pages and on archive pages */
export function useVersionsFileUrl(): string | undefined {
    const { archiveContext } = useDocumentContext()
    return (
        archiveContext?.versionsFileUrl ??
        (archiveContext?.type === "archive-page"
            ? archiveContext.archiveNavigation.versionsFileUrl
            : undefined)
    )
}
