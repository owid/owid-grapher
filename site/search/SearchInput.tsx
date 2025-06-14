import { ReactNode, forwardRef, ForwardedRef } from "react"
import { useMediaQuery } from "usehooks-ts"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import {
    createFocusInputOnClickHandler,
    isCurrentRef,
    getSearchAutocompleteId,
    getSearchAutocompleteItemId,
} from "./searchUtils.js"
import { useSearchAutocomplete } from "./SearchAutocompleteContext.js"

export const SearchInput = forwardRef(
    (
        {
            value,
            setLocalQuery,
            setGlobalQuery,
            onBackspaceEmpty,
            children,
            resetButton,
        }: {
            value: string
            setLocalQuery: (query: string) => void
            setGlobalQuery: (query: string) => void
            onBackspaceEmpty: () => void
            children?: ReactNode
            resetButton?: React.ReactNode
        },
        inputRef: ForwardedRef<HTMLInputElement>
    ) => {
        const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
        const {
            activeIndex,
            setActiveIndex,
            suggestions,
            showSuggestions,
            setShowSuggestions,
            onSelectActiveItem,
        } = useSearchAutocomplete()

        let placeholder = ""
        if (isCurrentRef(inputRef)) {
            // Only set the placeholder once the component has rendered so that useMediaQuery has a chance to initialize
            // Otherwise on mobile it will flash from the desktop version to the mobile placeholder
            placeholder = isSmallScreen
                ? "Search data, topics, or countries…"
                : "Search for an indicator, a topic, or a country…"
        }

        // Generate unique IDs for ARIA relationships using utility functions
        const autocompleteId = getSearchAutocompleteId()
        const activeOptionId = getSearchAutocompleteItemId(activeIndex)

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            // Handle backspace on empty input to remove last filter
            if (e.key === "Backspace" && value === "") {
                e.preventDefault()
                onBackspaceEmpty()
                setActiveIndex(-1)
                return
            }

            if (!showSuggestions || !suggestions.length) return

            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault()
                    setActiveIndex(
                        activeIndex < suggestions.length - 1
                            ? activeIndex + 1
                            : activeIndex
                    )
                    break

                case "ArrowUp":
                    e.preventDefault()
                    setActiveIndex(activeIndex > 0 ? activeIndex - 1 : -1)
                    break

                case "Escape":
                    e.preventDefault()
                    setShowSuggestions(false)
                    break

                case "Enter":
                    e.preventDefault()
                    if (activeIndex >= 0) {
                        onSelectActiveItem()
                    } else {
                        // Submit the form
                        setGlobalQuery(value)
                    }
                    break
            }
        }

        // Allow clicks on the form to focus the input. This is useful on mobile
        // when the search bar stretches vertically and reveals white space
        // readers might be clicking on. Do register clicks on children, as we
        // want clicks removing active filters or resetting the search to focus
        // the input.
        const handleFormClick = createFocusInputOnClickHandler(inputRef)

        return (
            <form
                className="search-form"
                role="search"
                onSubmit={(e) => {
                    e.preventDefault()
                    // unfocus input to hide autocomplete/hide mobile keyboard
                    if (isCurrentRef(inputRef)) {
                        inputRef.current.blur()
                    }
                    setGlobalQuery(value)
                }}
                onClick={handleFormClick}
            >
                {children}
                <div className="search-input-row">
                    <input
                        type="text"
                        className="search-input body-3-regular"
                        ref={inputRef}
                        placeholder={placeholder}
                        enterKeyHint="search"
                        value={value}
                        role="combobox"
                        aria-expanded={showSuggestions}
                        aria-controls={autocompleteId}
                        aria-activedescendant={activeOptionId}
                        aria-autocomplete="list"
                        onChange={(e) => {
                            setLocalQuery(e.target.value)
                            if (e.target.value === "") {
                                setGlobalQuery("")
                                setActiveIndex(-1) // not highlighting the first default search
                            } else {
                                setShowSuggestions(true)
                                setActiveIndex(0)
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            setShowSuggestions(true)
                            setActiveIndex(value ? 0 : -1)

                            // Scroll to position the input near the top of the viewport on mobile
                            if (isSmallScreen && isCurrentRef(inputRef)) {
                                const rect =
                                    inputRef.current.getBoundingClientRect()
                                window.scrollBy({
                                    top: rect.top - 24,
                                    behavior: "smooth",
                                })
                            }
                        }}
                        onBlur={() => {
                            setShowSuggestions(false)
                        }}
                    />
                    {resetButton}
                </div>
            </form>
        )
    }
)

SearchInput.displayName = "SearchInput"
