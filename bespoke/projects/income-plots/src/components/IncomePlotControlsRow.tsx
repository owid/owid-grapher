import { useAtom, useAtomValue } from "jotai"
import {
    atomCountriesOrRegionsMode,
    atomCurrentCurrency,
    atomCurrentTab,
    atomCurrentYear,
    atomIntDollarConversions,
    atomLocalCurrencyConversion,
    atomSelectedCountryNames,
    atomTimeInterval,
} from "../store.ts"
import { INT_DOLLAR_CONVERSION_KEY_INFO } from "../utils/incomePlotConstants.ts"
import { loadable } from "jotai/utils"
import * as R from "remeda"
import { IncomePlotCountrySelector } from "./IncomePlotCountrySelector.tsx"
import { LabeledSwitch } from "@ourworldindata/components"
import cx from "classnames"

import * as React from "react"
import { useMemo, useState } from "react"
import {
    Tabs as AriaTabs,
    TabList,
    Tab,
    Select,
    Button,
    Popover,
    ListBox,
    ListBoxItem,
    SelectValue,
    ListBoxSection,
    Header,
    Autocomplete,
    useFilter,
    SearchField,
    Input,
} from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faGlobe,
    faFlag,
    faGear,
    faChevronDown,
    faSearch,
    faX,
} from "@fortawesome/free-solid-svg-icons"
import type { IntDollarConversionKeyInfo } from "../types.ts"

const loadableConversions = loadable(atomIntDollarConversions)
const loadableLocalConversion = loadable(atomLocalCurrencyConversion)

export interface TabItem<TabKey extends string = string> {
    key: TabKey
    element: React.ReactElement
}

export const Tabs = <TabKey extends string = string>({
    items,
    selectedKey,
    onChange,
    className,
    variant = "default",
}: {
    items: TabItem<TabKey>[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    className?: string
    variant?: "default" | "slim" | "stretch" | "scroll"
}) => {
    return (
        <AriaTabs
            selectedKey={selectedKey}
            onSelectionChange={(key) => {
                if (typeof key === "string") onChange(key as TabKey)
            }}
        >
            <TabList
                className={cx("Tabs", "Tabs--variant-" + variant, className)}
            >
                {items.map((item) => (
                    <Tab
                        key={item.key}
                        id={item.key}
                        className={cx("Tabs__Tab")}
                    >
                        {item.element}
                    </Tab>
                ))}
            </TabList>
        </AriaTabs>
    )
}

export const IncomePlotControlsRowTop = ({
    isNarrow = false,
    onOpenSettings,
}: {
    isNarrow?: boolean
    onOpenSettings?: () => void
}) => {
    const [currentTab, setCurrentTab] = useAtom(atomCurrentTab)
    const [countriesOrRegionsMode, nextCountriesOrRegionsMode] = useAtom(
        atomCountriesOrRegionsMode
    )
    const selectedCountryNames = useAtomValue(atomSelectedCountryNames)

    const isGlobal = currentTab === "global"
    const isCountries = currentTab === "countries"

    return (
        <div className="income-plot-controls-top" style={{ marginBottom: 10 }}>
            <Tabs
                variant="slim"
                items={[
                    {
                        key: "global",
                        element: (
                            <span>
                                <FontAwesomeIcon icon={faGlobe} />
                                Global
                            </span>
                        ),
                    },
                    {
                        key: "countries",
                        element: (
                            <span>
                                <FontAwesomeIcon icon={faFlag} />
                                Selected countries (
                                {selectedCountryNames.length})
                            </span>
                        ),
                    },
                ]}
                selectedKey={currentTab}
                onChange={setCurrentTab}
            />
            {isNarrow && onOpenSettings && (
                <button
                    className="income-plot-drawer-trigger"
                    onClick={onOpenSettings}
                    aria-label="Open settings"
                >
                    <FontAwesomeIcon icon={faGear} />
                </button>
            )}
            {isGlobal && !isNarrow && (
                <div className="regions-countries-toggle">
                    <span
                        className={cx("toggle-label", {
                            active: countriesOrRegionsMode === "regions",
                        })}
                        onClick={() => {
                            nextCountriesOrRegionsMode("regions")
                        }}
                    >
                        Show regions
                    </span>
                    <LabeledSwitch
                        value={countriesOrRegionsMode === "countries"}
                        onToggle={() => nextCountriesOrRegionsMode()}
                    />
                    <span
                        className={cx("toggle-label", {
                            active: countriesOrRegionsMode === "countries",
                        })}
                        onClick={() => {
                            nextCountriesOrRegionsMode("countries")
                        }}
                    >
                        Show countries
                    </span>
                </div>
            )}
            {isCountries && !isNarrow && <IncomePlotCountrySelector />}
        </div>
    )
}

export const IncomePlotControlsRowBottom = () => {
    const [timeInterval, nextTimeInterval] = useAtom(atomTimeInterval)
    const [currentYear] = useAtom(atomCurrentYear)
    const [currentCurrency, setCurrency] = useAtom(atomCurrentCurrency)
    const conversionsLoadable = useAtomValue(loadableConversions)
    const localConversionLoadable = useAtomValue(loadableLocalConversion)

    const { contains } = useFilter({ sensitivity: "base" })

    const conversions =
        conversionsLoadable.state === "hasData"
            ? conversionsLoadable.data
            : undefined
    const localConversion =
        localConversionLoadable.state === "hasData"
            ? localConversionLoadable.data
            : null

    // Build sorted options list, excluding the suggested local currency
    const conversionOptions = useMemo(() => {
        if (!conversions) return []
        const sorted = R.sortBy(conversions, R.prop("country"))
        if (!localConversion) return sorted
        return sorted.filter(
            (c) => c.country_code !== localConversion.country_code
        )
    }, [conversions, localConversion])

    const selectedKey =
        currentCurrency.currency_code === "INTD"
            ? "INTD"
            : (currentCurrency.country_code ?? "INTD")

    const handleSelectionChange = (key: React.Key | null) => {
        const keyStr = String(key)
        if (keyStr === "INTD") {
            setCurrency(INT_DOLLAR_CONVERSION_KEY_INFO)
            return
        }
        const entry = conversions?.find((c) => c.country_code === keyStr)
        if (entry) {
            const info: IntDollarConversionKeyInfo = {
                currency_code: entry.currency_code,
                currency_name: entry.currency_name,
                conversion_factor: entry.conversion_factor,
                country: entry.country,
                country_code: entry.country_code,
            }
            setCurrency(info)
        }
    }

    const selectedLabel =
        currentCurrency.currency_code === "INTD"
            ? "International-$"
            : `${currentCurrency.country} (${currentCurrency.currency_name})`

    return (
        <div className="income-plot-controls-bottom">
            <button onClick={() => nextTimeInterval()} className="control-pill">
                {R.toTitleCase(timeInterval)}
            </button>
            <span className="control-text">income or consumption in</span>
            <button className="control-pill">{currentYear}</button>
            <span className="control-text">in</span>
            <Select
                className="currency-select"
                value={selectedKey}
                onChange={handleSelectionChange}
                aria-label="Currency"
            >
                <Button className="control-pill currency-select__trigger">
                    <SelectValue>{selectedLabel}</SelectValue>
                    <FontAwesomeIcon
                        icon={faChevronDown}
                        className="currency-select__chevron"
                    />
                </Button>
                <Popover className="currency-select__popover">
                    <Autocomplete filter={contains}>
                        <SearchField
                            aria-label="Search countries and currencies"
                            autoFocus
                            className="currency-select__search"
                        >
                            <FontAwesomeIcon
                                icon={faSearch}
                                className="currency-select__search-icon"
                            />
                            <Input
                                placeholder={"Search countries and currencies"}
                                className="react-aria-Input inset"
                            />
                            <Button className="clear-button">
                                <FontAwesomeIcon
                                    icon={faX}
                                    className="currency-select__clear-icon"
                                />
                            </Button>
                        </SearchField>
                        <ListBox className="currency-select__listbox">
                            <ListBoxItem
                                id="INTD"
                                textValue="International Dollar"
                                className="currency-select__item"
                            >
                                International-$
                            </ListBoxItem>
                            {localConversion && (
                                <ListBoxSection>
                                    <Header className="currency-select__section-header">
                                        Suggested
                                    </Header>
                                    <ListBoxItem
                                        id={localConversion.country_code}
                                        textValue={`${localConversion.country} ${localConversion.currency_name}`}
                                        className="currency-select__item"
                                    >
                                        {localConversion.country} (
                                        {localConversion.currency_name})
                                    </ListBoxItem>
                                </ListBoxSection>
                            )}
                            <ListBoxSection>
                                <Header className="currency-select__section-header">
                                    All countries
                                </Header>
                                {conversionOptions.map((c) => (
                                    <ListBoxItem
                                        key={c.country_code}
                                        id={c.country_code}
                                        textValue={`${c.country} ${c.currency_name}`}
                                        className="currency-select__item"
                                    >
                                        {c.country} ({c.currency_name})
                                    </ListBoxItem>
                                ))}
                            </ListBoxSection>
                        </ListBox>
                    </Autocomplete>
                </Popover>
            </Select>
        </div>
    )
}
