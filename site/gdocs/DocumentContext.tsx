import { OwidGdocType } from "@ourworldindata/types"
import { createContext } from "react"

export const DocumentContext = createContext<{
    isPreviewing: boolean
    // Currently used in Image.tsx to always use smallFilename when viewing a data insight
    documentType?: OwidGdocType
}>({
    isPreviewing: false,
    documentType: undefined,
})
