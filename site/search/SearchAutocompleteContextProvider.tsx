import { useState, ReactNode } from "react"
import { Filter } from "./searchTypes.js"
import { SearchAutocompleteContext } from "./searchUtils.js"

export function SearchAutocompleteContextProvider({
    children,
}: {
    children: ReactNode
}) {
    const [activeIndex, setActiveIndex] = useState<number>(0)
    const [suggestions, setSuggestions] = useState<Filter[]>([])
    const [isOpen, setIsOpen] = useState<boolean>(false)

    return (
        <SearchAutocompleteContext.Provider
            value={{
                activeIndex,
                setActiveIndex,
                suggestions,
                setSuggestions,
                isOpen,
                setIsOpen,
            }}
        >
            {children}
        </SearchAutocompleteContext.Provider>
    )
}
