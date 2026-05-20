import { useAtom, useAtomValue } from "jotai"
import {
    atomAvailableCountryNames,
    atomSelectedCountryNames,
} from "../store.ts"
import { Suspense, useMemo, useState } from "react"
import {
    Button,
    Dialog,
    DialogTrigger,
    Input,
    ListBox,
    ListBoxItem,
    Popover,
    SearchField,
} from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faMagnifyingGlass,
    faChevronDown,
    faXmark,
    faCheck,
} from "@fortawesome/free-solid-svg-icons"
import * as React from "react"

const IncomePlotCountrySelectorInner = (): React.ReactElement => {
    const availableCountryNames = useAtomValue(atomAvailableCountryNames)
    const [selectedCountryNames, setSelectedCountryNames] = useAtom(
        atomSelectedCountryNames
    )
    const [searchQuery, setSearchQuery] = useState("")

    const filteredCountries = useMemo((): string[] => {
        return availableCountryNames.filter((country) =>
            country.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [availableCountryNames, searchQuery])

    const selectedKeys = useMemo(
        (): Set<React.Key> => new Set(selectedCountryNames),
        [selectedCountryNames]
    )

    const handleSelectionChange = (keys: "all" | Set<React.Key>): void => {
        if (keys !== "all") {
            const newSelected = Array.from(keys) as string[]
            setSelectedCountryNames(newSelected)
        }
    }

    const handleClearAll = (): void => {
        setSelectedCountryNames([])
    }

    const triggerLabel =
        selectedCountryNames.length > 0
            ? selectedCountryNames.length === 1
                ? "1 country selected"
                : `${selectedCountryNames.length} countries selected`
            : "Search and select countries"

    return (
        <DialogTrigger>
            <Button className="search-country-selector-button">
                <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    className="search-country-selector__search-icon"
                />
                <span className="search-country-selector-label">
                    {triggerLabel}
                </span>
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className="search-country-selector__chevron"
                />
            </Button>
            <Popover
                className="search-country-selector-list-container"
                placement="bottom start"
                onOpenChange={(isOpen: boolean): void => {
                    if (!isOpen) setSearchQuery("")
                }}
            >
                <Dialog className="search-country-selector-dialog">
                    <SearchField
                        aria-label="Search countries"
                        className="search-country-selector-search"
                        value={searchQuery}
                        onChange={setSearchQuery}
                        autoFocus
                    >
                        <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className="search-country-selector-search__icon"
                        />
                        <Input
                            placeholder="Search..."
                            className="react-aria-Input search-country-selector-search__input"
                        />
                        {searchQuery && (
                            <Button
                                className="clear-button search-country-selector-search__clear"
                                onClick={(): void => setSearchQuery("")}
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </Button>
                        )}
                    </SearchField>

                    <div className="search-country-selector-clear-container">
                        <button
                            onClick={handleClearAll}
                            className="search-country-selector-clear-all"
                            disabled={selectedCountryNames.length === 0}
                        >
                            Clear all
                        </button>
                    </div>

                    <ListBox
                        aria-label="Countries"
                        selectionMode="multiple"
                        className="search-country-selector-list"
                        selectedKeys={selectedKeys}
                        onSelectionChange={handleSelectionChange}
                    >
                        {filteredCountries.map((country) => (
                            <ListBoxItem
                                key={country}
                                id={country}
                                textValue={country}
                                className="search-country-selector-list__item"
                            >
                                {({ isSelected }): React.ReactElement => (
                                    <>
                                        <div className="checkbox-container">
                                            <div
                                                className={`search-country-selector-checkbox ${
                                                    isSelected ? "checked" : ""
                                                }`}
                                            >
                                                {isSelected && (
                                                    <FontAwesomeIcon
                                                        icon={faCheck}
                                                        style={{
                                                            fontSize: "10px",
                                                            color: "white",
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <span className="country-name">
                                            {country}
                                        </span>
                                    </>
                                )}
                            </ListBoxItem>
                        ))}
                    </ListBox>
                </Dialog>
            </Popover>
        </DialogTrigger>
    )
}

export const IncomePlotCountrySelector = (): React.ReactElement => {
    return (
        <Suspense fallback={<div>Loading countries...</div>}>
            <IncomePlotCountrySelectorInner />
        </Suspense>
    )
}
