import { useAtom, useAtomValue } from "jotai"
import {
    atomAvailableCountryNames,
    atomSelectedCountryNames,
    atomRawDataForYear,
    atomCurrentCurrency,
    atomCombinedFactor,
    atomTimeInterval,
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
    faArrowUp,
    faArrowDown,
    faSort,
} from "@fortawesome/free-solid-svg-icons"
import * as React from "react"
import { formatCurrency, getTimeIntervalStr } from "../utils/incomePlotUtils.ts"

const IncomePlotCountrySelectorInner = (): React.ReactElement => {
    const availableCountryNames = useAtomValue(atomAvailableCountryNames)
    const [selectedCountryNames, setSelectedCountryNames] = useAtom(
        atomSelectedCountryNames
    )
    const [searchQuery, setSearchQuery] = useState("")

    type SortKey = "name" | "median"
    type SortDirection = "asc" | "desc"
    const [sortBy, setSortBy] = useState<SortKey>("name")
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

    const rawDataForYear = useAtomValue(atomRawDataForYear)
    const currency = useAtomValue(atomCurrentCurrency)
    const combinedFactor = useAtomValue(atomCombinedFactor)
    const timeInterval = useAtomValue(atomTimeInterval)

    const countryMedianMap = useMemo((): Map<string, string> => {
        const map = new Map<string, string>()
        for (const record of rawDataForYear) {
            const rawMedian = record.avgs[499]
            if (typeof rawMedian === "number" && !isNaN(rawMedian)) {
                const formatted = formatCurrency(
                    rawMedian * combinedFactor,
                    currency,
                    { formatShort: true }
                )
                const period = getTimeIntervalStr(timeInterval)
                map.set(record.country, `${formatted}/${period}`)
            }
        }
        return map
    }, [rawDataForYear, currency, combinedFactor, timeInterval])

    const countryNumericMedianMap = useMemo((): Map<string, number> => {
        const map = new Map<string, number>()
        for (const record of rawDataForYear) {
            const rawMedian = record.avgs[499]
            if (typeof rawMedian === "number" && !isNaN(rawMedian)) {
                map.set(record.country, rawMedian)
            }
        }
        return map
    }, [rawDataForYear])

    const filteredCountries = useMemo((): string[] => {
        return availableCountryNames.filter((country) =>
            country.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [availableCountryNames, searchQuery])

    const sortedCountries = useMemo((): string[] => {
        const list = [...filteredCountries]
        list.sort((a, b) => {
            if (sortBy === "name") {
                const cmp = a.localeCompare(b, undefined, {
                    sensitivity: "base",
                })
                return sortDirection === "asc" ? cmp : -cmp
            } else {
                const valA = countryNumericMedianMap.get(a)
                const valB = countryNumericMedianMap.get(b)

                // Handle missing values (always at the end)
                if (valA === undefined && valB === undefined) return 0
                if (valA === undefined) return 1
                if (valB === undefined) return -1

                const cmp = valA - valB
                return sortDirection === "asc" ? cmp : -cmp
            }
        })
        return list
    }, [filteredCountries, sortBy, sortDirection, countryNumericMedianMap])

    const selectedKeys = useMemo(
        (): Set<React.Key> => new Set(selectedCountryNames),
        [selectedCountryNames]
    )

    const handleSort = (key: SortKey): void => {
        if (sortBy === key) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
        } else {
            setSortBy(key)
            setSortDirection("asc")
        }
    }

    const handleSortKeyDown = (
        e: React.KeyboardEvent<HTMLSpanElement>,
        key: SortKey
    ): void => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleSort(key)
        }
    }

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

                    <div className="search-country-selector-header-row">
                        <span
                            className="search-country-selector-header-col--left"
                            role="button"
                            tabIndex={0}
                            title="Sort by Country"
                            onClick={(): void => handleSort("name")}
                            onKeyDown={(e): void =>
                                handleSortKeyDown(e, "name")
                            }
                        >
                            Country
                            <FontAwesomeIcon
                                icon={
                                    sortBy === "name"
                                        ? sortDirection === "asc"
                                            ? faArrowUp
                                            : faArrowDown
                                        : faSort
                                }
                                className={`search-country-selector-header__icon ${
                                    sortBy !== "name"
                                        ? "search-country-selector-header__icon--inactive"
                                        : ""
                                }`}
                            />
                        </span>
                        <span
                            className="search-country-selector-header-col--right"
                            role="button"
                            tabIndex={0}
                            title="Sort by Median"
                            onClick={(): void => handleSort("median")}
                            onKeyDown={(e): void =>
                                handleSortKeyDown(e, "median")
                            }
                        >
                            Median
                            <FontAwesomeIcon
                                icon={
                                    sortBy === "median"
                                        ? sortDirection === "asc"
                                            ? faArrowUp
                                            : faArrowDown
                                        : faSort
                                }
                                className={`search-country-selector-header__icon ${
                                    sortBy !== "median"
                                        ? "search-country-selector-header__icon--inactive"
                                        : ""
                                }`}
                            />
                        </span>
                    </div>

                    <ListBox
                        aria-label="Countries"
                        selectionMode="multiple"
                        className="search-country-selector-list"
                        selectedKeys={selectedKeys}
                        onSelectionChange={handleSelectionChange}
                    >
                        {sortedCountries.map((country) => (
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
                                        {countryMedianMap.has(country) && (
                                            <span className="country-median">
                                                {countryMedianMap.get(country)}
                                            </span>
                                        )}
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
