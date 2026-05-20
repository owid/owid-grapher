import { useCallback, useMemo, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"

import { ALL_COUNTRIES, isAllCountry } from "../constants.js"
import { MainVariantConfig, TradeFlow, VariantProps } from "../config.js"
import { TradeRow, useTradeData } from "../data.js"
import { FoodTradeControls } from "../components/FoodTradeControls.js"
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

const DATA_YEAR = 2023

const DEFAULT_PRODUCT = "Maize (corn)"
const DEFAULT_COUNTRY = "United Kingdom"

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

    const initialCountry = config.country ?? DEFAULT_COUNTRY
    const [product, setProduct] = useState<string>(
        config.product ?? DEFAULT_PRODUCT
    )
    const [country, setCountry] = useState<string>(initialCountry)
    // All countries forces bilateral mode where imports/exports don't
    // apply — coerce the initial view to "both" so a configured
    // tradeFlow doesn't leave the disabled radios highlighting a
    // half-view that isn't shown.
    const [view, setView] = useState<TradeFlow>(
        isAllCountry(initialCountry) ? "both" : (config.tradeFlow ?? "both")
    )

    // Same reason at runtime: when the user picks All countries, snap
    // the stored view to "both" so the (now-disabled) radio group
    // reflects what's actually on screen.
    const handleSetCountry = useCallback((newCountry: string) => {
        setCountry(newCountry)
        if (isAllCountry(newCountry)) setView("both")
    }, [])

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
            data={data}
            incoming={incoming}
            outgoing={outgoing}
            bilateral={bilateral}
            products={products}
            countries={countries}
            product={product}
            country={country}
            view={view}
            setProduct={setProduct}
            setCountry={handleSetCountry}
            setView={setView}
            config={config}
        />
    )
}

function CaptionedMainVariant({
    data,
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
    data: TradeRow[]
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
            ? `Global ${R.uncapitalize(product)} trade in ${DATA_YEAR}`
            : view === "imports"
              ? `${product} imports to ${articulateEntity(country)} in ${DATA_YEAR}`
              : view === "exports"
                ? `${product} exports from ${articulateEntity(country)} in ${DATA_YEAR}`
                : `${product} trade through ${articulateEntity(country)} in ${DATA_YEAR}`

    const defaultSubtitle: React.ReactNode =
        mode === "centered" && view === "both" ? (
            <>
                Imports to and exports from {articulateEntity(country)} of{" "}
                {R.uncapitalize(product)}
            </>
        ) : mode === "bilateral" && hasBilateralData ? (
            <>
                {formatTrade(bilateralTotal)} of {R.uncapitalize(product)} was
                traded globally in {DATA_YEAR}.
            </>
        ) : null

    const title = config.title ?? defaultTitle
    const subtitle = config.subtitle ?? defaultSubtitle

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
                    <FoodTradeControls
                        data={data}
                        products={products}
                        countries={countries}
                        product={product}
                        country={country}
                        view={view}
                        setProduct={setProduct}
                        setCountry={setCountry}
                        setView={setView}
                    />
                </>
            )}
            <Frame className="food-trade-captioned-chart">
                <ChartHeader title={title} subtitle={subtitle} />
                <div className="food-trade-captioned-chart__chart-area">
                    {mode === "bilateral" ? (
                        hasBilateralData ? (
                            <FoodTradeBilateralSankey rows={bilateral} />
                        ) : (
                            <EmptyState
                                message={`No global trade of ${R.uncapitalize(product)} in ${DATA_YEAR}.`}
                            />
                        )
                    ) : hasCenteredData ? (
                        <FoodTradeSankey
                            incoming={incoming}
                            outgoing={outgoing}
                            country={country}
                            product={product}
                            year={DATA_YEAR}
                            incomingTotal={incomingTotal}
                            outgoingTotal={outgoingTotal}
                            view={view}
                            setView={setView}
                        />
                    ) : (
                        <EmptyState
                            message={`${R.capitalize(articulateEntity(country))} didn't import or export ${R.uncapitalize(product)} in ${DATA_YEAR}.`}
                            cta={
                                data.some((d) => d.item === product)
                                    ? {
                                          label: `See global trade of ${R.uncapitalize(product)}`,
                                          onClick: () =>
                                              setCountry(ALL_COUNTRIES),
                                      }
                                    : undefined
                            }
                        />
                    )}
                </div>
                <ChartFooter source="UN Food and Agriculture Organization (FAO)" />
            </Frame>
        </>
    )
}

function EmptyState({
    message,
    cta,
}: {
    message: React.ReactNode
    cta?: { label: string; onClick: () => void }
}) {
    return (
        <div className="food-trade-captioned-chart__empty">
            <p className="food-trade-captioned-chart__empty-message">
                {message}
            </p>
            {cta && (
                <button
                    type="button"
                    className="food-trade-captioned-chart__empty-cta"
                    onClick={cta.onClick}
                >
                    {cta.label} →
                </button>
            )}
        </div>
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
