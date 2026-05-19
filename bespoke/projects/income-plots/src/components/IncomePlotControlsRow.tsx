import { useAtom, useAtomValue } from "jotai"
import {
    atomCountriesOrRegionsMode,
    atomCurrentCurrency,
    atomCurrentTab,
    atomCurrentYear,
    atomSelectedCountryNames,
    atomTimeInterval,
    loadableIntDollarConversions,
    loadableLocalCurrencyConversion,
} from "../store.ts"
import { INT_DOLLAR_CONVERSION_KEY_INFO } from "../utils/incomePlotConstants.ts"
import * as R from "remeda"
import { IncomePlotCountrySelector } from "./IncomePlotCountrySelector.tsx"
import { LabeledSwitch } from "./LabeledSwitch.tsx"
import cx from "classnames"

import * as React from "react"
import { useMemo } from "react"
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
    SelectStateContext,
    ListStateContext,
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
import type {
    IntDollarConversionEntry,
    IntDollarConversionKeyInfo,
} from "../types.ts"

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
                <LabeledSwitch
                    value={countriesOrRegionsMode === "countries"}
                    onToggle={() => nextCountriesOrRegionsMode()}
                    leftLabel="Show regions"
                    rightLabel="Show countries"
                />
            )}
            {isCountries && !isNarrow && <IncomePlotCountrySelector />}
        </div>
    )
}

export const IncomePlotControlsRowBottom = () => {
    const [timeInterval, nextTimeInterval] = useAtom(atomTimeInterval)
    const currentYear = useAtomValue(atomCurrentYear)
    const [currentCurrency, setCurrency] = useAtom(atomCurrentCurrency)
    const conversionsLoadable = useAtomValue(loadableIntDollarConversions)
    const localConversionLoadable = useAtomValue(
        loadableLocalCurrencyConversion
    )

    const { contains } = useFilter({ sensitivity: "base" })

    const conversions =
        conversionsLoadable.state === "hasData"
            ? conversionsLoadable.data
            : undefined
    const isLoadingConversions = conversionsLoadable.state === "loading"
    const hasConversionError =
        conversionsLoadable.state === "hasError" ||
        (conversionsLoadable.state === "hasData" &&
            conversionsLoadable.data === undefined)
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
        if (key === null) return

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

    const handleCurrencySearchSubmit = (
        focusedKey: React.Key | null
    ): boolean => {
        if (focusedKey === null) return false

        handleSelectionChange(focusedKey)
        return true
    }

    const selectedLabel =
        currentCurrency.currency_code === "INTD"
            ? "International-$"
            : `${currentCurrency.country} (${currentCurrency.currency_code})`

    return (
        <div className="income-plot-controls-bottom">
            <button onClick={() => nextTimeInterval()} className="control-pill">
                {R.toTitleCase(timeInterval)}
            </button>
            <span className="control-text">
                income or consumption in {currentYear} in
            </span>
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
                    <Autocomplete
                        filter={contains}
                        disableAutoFocusFirst={false}
                    >
                        <CurrencySearchField
                            onSubmit={handleCurrencySearchSubmit}
                        />
                        <ListBox
                            className="currency-select__listbox"
                            onAction={handleSelectionChange}
                            renderEmptyState={() => (
                                <div className="currency-select__empty">
                                    No countries or currencies match your
                                    search.
                                </div>
                            )}
                        >
                            <ListBoxItem
                                id="INTD"
                                textValue="International Dollar INTD International-$"
                                className="currency-select__item"
                            >
                                <b>International dollar</b>
                            </ListBoxItem>
                            {localConversion && (
                                <ListBoxSection>
                                    <Header className="currency-select__section-header">
                                        Suggested
                                    </Header>
                                    <ListBoxItem
                                        id={localConversion.country_code}
                                        textValue={getCurrencySearchText(
                                            localConversion
                                        )}
                                        className="currency-select__item"
                                    >
                                        <CurrencyOption
                                            country={localConversion.country}
                                            currencyName={
                                                localConversion.currency_name
                                            }
                                            currencyCode={
                                                localConversion.currency_code
                                            }
                                        />
                                    </ListBoxItem>
                                </ListBoxSection>
                            )}
                            {isLoadingConversions && (
                                <ListBoxItem
                                    id="loading-currencies"
                                    isDisabled
                                    className="currency-select__item currency-select__item--status"
                                >
                                    Loading local currencies...
                                </ListBoxItem>
                            )}
                            {hasConversionError && (
                                <ListBoxItem
                                    id="currency-error"
                                    isDisabled
                                    className="currency-select__item currency-select__item--status"
                                >
                                    Could not load local currencies.
                                </ListBoxItem>
                            )}
                            {conversionOptions.length > 0 && (
                                <ListBoxSection>
                                    <Header className="currency-select__section-header">
                                        All countries
                                    </Header>
                                    {conversionOptions.map((c) => (
                                        <ListBoxItem
                                            key={c.country_code}
                                            id={c.country_code}
                                            textValue={getCurrencySearchText(c)}
                                            className="currency-select__item"
                                        >
                                            <CurrencyOption
                                                country={c.country}
                                                currencyName={c.currency_name}
                                                currencyCode={c.currency_code}
                                            />
                                        </ListBoxItem>
                                    ))}
                                </ListBoxSection>
                            )}
                        </ListBox>
                    </Autocomplete>
                </Popover>
            </Select>
        </div>
    )
}

const getCurrencySearchText = (entry: IntDollarConversionEntry): string => {
    return [
        entry.country,
        entry.country_code,
        entry.currency_name,
        entry.currency_code,
    ].join(" ")
}

const CurrencySearchField = ({
    onSubmit,
}: {
    onSubmit: (focusedKey: React.Key | null) => boolean
}): React.ReactElement => {
    const selectState = React.useContext(SelectStateContext)
    const listState = React.useContext(ListStateContext)

    return (
        <SearchField
            aria-label="Search countries and currencies"
            autoFocus
            className="currency-select__search"
            onSubmit={() => {
                const didSelect = onSubmit(
                    listState?.selectionManager.focusedKey ?? null
                )
                if (didSelect) selectState?.close()
            }}
        >
            <FontAwesomeIcon
                icon={faSearch}
                className="currency-select__search-icon"
            />
            <Input
                placeholder="Search country or currency"
                className="react-aria-Input inset"
            />
            <Button className="clear-button">
                <FontAwesomeIcon
                    icon={faX}
                    className="currency-select__clear-icon"
                />
            </Button>
        </SearchField>
    )
}

const CurrencyOption = ({
    country,
    currencyName,
    currencyCode,
}: {
    country: string
    currencyName: string
    currencyCode: string
}): React.ReactElement => {
    return (
        <span className="currency-select__option">
            <span className="currency-select__option-country">{country}</span>
            <span className="currency-select__option-currency">
                {currencyName}
                <span className="currency-select__option-code">
                    {currencyCode}
                </span>
            </span>
        </span>
    )
}
