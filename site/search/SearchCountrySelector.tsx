import {
    faMapMarkerAlt,
    faClose,
    faMagnifyingGlass,
    faTimesCircle,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { LabeledSwitch } from "@ourworldindata/components"
import { countriesByName, Country } from "@ourworldindata/utils"
import { useState, useRef, useMemo } from "react"
import { useMediaQuery } from "usehooks-ts"
import {
    useFocusTrap,
    useTriggerOnEscape,
    useTriggerWhenClickOutside,
} from "../hooks.js"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import cx from "classnames"

export const SearchCountrySelector = ({
    selectedCountryNames,
    requireAllCountries,
    addCountry,
    removeCountry,
    toggleRequireAllCountries,
}: {
    selectedCountryNames: Set<string>
    requireAllCountries: boolean
    addCountry: (country: string) => void
    removeCountry: (country: string) => void
    toggleRequireAllCountries: () => void
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [countrySearchQuery, setCountrySearchQuery] = useState("")
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const countrySelectorRef = useRef<HTMLDivElement>(null)
    const listContainerRef = useRef<HTMLDivElement>(null)
    useFocusTrap(listContainerRef, isOpen)
    useTriggerOnEscape(() => setIsOpen(false))
    useTriggerWhenClickOutside(countrySelectorRef, isOpen, () =>
        setIsOpen(false)
    )
    const toggleCountry = (country: string) => {
        if (selectedCountryNames.has(country)) {
            removeCountry(country)
        } else {
            addCountry(country)
        }
    }
    const alphabetizedCountriesByName = useMemo(() => {
        return Object.values(countriesByName()).sort((a, b) => {
            return a.name.localeCompare(b.name)
        })
    }, [])

    const toggleOpen = () => {
        setIsOpen((isOpen) => !isOpen)
        // if opening on mobile, scroll down a little
        if (isSmallScreen && !isOpen) {
            setTimeout(() => {
                const listContainer = listContainerRef.current
                if (listContainer) {
                    const rect = listContainer.getBoundingClientRect()
                    window.scrollBy({
                        top: rect.top - 100,
                        behavior: "smooth",
                    })
                }
            }, 100)
        }
    }

    const filteredCountriesByName = useMemo(() => {
        return alphabetizedCountriesByName.filter(
            (country) =>
                selectedCountryNames.has(country.name) ||
                country.name
                    .toLowerCase()
                    .includes(countrySearchQuery.toLowerCase())
        )
    }, [countrySearchQuery, selectedCountryNames, alphabetizedCountriesByName])

    return (
        <div className="search-country-selector" ref={countrySelectorRef}>
            <button
                className={cx("search-country-selector-button body-3-medium", {
                    "search-country-selector-button--is-open": isOpen,
                })}
                aria-expanded={isOpen}
                aria-label={
                    isOpen ? "Close country selector" : "Open country selector"
                }
                onClick={toggleOpen}
            >
                <FontAwesomeIcon icon={faMapMarkerAlt} />
                <span className="search-country-selector-button__text">
                    Country selector
                </span>
            </button>
            {isOpen ? (
                <div
                    className="search-country-selector-list-container"
                    ref={listContainerRef}
                >
                    <div className="search-country-selector-header">
                        <h5 className="h5-black-caps search-country-selector__heading">
                            Select or search for a country
                        </h5>
                        <button
                            aria-label="Close country selector"
                            className="search-country-selector-close-button"
                            onClick={() => setIsOpen(false)}
                        >
                            <FontAwesomeIcon icon={faClose} />
                        </button>
                    </div>
                    <LabeledSwitch
                        className="search-country-selector-switch"
                        value={requireAllCountries}
                        disabled={selectedCountryNames.size === 0}
                        onToggle={toggleRequireAllCountries}
                        label="Only show charts with data for all selected countries"
                    />
                    <div className="search-country-selector-search-container">
                        <FontAwesomeIcon
                            className="search-country-selector__search-icon"
                            icon={faMagnifyingGlass}
                        />
                        <input
                            type="text"
                            placeholder="Search for a country"
                            className="search-country-selector-search-input body-3-regular"
                            value={countrySearchQuery}
                            onChange={(e) =>
                                setCountrySearchQuery(e.target.value)
                            }
                        />
                        {countrySearchQuery && (
                            <button
                                onClick={() => setCountrySearchQuery("")}
                                data-label="Clear country search"
                                className="search-country-selector__clear-button"
                            >
                                <FontAwesomeIcon icon={faTimesCircle} />
                            </button>
                        )}
                    </div>
                    <ol className="search-country-selector-list">
                        {Object.values(filteredCountriesByName).map(
                            (country: Country) => (
                                <li
                                    value={country.name}
                                    key={country.name}
                                    className={cx(
                                        "search-country-selector-list__item",
                                        {
                                            "search-country-selector-list__item--selected":
                                                selectedCountryNames.has(
                                                    country.name
                                                ),
                                        }
                                    )}
                                >
                                    <label
                                        className="body-3-medium"
                                        htmlFor={`country-${country.name}`}
                                    >
                                        <img
                                            className="flag"
                                            aria-hidden={true}
                                            height={16}
                                            width={20}
                                            src={`/images/flags/${country.code}.svg`}
                                        />
                                        {country.name}
                                    </label>
                                    <input
                                        type="checkbox"
                                        id={`country-${country.name}`}
                                        checked={selectedCountryNames.has(
                                            country.name
                                        )}
                                        onChange={() => {
                                            toggleCountry(country.name)
                                        }}
                                    />
                                </li>
                            )
                        )}
                    </ol>
                </div>
            ) : null}
        </div>
    )
}
