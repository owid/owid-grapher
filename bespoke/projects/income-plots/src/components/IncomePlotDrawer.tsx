import { useAtom, useAtomValue } from "jotai"
import {
    atomTimeInterval,
    atomCurrentCurrency,
    atomCountriesOrRegionsMode,
    atomCurrentTab,
    atomAvailableCountryNames,
    atomSelectedCountryNames,
    loadableLocalCurrencyConversion,
} from "../store.ts"
import {
    INT_DOLLAR_CONVERSION_KEY_INFO,
    TIME_INTERVALS,
    TimeInterval,
} from "../utils/incomePlotConstants.ts"
import { Suspense, useMemo, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons"

interface IncomePlotDrawerProps {
    isOpen: boolean
    onClose: () => void
}

const TIME_INTERVAL_LABELS: Record<TimeInterval, string> = {
    daily: "Daily",
    monthly: "Monthly",
    yearly: "Yearly",
}

const MODE_OPTIONS = [
    { value: "regions" as const, label: "Show regions" },
    { value: "countries" as const, label: "Show countries" },
]

function DrawerCountrySelectorInner() {
    const availableCountryNames = useAtomValue(atomAvailableCountryNames)
    const [selectedCountryNames, setSelectedCountryNames] = useAtom(
        atomSelectedCountryNames
    )
    const [searchQuery, setSearchQuery] = useState("")

    const selectedSet = useMemo(
        () => new Set(selectedCountryNames),
        [selectedCountryNames]
    )

    const filteredCountries = useMemo(() => {
        if (!searchQuery) return availableCountryNames
        const query = searchQuery.toLowerCase()
        return availableCountryNames.filter((c) =>
            c.toLowerCase().includes(query)
        )
    }, [availableCountryNames, searchQuery])

    const handleToggleCountry = (countryName: string) => {
        if (selectedSet.has(countryName)) {
            setSelectedCountryNames(
                selectedCountryNames.filter((c) => c !== countryName)
            )
        } else {
            setSelectedCountryNames([...selectedCountryNames, countryName])
        }
    }

    return (
        <div className="drawer-country-selector">
            <div className="drawer-country-selector__search">
                <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    className="drawer-country-selector__search-icon"
                />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search and select countries"
                    className="drawer-country-selector__search-input"
                />
            </div>
            <div className="drawer-country-selector__list">
                {filteredCountries.map((country) => (
                    <label
                        key={country}
                        className="drawer-country-selector__item"
                    >
                        <input
                            type="checkbox"
                            checked={selectedSet.has(country)}
                            onChange={() => handleToggleCountry(country)}
                            className="drawer-country-selector__checkbox"
                        />
                        <span className="drawer-country-selector__country-name">
                            {country}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    )
}

function DrawerCountrySelector() {
    return (
        <Suspense>
            <DrawerCountrySelectorInner />
        </Suspense>
    )
}

export function IncomePlotDrawer({ isOpen, onClose }: IncomePlotDrawerProps) {
    const [timeInterval, setTimeInterval] = useAtom(atomTimeInterval)
    const [currency, setCurrency] = useAtom(atomCurrentCurrency)
    const [mode, setMode] = useAtom(atomCountriesOrRegionsMode)
    const currentTab = useAtomValue(atomCurrentTab)
    const localConversionLoadable = useAtomValue(
        loadableLocalCurrencyConversion
    )
    const localConversion =
        localConversionLoadable.state === "hasData"
            ? localConversionLoadable.data
            : null

    return (
        <>
            <div
                className={`income-plot-drawer-backdrop${isOpen ? " income-plot-drawer-backdrop--open" : ""}`}
                onClick={onClose}
            />
            <div
                className={`income-plot-drawer${isOpen ? " income-plot-drawer--open" : ""}`}
            >
                <div className="income-plot-drawer__header">
                    <span className="income-plot-drawer__title">Settings</span>
                    <button
                        className="income-plot-drawer__close"
                        onClick={onClose}
                        aria-label="Close settings"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="income-plot-drawer__sections">
                    <div className="income-plot-drawer__section">
                        <div className="income-plot-drawer__section-label">
                            Time interval
                        </div>
                        <div className="income-plot-drawer__button-group">
                            {TIME_INTERVALS.map((interval) => (
                                <button
                                    key={interval}
                                    className={`income-plot-drawer__button${timeInterval === interval ? " income-plot-drawer__button--active" : ""}`}
                                    onClick={() => setTimeInterval(interval)}
                                >
                                    {TIME_INTERVAL_LABELS[interval]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="income-plot-drawer__divider" />

                    <div className="income-plot-drawer__section">
                        <div className="income-plot-drawer__section-label">
                            Currency
                        </div>
                        <div className="income-plot-drawer__button-group">
                            <button
                                className={`income-plot-drawer__button${currency.currency_code === "INTD" ? " income-plot-drawer__button--active" : ""}`}
                                onClick={() =>
                                    setCurrency(INT_DOLLAR_CONVERSION_KEY_INFO)
                                }
                            >
                                International-$
                            </button>
                            <button
                                className={`income-plot-drawer__button${currency.currency_code !== "INTD" ? " income-plot-drawer__button--active" : ""}`}
                                onClick={() =>
                                    localConversion &&
                                    setCurrency(localConversion)
                                }
                                disabled={!localConversion}
                            >
                                {localConversion
                                    ? `${localConversion.currency_name} (${localConversion.country})`
                                    : "Local currency"}
                            </button>
                        </div>
                    </div>

                    <div className="income-plot-drawer__divider" />

                    {currentTab === "global" && (
                        <div className="income-plot-drawer__section">
                            <div className="income-plot-drawer__section-label">
                                Chart options
                            </div>
                            <div className="income-plot-drawer__button-group">
                                {MODE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        className={`income-plot-drawer__button${mode === opt.value ? " income-plot-drawer__button--active" : ""}`}
                                        onClick={() => setMode(opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentTab === "countries" && <DrawerCountrySelector />}
                </div>
            </div>
        </>
    )
}
