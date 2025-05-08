import { useRef } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { useMediaQuery } from "usehooks-ts"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"

export const SearchInput = ({
    value,
    setLocalQuery,
    setGlobalQuery,
}: {
    value: string
    setLocalQuery: (query: string) => void
    setGlobalQuery: (query: string) => void
}) => {
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const inputRef = useRef<HTMLInputElement | null>(null)
    let placeholder = ""
    if (inputRef.current) {
        // Only set the placeholder once the component has rendered so that useMediaQuery has a chance to initialize
        // Otherwise on mobile it will flash from the desktop version to the mobile placeholder
        placeholder = isSmallScreen
            ? "Search data, topics, or keywords…"
            : "Search for an indicator, a topic, or a keyword…"
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
                        }
                    }}
                    onBlur={(e) => {
                        const recipient = e.relatedTarget
                        if (!recipient?.hasAttribute("data-prevent-onblur")) {
                            setGlobalQuery(value)
                        }
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
