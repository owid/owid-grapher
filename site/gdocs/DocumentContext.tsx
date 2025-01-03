import { createContext } from "react"

export const DocumentContext = createContext<{ isPreviewing: boolean }>({
    isPreviewing: false,
})
