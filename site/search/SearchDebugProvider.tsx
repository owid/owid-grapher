import { useState } from "react"
import { SearchDebugContext } from "./SearchDebugContext.js"

interface SearchDebugProviderProps {
    children: React.ReactNode
}

export const SearchDebugProvider = ({ children }: SearchDebugProviderProps) => {
    const [isZenMode, setZenMode] = useState(false)

    return (
        <SearchDebugContext.Provider
            value={{
                isZenMode,
                setZenMode,
            }}
        >
            {children}
        </SearchDebugContext.Provider>
    )
}
