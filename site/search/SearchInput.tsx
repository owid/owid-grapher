import { useRef } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { useMediaQuery } from "usehooks-ts"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { useSearchAutocomplete } from "./searchUtils.js"

export const SearchInput = ({
    value,
    setLocalQuery,
    setGlobalQuery,
    showPlaceholder,
}: {
    value: string
    setLocalQuery: (query: string) => void
    setGlobalQuery: (query: string) => void
    showPlaceholder: boolean
}) => {
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const {
        activeIndex,
        setActiveIndex,
        suggestions,
        isOpen,
        setIsOpen,
        onSelectActiveItem,
    } = useSearchAutocomplete()

    let placeholder = ""
    if (showPlaceholder && inputRef.current) {
        // Only set the placeholder once the component has rendered so that useMediaQuery has a chance to initialize
        // Otherwise on mobile it will flash from the desktop version to the mobile placeholder
        placeholder = isSmallScreen
            ? "Search data, topics, or keywords…"
            : "Search for an indicator, a topic, or a keyword…"
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) return

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
                setIsOpen(false)
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

    return (
        <div className="data-catalog-search-box-container">
            <form
                className="data-catalog-search-form"
                onSubmit={(e) => {
                    e.preventDefault()
                    // unfocus input to hide autocomplete/hide mobile keyboard
                    if (inputRef.current) {
                        inputRef.current.blur()
                    }
                    setGlobalQuery(value)
                }}
            >
                <input
                    autoFocus
                    type="text"
                    className="data-catalog-search-input body-3-regular"
                    ref={inputRef}
                    placeholder={placeholder}
                    enterKeyHint="search"
                    value={value}
                    onChange={(e) => {
                        setLocalQuery(e.target.value)
                        if (e.target.value === "") {
                            setGlobalQuery("")
                            setActiveIndex(-1) // not highlighting the first default search
                        } else {
                            setIsOpen(true)
                            setActiveIndex(0)
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        setIsOpen(true)
                        setActiveIndex(value ? 0 : -1)
                    }}
                    onBlur={(e) => {
                        const recipient = e.relatedTarget
                        if (recipient?.hasAttribute("data-prevent-onblur"))
                            return
                        setIsOpen(false)
                    }}
                />
                <button
                    className="data-catalog-clear-input-button"
                    disabled={!value}
                    aria-label="Clear search"
                    type="button"
                    onClick={() => {
                        // We have to set both because the user might not have submitted the search yet
                        setLocalQuery("")
                        setGlobalQuery("")
                    }}
                >
                    <FontAwesomeIcon icon={faTimesCircle} />
                </button>
            </form>
        </div>
    )
}
