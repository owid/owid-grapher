import {
    faMapMarkerAlt,
    faClose,
    faMagnifyingGlass,
    faTimesCircle,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { LabeledSwitch } from "@ourworldindata/components"
import { countriesByName } from "@ourworldindata/utils"
import { useState, useRef, useMemo } from "react"
import {
    Button,
    Popover,
    ListBox,
    ListBoxItem,
    DialogTrigger,
} from "react-aria-components"
import { useMediaQuery } from "usehooks-ts"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import cx from "classnames"

const alphabetizedCountriesByName = Object.values(countriesByName()).sort(
    (a, b) => {
        return a.name.localeCompare(b.name)
    }
)

export const SearchCountrySelector = ({
    selectedRegionNames,
    requireAllCountries,
    addCountry,
    removeCountry,
    toggleRequireAllCountries,
}: {
    selectedRegionNames: string[]
    requireAllCountries: boolean
    addCountry: (country: string) => void
    removeCountry: (country: string) => void
    toggleRequireAllCountries: () => void
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [countrySearchQuery, setCountrySearchQuery] = useState("")
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const listContainerRef = useRef<HTMLDivElement>(null)

    const toggleCountry = (country: string) => {
        if (selectedRegionNames.includes(country)) {
            removeCountry(country)
        } else {
            addCountry(country)
        }
    }

    const handleOpenChange = (isOpen: boolean) => {
        setIsOpen(isOpen)
        // if opening on mobile, scroll down a little
        if (isSmallScreen && isOpen) {
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
                selectedRegionNames.includes(country.name) ||
                country.name
                    .toLowerCase()
                    .includes(countrySearchQuery.toLowerCase())
        )
    }, [countrySearchQuery, selectedRegionNames])

    return (
        <div className="search-country-selector">
            <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
                <Button
                    className={cx("search-country-selector-button", {
                        "search-country-selector-button--is-open": isOpen,
                    })}
                    aria-expanded={isOpen}
                    aria-label={
                        isOpen
                            ? "Close country selector"
                            : "Open country selector"
                    }
                >
                    <FontAwesomeIcon
                        className="search-country-selector-button__icon"
                        icon={faMapMarkerAlt}
                    />
                    <span className="search-country-selector-button__text">
                        Select country
                    </span>
                </Button>
                <Popover
                    className="search-country-selector-list-container"
                    ref={listContainerRef}
                    placement="bottom end"
                    crossOffset={8}
                >
                    <div className="search-country-selector-header">
                        <h5 className="h5-black-caps search-country-selector__heading">
                            Select or search for a country
                        </h5>
                        <Button
                            aria-label="Close country selector"
                            className="search-country-selector-close-button"
                            onPress={() => setIsOpen(false)}
                        >
                            <FontAwesomeIcon icon={faClose} />
                        </Button>
                    </div>
                    <LabeledSwitch
                        className="search-country-selector-switch"
                        value={requireAllCountries}
                        disabled={selectedRegionNames.length === 0}
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
                            <Button
                                onPress={() => setCountrySearchQuery("")}
                                aria-label="Clear country search"
                                className="search-country-selector__clear-button"
                            >
                                <FontAwesomeIcon icon={faTimesCircle} />
                            </Button>
                        )}
                    </div>
                    <ListBox
                        className="search-country-selector-list"
                        aria-label="Countries"
                    >
                        {filteredCountriesByName.map((country) => (
                            <ListBoxItem
                                key={country.name}
                                id={country.name}
                                className={cx(
                                    "search-country-selector-list__item",
                                    {
                                        "search-country-selector-list__item--selected":
                                            selectedRegionNames.includes(
                                                country.name
                                            ),
                                    }
                                )}
                                textValue={country.name}
                                onAction={() => toggleCountry(country.name)}
                            >
                                <img
                                    className="flag"
                                    role="presentation"
                                    alt=""
                                    height={16}
                                    width={20}
                                    src={`/images/flags/${country.code}.svg`}
                                />
                                {country.name}
                                <input
                                    type="checkbox"
                                    checked={selectedRegionNames.includes(
                                        country.name
                                    )}
                                    readOnly
                                />
                            </ListBoxItem>
                        ))}
                    </ListBox>
                </Popover>
            </DialogTrigger>
        </div>
    )
}
