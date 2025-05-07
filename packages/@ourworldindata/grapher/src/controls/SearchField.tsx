import {
    faCircleXmark,
    faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as React from "react"
import cx from "classnames"

export function SearchField({
    value,
    placeholder,
    trackNote,
    onChange,
    onClear,
}: {
    value: string
    placeholder: string
    trackNote: string
    onChange: (value: string) => void
    onClear: () => void
}): React.ReactElement {
    return (
        <div
            className={cx("grapher-search-field", {
                "grapher-search-field--empty": !value,
            })}
        >
            <FontAwesomeIcon className="search-icon" icon={faMagnifyingGlass} />
            <input
                type="search"
                value={value}
                onChange={(event) => onChange(event.currentTarget.value)}
                data-track-note={trackNote}
            />
            {/* We don't use the input's built-in placeholder because
                we want the input text and placeholder text to have different
                font sizes, which isn't well-supported across browsers.
                The input text needs to be 16px to prevent auto-zoom on iOS,
                but the placeholder text should have a smaller font size. */}
            {!value && (
                <span className="search-placeholder">{placeholder}</span>
            )}
            {value && (
                <button
                    type="button"
                    className="clear"
                    onClick={() => onClear()}
                >
                    <FontAwesomeIcon icon={faCircleXmark} />
                </button>
            )}
        </div>
    )
}
