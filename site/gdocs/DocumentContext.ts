import { createContext, useContext } from "react"
import { ArchiveContext } from "@ourworldindata/types"
import { readFromAssetMap } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

export const DocumentContext = createContext<{
    isPreviewing: boolean
    archiveContext?: ArchiveContext
}>({
    isPreviewing: false,
})

export function useDocumentContext() {
    return useContext(DocumentContext)
}

export function useSiteAssetUrl(path: string): string {
    const { archiveContext } = useDocumentContext()
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path
    const fallback = `${BAKED_BASE_URL}/${normalizedPath}`

    if (archiveContext?.type !== "archive-page") return fallback

    return readFromAssetMap(archiveContext.assets.static, {
        path: normalizedPath,
        fallback,
    })
}
