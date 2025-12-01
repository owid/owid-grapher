import {
    faMapMarkerAlt,
    faClose,
    faMagnifyingGlass,
    faTimesCircle,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useState, useRef, useMemo } from "react"
import {
    Button,
    Popover,
    ListBox,
    ListBoxItem,
    DialogTrigger,
    SearchField,
    Input,
} from "react-aria-components"
import cx from "classnames"
import { useAtom, useAtomValue } from "jotai"
import {
    atomAvailableCountryNames,
    atomSelectedCountryNames,
} from "../store.ts"

export const IncomePlotCountrySelector = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [countrySearchQuery, setCountrySearchQuery] = useState("")
    const listContainerRef = useRef<HTMLDivElement>(null)
    const [selectedCountryNames, setSelectedCountryNames] = useAtom(
        atomSelectedCountryNames
    )
    const availableCountryNames = useAtomValue(atomAvailableCountryNames)

    const toggleCountry = (country: string) => {
        if (selectedCountryNames.includes(country)) {
            setSelectedCountryNames((names) =>
                names.filter((name) => name !== country)
            )
        } else {
            setSelectedCountryNames((names) => [...names, country])
        }
    }

    const handleOpenChange = (isOpen: boolean) => setIsOpen(isOpen)

    const filteredCountriesByName = useMemo(() => {
        return availableCountryNames.filter(
            (country) =>
                selectedCountryNames.includes(country) ||
                country.toLowerCase().includes(countrySearchQuery.toLowerCase())
        )
    }, [countrySearchQuery, selectedCountryNames, availableCountryNames])

    return (
        <div className="search-country-selector">
            <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
                <div>
                    <Button>
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
                    </Button>
                </div>
                <Popover
                    className="search-country-selector-list-container"
                    ref={listContainerRef}
                    placement="bottom end"
                    crossOffset={8}
                >
                    <div className="search-country-selector-search-container">
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
                                key={country}
                                id={country}
                                className={cx(
                                    "search-country-selector-list__item",
                                    {
                                        "search-country-selector-list__item--selected":
                                            selectedCountryNames.includes(
                                                country
                                            ),
                                    }
                                )}
                                textValue={country}
                                onAction={() => toggleCountry(country)}
                            >
                                {country}
                                <input
                                    type="checkbox"
                                    checked={selectedCountryNames.includes(
                                        country
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
