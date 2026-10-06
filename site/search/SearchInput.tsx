import { ReactNode, forwardRef, ForwardedRef, useRef } from "react"
import { SearchUrlParam } from "@ourworldindata/types"
import { useIsClient, useMediaQuery } from "usehooks-ts"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import {
    isCurrentRef,
    getSearchAutocompleteId,
    getSearchAutocompleteItemId,
    SEARCH_BASE_PATH,
} from "./searchUtils.js"
import { useSearchAutocomplete } from "./SearchAutocompleteContext.js"

export const SearchInput = forwardRef(
    (
        {
            value,
            setLocalQuery,
            setGlobalQuery,
            onBackspaceEmpty,
            autoFocus,
            children,
            resetButton,
        }: {
            value: string
            setLocalQuery: (query: string) => void
            setGlobalQuery: (query: string) => void
            onBackspaceEmpty: () => void
            autoFocus: boolean
            children?: ReactNode
            resetButton?: React.ReactNode
        },
        inputRef: ForwardedRef<HTMLInputElement>
    ) => {
        const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
        const isClient = useIsClient()
        const hasUserInteracted = useRef(false)
        const {
            activeIndex,
            setActiveIndex,
            suggestions,
            showSuggestions,
            setShowSuggestions,
            onSelectActiveItem,
        } = useSearchAutocomplete()

        let placeholder = ""
        if (isClient) {
            // Only set the placeholder on the client so that useMediaQuery has a chance to initialize
            // Otherwise on mobile it will flash from the desktop version to the mobile placeholder
            placeholder = isSmallScreen
                ? "Search data, topics, countries or keywords…"
                : "Search for an indicator, a topic, a country, or a keyword…"
        }

        // Generate unique IDs for ARIA relationships using utility functions
        const autocompleteId = getSearchAutocompleteId()
        const activeOptionId = getSearchAutocompleteItemId(activeIndex)

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            // Handle backspace on empty input to remove last filter
            if (e.key === "Backspace" && value === "") {
                e.preventDefault()
                onBackspaceEmpty()
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
        const handleFormClick = (): void => {
            if (isCurrentRef(inputRef)) inputRef.current.focus()
        }

        return (
            <form
                className="search-form"
                role="search"
                // Submitting is handled in JS; action and the input's name
                // let Firefox offer "Add Search Engine" on right-click.
                action={SEARCH_BASE_PATH}
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
                        name={SearchUrlParam.QUERY}
                        // Named inputs get the browser's form history, which
                        // would cover our own suggestions.
                        autoComplete="off"
                        className="search-input body-3-regular"
                        ref={inputRef}
                        data-testid="search-input"
                        placeholder={placeholder}
                        enterKeyHint="search"
                        value={value}
                        role="combobox"
                        autoFocus={autoFocus}
                        aria-expanded={showSuggestions}
                        aria-controls={autocompleteId}
                        aria-activedescendant={activeOptionId}
                        aria-autocomplete="list"
                        onChange={(e) => {
                            hasUserInteracted.current = true
                            setLocalQuery(e.target.value)
                            if (e.target.value === "") {
                                setGlobalQuery("")
                            } else {
                                setShowSuggestions(true)
                                setActiveIndex(0)
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            // Only show suggestions on focus if the user has actually interacted
                            // This prevents showing suggestions on initial autofocus
                            if (hasUserInteracted.current) {
                                setShowSuggestions(true)
                                setActiveIndex(0)
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
