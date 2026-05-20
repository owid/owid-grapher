import { useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faArrowRightArrowLeft,
} from "@fortawesome/free-solid-svg-icons"

import { articulateEntity } from "@ourworldindata/utils"
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
import { TradeRow } from "../data.js"

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
    data,
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
    data: TradeRow[]
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
    // Build two indexes used to surface dropdown options that can't yield
    // any trade flow given the other dropdown's current selection.
    const tradeIndex = useMemo(() => {
        const productsByCountry = new Map<string, Set<string>>()
        const countriesByProduct = new Map<string, Set<string>>()
        for (const row of data) {
            for (const c of [row.exporter, row.importer]) {
                let ps = productsByCountry.get(c)
                if (!ps) {
                    ps = new Set()
                    productsByCountry.set(c, ps)
                }
                ps.add(row.item)
            }
            let cs = countriesByProduct.get(row.item)
            if (!cs) {
                cs = new Set()
                countriesByProduct.set(row.item, cs)
            }
            cs.add(row.exporter)
            cs.add(row.importer)
        }
        return { productsByCountry, countriesByProduct }
    }, [data])

    // Move products the selected country doesn't trade into a group at
    // the bottom of the menu — still selectable, just de-emphasized.
    // Bilateral mode (country === ALL_COUNTRIES) imposes no country
    // filter, so every product stays in the main list.
    const productOptions = useMemo<DropdownCollection>(() => {
        const tradedByCountry = isAllCountry(country)
            ? undefined
            : tradeIndex.productsByCountry.get(country)
        const traded: BasicDropdownOption[] = []
        const untraded: BasicDropdownOption[] = []
        for (const p of products) {
            const option = { value: p, label: p }
            if (!tradedByCountry || tradedByCountry.has(p)) traded.push(option)
            else untraded.push(option)
        }
        if (untraded.length === 0) return traded
        return [
            ...traded,
            {
                label: `Not traded by ${articulateEntity(country)}`,
                options: untraded,
            },
        ]
    }, [products, country, tradeIndex])

    const { data: userCountryInfo } = useUserCountryInformation()

    // Build the country options. The Suggested group at the top surfaces
    // "All countries" plus the user's home country and continental
    // regions; countries that don't trade the selected product fall into
    // an extra "not traded by" group at the bottom — still selectable,
    // just de-emphasized.
    const countryOptions = useMemo<DropdownCollection>(() => {
        const tradingThisProduct = tradeIndex.countriesByProduct.get(product)
        const trading: BasicDropdownOption[] = []
        const untraded: BasicDropdownOption[] = []
        for (const c of countries) {
            const option = { value: c, label: c }
            if (
                c === ALL_COUNTRIES ||
                !tradingThisProduct ||
                tradingThisProduct.has(c)
            ) {
                trading.push(option)
            } else {
                untraded.push(option)
            }
        }
        const grouped = groupByUserLocation(trading, userCountryInfo, [
            ALL_COUNTRIES,
        ])
        if (untraded.length === 0) return grouped
        return [
            ...grouped,
            { label: `${product} not traded by`, options: untraded },
        ]
    }, [countries, product, tradeIndex, userCountryInfo])

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
                    />
                    <InlineLabeledDropdown
                        label="Country"
                        options={countryOptions}
                        selectedValue={country}
                        onChange={setCountry}
                        placeholder="Select a country…"
                        aria-label="Select a country"
                        isSearchable
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
