import { createContext, useContext } from "react"

interface SearchDebugContextType {
    isZenMode: boolean
    setZenMode: (show: boolean) => void
}

export const SearchDebugContext = createContext<SearchDebugContextType | null>(
    null
)

export const useSearchDebugContext = () => {
    const context = useContext(SearchDebugContext)
    if (!context) {
        throw new Error(
            "useSearchDebugContext must be used within a SearchDebugProvider"
        )
    }
    return context
}
