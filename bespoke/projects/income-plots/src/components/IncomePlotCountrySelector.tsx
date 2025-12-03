import { useAtom, useAtomValue } from "jotai"
import {
    atomAvailableCountryNames,
    atomSelectedCountryNames,
} from "../store.ts"
import { Suspense, useEffect, useRef, useState } from "react"
import { ListBox, ListBoxItem } from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons"
import { useFloating, offset, flip, shift } from "@floating-ui/react"

const IncomePlotCountrySelectorInner = () => {
    const availableCountryNames = useAtomValue(atomAvailableCountryNames)
    const [selectedCountryNames, setSelectedCountryNames] = useAtom(
        atomSelectedCountryNames
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const buttonRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    const { refs, floatingStyles } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: "bottom-start",
        middleware: [offset(4), flip(), shift()],
    })

    const filteredCountries = availableCountryNames.filter((country) =>
        country.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const selectedSet = new Set(selectedCountryNames)

    const handleToggleCountry = (countryName: string) => {
        if (selectedSet.has(countryName)) {
            setSelectedCountryNames(
                selectedCountryNames.filter((c) => c !== countryName)
            )
        } else {
            setSelectedCountryNames([...selectedCountryNames, countryName])
        }
    }

    const handleClearAll = () => {
        setSelectedCountryNames([])
    }

    // Handle click outside to close popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                buttonRef.current &&
                popoverRef.current &&
                !buttonRef.current.contains(event.target as Node) &&
                !popoverRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    useEffect(() => {
        if (buttonRef.current) {
            refs.setReference(buttonRef.current)
        }
    }, [refs])

    return (
        <>
            <div
                ref={buttonRef}
                className="search-country-selector-button"
                onClick={() => {
                    setIsOpen(true)
                    setTimeout(() => inputRef.current?.focus(), 0)
                }}
            >
                <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    className="search-country-selector__search-icon"
                />
                <input
                    ref={inputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Search and select countries"
                    className="search-country-selector-search-input"
                />
            </div>
            {isOpen && (
                <div
                    ref={(node) => {
                        popoverRef.current = node
                        refs.setFloating(node)
                    }}
                    style={{ ...floatingStyles, zIndex: 1000 }}
                    className="search-country-selector-list-container"
                >
                    {selectedCountryNames.length > 0 && (
                        <div className="search-country-selector-clear-container">
                            <button
                                onClick={handleClearAll}
                                className="search-country-selector-clear-all"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                    <ListBox
                        aria-label="Countries"
                        selectionMode="multiple"
                        className="search-country-selector-list"
                    >
                        {filteredCountries.map((country) => (
                            <ListBoxItem
                                key={country}
                                id={country}
                                textValue={country}
                                className="search-country-selector-list__item"
                                onAction={() => handleToggleCountry(country)}
                            >
                                <div className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        checked={selectedSet.has(country)}
                                        onChange={() =>
                                            handleToggleCountry(country)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <span className="country-name">{country}</span>
                            </ListBoxItem>
                        ))}
                    </ListBox>
                </div>
            )}
        </>
    )
}

export const IncomePlotCountrySelector = () => {
    return (
        <Suspense fallback={<div>Loading countries...</div>}>
            <IncomePlotCountrySelectorInner />
        </Suspense>
    )
}
