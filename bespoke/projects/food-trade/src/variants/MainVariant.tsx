import { ComponentProps, useCallback, useMemo, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import {
    BasicDropdownOption,
    Dropdown as GrapherDropdown,
} from "@ourworldindata/grapher/src/controls/Dropdown.js"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"

import { TradeRow, useTradeData } from "../data.js"
import {
    FoodTradeBilateralSankey,
    FoodTradeSankey,
    formatTrade,
} from "../components/FoodTradeSankey.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"

const DATA_YEAR = 2024

const DEFAULT_PRODUCT = "Maize (corn)"
const DEFAULT_COUNTRY = "United Kingdom"

// Sentinel for the country dropdown: shows global bilateral trade for the
// selected product (no central country anchor).
const ALL_COUNTRIES = "All countries"
const isAllCountry = (c: string) => c === ALL_COUNTRIES

const queryClient = new QueryClient()

export function MainVariant() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="food-trade-chart">
                <FetchingMainVariant />
            </div>
        </QueryClientProvider>
    )
}

function FetchingMainVariant() {
    const { data, status, error } = useTradeData()

    const products = useMemo(
        () => Array.from(new Set(data?.map((d) => d.item) ?? [])).sort(),
        [data]
    )
    // Union of every country that ever appears on either side of a trade row,
    // so importer-only and exporter-only countries both show up in the picker.
    const countries = useMemo(() => {
        const items = Array.from(
            new Set([
                ...(data?.map((d) => d.exporter) ?? []),
                ...(data?.map((d) => d.importer) ?? []),
            ])
        ).sort()
        return [ALL_COUNTRIES, ...items]
    }, [data])

    const [product, setProduct] = useState<string>(DEFAULT_PRODUCT)
    const [country, setCountry] = useState<string>(DEFAULT_COUNTRY)

    const incoming = useMemo(() => {
        if (!data || isAllCountry(country)) return []
        return data.filter((d) => d.item === product && d.importer === country)
    }, [data, product, country])

    const outgoing = useMemo(() => {
        if (!data || isAllCountry(country)) return []
        return data.filter((d) => d.item === product && d.exporter === country)
    }, [data, product, country])

    // Bilateral mode: every row for the selected product, no country filter.
    // Only computed when the user has picked "All countries".
    const bilateral = useMemo(() => {
        if (!data || !isAllCountry(country)) return []
        return data.filter((d) => d.item === product)
    }, [data, product, country])

    if (status === "pending") return <FoodTradeSkeleton />
    if (status === "error" || !data)
        return <FoodTradeChartError error={error} />

    return (
        <CaptionedMainVariant
            incoming={incoming}
            outgoing={outgoing}
            bilateral={bilateral}
            products={products}
            countries={countries}
            product={product}
            country={country}
            setProduct={setProduct}
            setCountry={setCountry}
        />
    )
}

function CaptionedMainVariant({
    incoming,
    outgoing,
    bilateral,
    products,
    countries,
    product,
    country,
    setProduct,
    setCountry,
}: {
    incoming: TradeRow[]
    outgoing: TradeRow[]
    bilateral: TradeRow[]
    products: string[]
    countries: string[]
    product: string
    country: string
    setProduct: (value: string) => void
    setCountry: (value: string) => void
}) {
    const incomingTotal = useMemo(
        () => incoming.reduce((sum, d) => sum + d.value, 0),
        [incoming]
    )
    const outgoingTotal = useMemo(
        () => outgoing.reduce((sum, d) => sum + d.value, 0),
        [outgoing]
    )
    const bilateralTotal = useMemo(
        () => bilateral.reduce((sum, d) => sum + d.value, 0),
        [bilateral]
    )

    // Two modes:
    //   bilateral — All countries + a specific product; 2-column trade flow
    //   centered  — a specific country (existing 3-column behaviour)
    const mode: "bilateral" | "centered" = isAllCountry(country)
        ? "bilateral"
        : "centered"

    const title =
        mode === "centered"
            ? `${product} trade through ${country} in ${DATA_YEAR}`
            : `Global ${product} trade in ${DATA_YEAR}`

    const hasCenteredData = incoming.length > 0 || outgoing.length > 0
    const hasBilateralData = bilateral.length > 0

    return (
        <>
            <Frame className="food-trade-controls">
                <h3 className="food-trade-controls__title">
                    Configure the data
                </h3>
                <div className="food-trade-controls__content">
                    <div className="food-trade-controls__row">
                        <LabeledDropdown
                            label="Product"
                            values={products}
                            selected={product}
                            onChange={setProduct}
                        />
                        <LabeledDropdown
                            label="Country"
                            values={countries}
                            selected={country}
                            onChange={setCountry}
                        />
                    </div>
                </div>
            </Frame>
            <Frame className="food-trade-captioned-chart">
                <ChartHeader
                    title={title}
                    subtitle={
                        mode === "centered" ? (
                            <Subtitle
                                country={country}
                                product={product}
                                incomingTotal={incomingTotal}
                                outgoingTotal={outgoingTotal}
                            />
                        ) : hasBilateralData ? (
                            <>
                                {formatTrade(bilateralTotal)} of {product} was
                                traded globally in {DATA_YEAR}.
                            </>
                        ) : null
                    }
                />
                <div className="food-trade-captioned-chart__chart-area">
                    {mode === "bilateral" ? (
                        hasBilateralData ? (
                            <FoodTradeBilateralSankey rows={bilateral} />
                        ) : (
                            <p className="food-trade-captioned-chart__empty">
                                No {DATA_YEAR} trade of {product} recorded.
                            </p>
                        )
                    ) : hasCenteredData ? (
                        <FoodTradeSankey
                            incoming={incoming}
                            outgoing={outgoing}
                            country={country}
                            incomingTotal={incomingTotal}
                            outgoingTotal={outgoingTotal}
                        />
                    ) : (
                        <p className="food-trade-captioned-chart__empty">
                            No {DATA_YEAR} trade of {product} for {country}{" "}
                            recorded.
                        </p>
                    )}
                </div>
                <ChartFooter source="UN Food and Agriculture Organization (FAO)" />
            </Frame>
        </>
    )
}

function Subtitle({
    country,
    product,
    incomingTotal,
    outgoingTotal,
}: {
    country: string
    product: string
    incomingTotal: number
    outgoingTotal: number
}) {
    if (incomingTotal === 0 && outgoingTotal === 0) {
        return (
            <>
                {country} did not trade {product} in {DATA_YEAR}.
            </>
        )
    }
    if (incomingTotal > 0 && outgoingTotal > 0) {
        return (
            <>
                {country} imported {formatTrade(incomingTotal)} and exported{" "}
                {formatTrade(outgoingTotal)} of {product} in {DATA_YEAR}.
            </>
        )
    }
    if (incomingTotal > 0) {
        return (
            <>
                {country} imported {formatTrade(incomingTotal)} of {product} in{" "}
                {DATA_YEAR}.
            </>
        )
    }
    return (
        <>
            {country} exported {formatTrade(outgoingTotal)} of {product} in{" "}
            {DATA_YEAR}.
        </>
    )
}

function Dropdown({
    options,
    selectedValue,
    onChange,
    ...dropdownProps
}: {
    options: BasicDropdownOption[]
    selectedValue: string
    onChange: (value: string) => void
} & Omit<
    ComponentProps<typeof GrapherDropdown>,
    "options" | "value" | "onChange"
>) {
    const selectedOption =
        options.find((option) => option.value === selectedValue) ?? null

    const handleChange = useCallback(
        (option: BasicDropdownOption | null) => {
            if (option) onChange(option.value)
        },
        [onChange]
    )

    return (
        <GrapherDropdown
            {...dropdownProps}
            options={options}
            value={selectedOption}
            onChange={handleChange}
            isClearable={false}
        />
    )
}

function LabeledDropdown({
    label,
    values,
    selected,
    onChange,
}: {
    label: string
    values: string[]
    selected: string
    onChange: (value: string) => void
}) {
    const options = useMemo(
        () => values.map((v) => ({ value: v, label: v, id: v })),
        [values]
    )
    return (
        <Dropdown
            options={options}
            selectedValue={selected}
            onChange={onChange}
            placeholder={`Select ${label.toLowerCase()}…`}
            aria-label={`Select ${label.toLowerCase()}`}
            isSearchable={true}
            renderTriggerValue={(option) =>
                option ? (
                    <>
                        <span className="label">{label}: </span>
                        {option.label}
                    </>
                ) : null
            }
        />
    )
}

function FoodTradeSkeleton() {
    return <div className="food-trade-skeleton" />
}

function FoodTradeChartError({ error }: { error: Error | null }) {
    return (
        <div className="food-trade-chart__error">
            Failed to load trade data{error ? `: ${error.message}` : ""}
        </div>
    )
}
