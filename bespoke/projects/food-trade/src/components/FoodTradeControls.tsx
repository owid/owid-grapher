import { useCallback, useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faArrowRightArrowLeft,
} from "@fortawesome/free-solid-svg-icons"

import { BasicDropdownOption } from "@ourworldindata/grapher"

import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import { groupByUserLocation } from "../../../../components/EntityDropdown/EntityDropdown.js"
import {
    type DropdownCollection,
    InlineLabeledDropdown,
} from "../../../../components/InlineLabeledDropdown/InlineLabeledDropdown.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"

import { ALL_COUNTRIES, isAllCountry } from "../constants.js"
import { TradeFlow } from "../config.js"
import { FoodTradeMetadata } from "../data.js"

const TRADE_FLOW_ITEMS: SwitcherItem<TradeFlow>[] = [
    {
        key: "imports",
        element: (
            <>
                <FontAwesomeIcon icon={faArrowRight} size="sm" aria-hidden />
                Imports
            </>
        ),
    },
    {
        key: "exports",
        element: (
            <>
                Exports
                <FontAwesomeIcon icon={faArrowRight} size="sm" aria-hidden />
            </>
        ),
    },
    {
        key: "both",
        element: (
            <>
                <FontAwesomeIcon
                    icon={faArrowRightArrowLeft}
                    size="sm"
                    aria-hidden
                />
                Both
            </>
        ),
    },
]

export function FoodTradeControls({
    metadata,
    products,
    countries,
    product,
    country,
    view,
    viewDisabled,
    setProduct,
    setCountry,
    setView,
}: {
    metadata: FoodTradeMetadata
    products: string[]
    countries: string[]
    product: string
    country: string
    view: TradeFlow
    /** Visually disables the trade-flow radios. Set when the current
     * country-product combination only has data in one direction (or
     * when on All countries), so the radios reflect "doesn't apply
     * here" rather than letting the user pick a half with no data. */
    viewDisabled?: boolean
    setProduct: (value: string) => void
    setCountry: (value: string) => void
    setView: (value: TradeFlow) => void
}): React.ReactElement {
    // Sort products the selected country doesn't trade to the bottom of
    // the menu, annotated with "No data" — still selectable, just
    // de-emphasized. Bilateral mode (country === ALL_COUNTRIES) imposes
    // no country filter, so every product is treated as traded.
    const { productOptions, productNoDataSet } = useMemo(() => {
        const traded: BasicDropdownOption[] = []
        const untraded: BasicDropdownOption[] = []
        for (const p of products) {
            const option = { value: p, label: p }
            if (isAllCountry(country) || metadata.tradesProduct(country, p)) {
                traded.push(option)
            } else {
                untraded.push(option)
            }
        }
        const options: DropdownCollection = [...traded, ...untraded]
        return {
            productOptions: options,
            productNoDataSet: new Set(untraded.map((o) => o.value)),
        }
    }, [products, country, metadata])

    const { data: userCountryInfo } = useUserCountryInformation()

    // Build the country options. The Suggested group at the top surfaces
    // "All countries" plus the user's home country and continental
    // regions. Countries that don't trade the selected product are
    // sorted to the bottom of the main list and annotated with "No data".
    const { countryOptions, countryNoDataSet } = useMemo(() => {
        const trading: BasicDropdownOption[] = []
        const untraded: BasicDropdownOption[] = []
        for (const c of countries) {
            const option = { value: c, label: c }
            if (c === ALL_COUNTRIES || metadata.tradesProduct(c, product)) {
                trading.push(option)
            } else {
                untraded.push(option)
            }
        }
        const grouped = groupByUserLocation(trading, userCountryInfo, [
            ALL_COUNTRIES,
        ])
        const noDataSet = new Set(untraded.map((o) => o.value))
        if (untraded.length === 0) {
            return { countryOptions: grouped, countryNoDataSet: noDataSet }
        }
        // groupByUserLocation returns either a flat array of options or
        // [Suggested, All countries and regions]. Append untraded to the
        // tail of the rest-of-the-world group, or to the flat list.
        const last = grouped[grouped.length - 1]
        if (last && "options" in last) {
            const merged = [
                ...grouped.slice(0, -1),
                { ...last, options: [...last.options, ...untraded] },
            ]
            return { countryOptions: merged, countryNoDataSet: noDataSet }
        }
        return {
            countryOptions: [...grouped, ...untraded],
            countryNoDataSet: noDataSet,
        }
    }, [countries, product, metadata, userCountryInfo])

    const renderProductOption = useCallback(
        (option: BasicDropdownOption) =>
            renderOptionWithNoData(option, productNoDataSet),
        [productNoDataSet]
    )
    const renderCountryOption = useCallback(
        (option: BasicDropdownOption) =>
            renderOptionWithNoData(option, countryNoDataSet),
        [countryNoDataSet]
    )

    return (
        <div className="food-trade-controls">
            <h3 className="food-trade-controls__title">Configure the data</h3>
            <div className="food-trade-controls__content">
                <div className="food-trade-controls__row">
                    <InlineLabeledDropdown
                        label="Product"
                        options={productOptions}
                        selectedValue={product}
                        onChange={setProduct}
                        placeholder="Select a product…"
                        aria-label="Select a product"
                        isSearchable
                        menuClassName="food-trade-controls__menu"
                        renderMenuOption={renderProductOption}
                    />
                    <InlineLabeledDropdown
                        label="Country"
                        options={countryOptions}
                        selectedValue={country}
                        onChange={setCountry}
                        placeholder="Select a country…"
                        aria-label="Select a country"
                        isSearchable
                        menuClassName="food-trade-controls__menu"
                        renderMenuOption={renderCountryOption}
                    />
                    <Switcher
                        items={TRADE_FLOW_ITEMS}
                        selectedKey={view}
                        onChange={setView}
                        isDisabled={viewDisabled}
                        aria-label="Trade flow"
                    />
                </div>
            </div>
        </div>
    )
}

function renderOptionWithNoData(
    option: BasicDropdownOption,
    noDataSet: Set<string>
): React.ReactNode {
    if (!noDataSet.has(option.value)) return option.label
    return (
        <>
            <span className="food-trade-controls__option-label">
                {option.label}
            </span>
            <span className="food-trade-controls__option-no-data">No data</span>
        </>
    )
}
