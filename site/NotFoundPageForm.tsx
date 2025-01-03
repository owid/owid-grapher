import { useState, useRef, useEffect } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSearch, faCircleXmark } from "@fortawesome/free-solid-svg-icons"

export default function NotFoundPageForm() {
    const [searchQuery, setSearchQuery] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        // Browser keeps the DOM input value on page refresh.
        const domValue = inputRef.current?.value
        if (domValue) setSearchQuery(domValue)
    }, [])

    return (
        <form className="NotFoundPageForm" action="/search" method="GET">
            <input
                id="search_q"
                className="NotFoundPageForm__input"
                ref={inputRef}
                type="search"
                placeholder="Search..."
                name="q"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                required
                autoFocus
            />
            {searchQuery && (
                <button
                    className="NotFoundPageForm__button NotFoundPageForm__reset-button"
                    type="reset"
                    title="Clear search"
                    onClick={() => setSearchQuery("")}
                >
                    <FontAwesomeIcon icon={faCircleXmark} />
                </button>
            )}
            <button
                className="NotFoundPageForm__button NotFoundPageForm__submit-button"
                type="submit"
                title="Search"
            >
                <FontAwesomeIcon icon={faSearch} />
            </button>
        </form>
    )
}
