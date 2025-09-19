import { createContext } from "react"
import { ArchiveContext } from "@ourworldindata/types"

export const DocumentContext = createContext<{
    isPreviewing: boolean
    archiveContext?: ArchiveContext
}>({
    isPreviewing: false,
})
