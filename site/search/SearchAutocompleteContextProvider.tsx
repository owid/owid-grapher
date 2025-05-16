import { useState, ReactNode, useRef, useCallback } from "react"
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
    const selectionHandlerRef = useRef<((filter: Filter) => void) | null>(null)

    // Register a handler that will be called when an item is selected
    const registerSelectionHandler = useCallback(
        (handler: (filter: Filter) => void) => {
            selectionHandlerRef.current = handler
        },
        []
    )

    // Handles selection of the currently active item
    const onSelectActiveItem = useCallback(() => {
        if (!selectionHandlerRef.current) return

        // Call the registered handler with the selected filter
        selectionHandlerRef.current(suggestions[activeIndex])
    }, [activeIndex, suggestions])

    return (
        <SearchAutocompleteContext.Provider
            value={{
                activeIndex,
                setActiveIndex,
                suggestions,
                setSuggestions,
                isOpen,
                setIsOpen,
                onSelectActiveItem,
                registerSelectionHandler,
            }}
        >
            {children}
        </SearchAutocompleteContext.Provider>
    )
}
