import { useCallback, useMemo, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faArrowRightArrowLeft,
} from "@fortawesome/free-solid-svg-icons"

import { articulateEntity } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { InlineLabeledDropdown } from "../../../../components/InlineLabeledDropdown/InlineLabeledDropdown.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"

import { MainVariantConfig, TradeFlow, VariantProps } from "../config.js"
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

const queryClient = new QueryClient()

export function MainVariant({
    config,
}: VariantProps<MainVariantConfig>): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="food-trade-chart">
                <FetchingMainVariant config={config} />
            </div>
        </QueryClientProvider>
    )
}

function FetchingMainVariant({ config }: { config: MainVariantConfig }) {
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

    const [product, setProduct] = useState<string>(
        config.product ?? DEFAULT_PRODUCT
    )
    const [country, setCountry] = useState<string>(
        config.country ?? DEFAULT_COUNTRY
    )
    const [view, setView] = useState<TradeFlow>(config.tradeFlow ?? "both")

    // Changing the view away from "both" while on "All countries" would
    // leave us in an invalid combination (bilateral has no imports/exports
    // halves), so auto-revert the country selection.
    const handleSetView = useCallback(
        (newView: TradeFlow) => {
            setView(newView)
            if (newView !== "both" && isAllCountry(country)) {
                setCountry(DEFAULT_COUNTRY)
            }
        },
        [country]
    )

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
            view={view}
            setProduct={setProduct}
            setCountry={setCountry}
            setView={handleSetView}
            config={config}
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
    view,
    setProduct,
    setCountry,
    setView,
    config,
}: {
    incoming: TradeRow[]
    outgoing: TradeRow[]
    bilateral: TradeRow[]
    products: string[]
    countries: string[]
    product: string
    country: string
    view: TradeFlow
    setProduct: (value: string) => void
    setCountry: (value: string) => void
    setView: (value: TradeFlow) => void
    config: MainVariantConfig
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

    const hasCenteredData = incoming.length > 0 || outgoing.length > 0
    const hasBilateralData = bilateral.length > 0

    const defaultTitle =
        mode === "bilateral"
            ? `Global ${product} trade in ${DATA_YEAR}`
            : view === "imports"
              ? `${product} imports to ${articulateEntity(country)} in ${DATA_YEAR}`
              : view === "exports"
                ? `${product} exports from ${articulateEntity(country)} in ${DATA_YEAR}`
                : `${product} trade through ${articulateEntity(country)} in ${DATA_YEAR}`

    const defaultSubtitle: React.ReactNode =
        mode === "centered" && view === "both" ? (
            <>
                Imports to and exports from {articulateEntity(country)} of{" "}
                {product}
            </>
        ) : mode === "bilateral" && hasBilateralData ? (
            <>
                {formatTrade(bilateralTotal)} of {product} was traded globally
                in {DATA_YEAR}.
            </>
        ) : null

    const title = config.title ?? defaultTitle
    const subtitle = config.subtitle ?? defaultSubtitle

    const productOptions = useMemo(
        () => products.map((p) => ({ value: p, label: p, id: p })),
        [products]
    )
    // "All countries" is only valid in the both-halves view (bilateral
    // mode); grey it out when the user has picked imports- or exports-only.
    const countryOptions = useMemo(
        () =>
            countries.map((c) => ({
                value: c,
                label: c,
                id: c,
                isDisabled: view !== "both" && c === ALL_COUNTRIES,
            })),
        [countries, view]
    )

    // Hide the big page heading and the controls when the embedder is
    // providing its own framing (custom title/subtitle) or explicitly opts
    // out of the controls.
    const hideOutsideFrame =
        config.hideControls || !!config.title || !!config.subtitle

    return (
        <>
            {!hideOutsideFrame && (
                <>
                    <header className="food-trade-heading">
                        <h1 className="food-trade-heading__title">
                            How does food move around the world?
                        </h1>
                        <p className="food-trade-heading__description">
                            Where particular food products are exported to, and
                            imported from
                        </p>
                    </header>
                    <div className="food-trade-controls">
                        <h3 className="food-trade-controls__title">
                            Configure the data
                        </h3>
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
                                    aria-label="Trade flow"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
            <Frame className="food-trade-captioned-chart">
                <ChartHeader title={title} subtitle={subtitle} />
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
                            view={view}
                        />
                    ) : (
                        <p className="food-trade-captioned-chart__empty">
                            No {DATA_YEAR} trade of {product} for{" "}
                            {articulateEntity(country)} recorded.
                        </p>
                    )}
                </div>
                <ChartFooter source="UN Food and Agriculture Organization (FAO)" />
            </Frame>
        </>
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
