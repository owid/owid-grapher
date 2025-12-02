import {
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
    Pressable,
} from "react-aria-components"
import cx from "classnames"
import { useAtom, useAtomValue } from "jotai"
import {
    atomAvailableCountryNames,
    atomSelectedCountryNames,
} from "../store.ts"
import { Checkbox } from "@ourworldindata/components"

export const IncomePlotCountrySelector = () => {
    const [countrySearchQuery, setCountrySearchQuery] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const triggerRef = useRef<HTMLDivElement>(null)
    const [selectedCountryNames, setSelectedCountryNames] = useAtom(
        atomSelectedCountryNames
    )
    const availableCountryNames = useAtomValue(atomAvailableCountryNames)

    const toggleCountry = (country: string) => {
        if (selectedCountryNames.includes(country)) {
            setSelectedCountryNames(
                selectedCountryNames.filter((name) => name !== country)
            )
        } else {
            setSelectedCountryNames([...(selectedCountryNames ?? []), country])
        }
    }

    const filteredCountriesByName = useMemo(() => {
        return availableCountryNames.filter(
            (country) =>
                selectedCountryNames?.includes(country) ||
                country.toLowerCase().includes(countrySearchQuery.toLowerCase())
        )
    }, [countrySearchQuery, selectedCountryNames, availableCountryNames])

    return (
        <div className="search-country-selector">
            <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
                <Pressable>
                    <div
                        className="search-country-selector-button"
                        role="button"
                    >
                        <FontAwesomeIcon
                            className="search-country-selector__search-icon"
                            icon={faMagnifyingGlass}
                        />
                        <input
                            type="text"
                            placeholder="Search and select countries"
                            className="search-country-selector-search-input body-3-regular"
                            value={countrySearchQuery}
                            onChange={(e) => {
                                setCountrySearchQuery(e.target.value)
                                setIsOpen(true)
                            }}
                            onFocus={() => setIsOpen(true)}
                            onClick={() => setIsOpen(true)}
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
                </Pressable>
                <Popover
                    className="search-country-selector-list-container"
                    placement="bottom start"
                    isNonModal
                >
                    {selectedCountryNames.length > 0 && (
                        <div className="search-country-selector-clear-container">
                            <Button
                                onPress={() => setSelectedCountryNames([])}
                                className="search-country-selector-clear-all"
                            >
                                Clear selection
                            </Button>
                        </div>
                    )}
                    <ListBox
                        className="search-country-selector-list"
                        aria-label="Countries"
                        selectionMode="multiple"
                        selectedKeys={selectedCountryNames}
                        onSelectionChange={(keys) => {
                            if (keys !== "all") {
                                setSelectedCountryNames(
                                    Array.from(keys) as string[]
                                )
                            }
                        }}
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
                            >
                                <div className="checkbox-container">
                                    <Checkbox
                                        label=""
                                        checked={selectedCountryNames.includes(
                                            country
                                        )}
                                        onChange={() => void 0}
                                    />
                                </div>
                                <span className="country-name">{country}</span>
                            </ListBoxItem>
                        ))}
                    </ListBox>
                </Popover>
            </DialogTrigger>
        </div>
    )
}
