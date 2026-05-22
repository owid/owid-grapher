import { useCallback, useMemo, useRef, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UNSAFE_PortalProvider } from "react-aria"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"

import { ALL_COUNTRIES, isAllCountry } from "../constants.js"
import { MainVariantConfig, TradeFlow, VariantProps } from "../config.js"
import {
    FoodTradeMetadata,
    TradeRow,
    useFoodTradeMetadata,
    useProductTradeData,
} from "../data.js"
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

const DEFAULT_PRODUCT = "Maize (corn)"
const DEFAULT_COUNTRY = "United Kingdom"

const queryClient = new QueryClient()

export function MainVariant({
    config,
}: VariantProps<MainVariantConfig>): React.ReactElement {
    const { width, node, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < MOBILE_BREAKPOINT
    // Portal react-aria overlays (dropdown popovers) back into our
    // Shadow DOM so the chart's scoped styles apply to them. Without
    // this they end up on document.body and only the globally-available
    // dropdown base styles reach them — anything food-trade-specific
    // would silently miss.
    const getPortalContainer = useCallback((): HTMLElement => {
        const root = node?.getRootNode()
        if (root instanceof ShadowRoot) return root as unknown as HTMLElement
        return document.body
    }, [node])
    return (
        <QueryClientProvider client={queryClient}>
            <div ref={rootRef} className="food-trade-chart">
                <UNSAFE_PortalProvider getContainer={getPortalContainer}>
                    <FetchingMainVariant config={config} />
                </UNSAFE_PortalProvider>
            </div>
        </QueryClientProvider>
    )
}

function FetchingMainVariant({ config }: { config: MainVariantConfig }) {
    const { data: metadata, status: metadataStatus } = useFoodTradeMetadata()

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

    const productId = metadata?.productByName.get(product)?.id
    const { data: productData, status: productStatus } = useProductTradeData(
        productId,
        metadata
    )

    // Same reason at runtime: when the user picks All countries, snap
    // the stored view to "both" so the (now-disabled) radio group
    // reflects what's actually on screen.
    const handleSetCountry = useCallback((newCountry: string) => {
        setCountry(newCountry)
        if (isAllCountry(newCountry)) setView("both")
    }, [])

    const products = useMemo(
        () =>
            metadata ? [...metadata.products].map((p) => p.name).sort() : [],
        [metadata]
    )
    const countries = useMemo(() => {
        if (!metadata) return [ALL_COUNTRIES]
        const names = [...metadata.entities].map((e) => e.name).sort()
        return [ALL_COUNTRIES, ...names]
    }, [metadata])

    const flows = productData?.flows
    const production = productData?.production
    const supply = productData?.supply

    const incoming = useMemo(() => {
        if (!flows || isAllCountry(country)) return []
        return flows.filter((d) => d.importer === country)
    }, [flows, country])

    const outgoing = useMemo(() => {
        if (!flows || isAllCountry(country)) return []
        return flows.filter((d) => d.exporter === country)
    }, [flows, country])

    const countryProduction = isAllCountry(country)
        ? undefined
        : production?.get(country)
    const countrySupply = isAllCountry(country)
        ? undefined
        : supply?.get(country)

    // Bilateral mode: the entire product file when "All countries" is
    // selected, since each file is already scoped to one product.
    const bilateral = useMemo(() => {
        if (!flows || !isAllCountry(country)) return []
        return flows
    }, [flows, country])

    const availableCountryNames = useMemo(
        () =>
            metadata
                ? new Set(metadata.entities.map((e) => e.name))
                : undefined,
        [metadata]
    )
    const { isResolved: isCountryResolved } = useResolveUserLocation({
        configCountry: config.country,
        availableCountryNames,
        urlSync,
        urlStateKey: "foodTradeCountry",
        setCountry,
    })

    if (
        metadataStatus === "pending" ||
        productStatus === "pending" ||
        !isCountryResolved
    )
        return <FoodTradeSkeleton />
    if (metadataStatus === "error" || !metadata)
        return <FoodTradeChartError message="Failed to load trade metadata" />
    if (productStatus === "error" || !flows)
        return <FoodTradeChartError message="Failed to load trade data" />

    return (
        <CaptionedMainVariant
            metadata={metadata}
            incoming={incoming}
            outgoing={outgoing}
            bilateral={bilateral}
            hasAnyTrade={flows.length > 0}
            countryProduction={countryProduction}
            countrySupply={countrySupply}
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
    metadata,
    incoming,
    outgoing,
    bilateral,
    hasAnyTrade,
    countryProduction,
    countrySupply,
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
    metadata: FoodTradeMetadata
    incoming: TradeRow[]
    outgoing: TradeRow[]
    bilateral: TradeRow[]
    hasAnyTrade: boolean
    countryProduction: number | undefined
    countrySupply: number | undefined
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
    const year = metadata.year

    const incomingTotal = useMemo(
        () => incoming.reduce((sum, d) => sum + d.value, 0),
        [incoming]
    )
    const outgoingTotal = useMemo(
        () => outgoing.reduce((sum, d) => sum + d.value, 0),
        [outgoing]
    )
    const incomingShare =
        countrySupply && countrySupply > 0
            ? incomingTotal / countrySupply
            : undefined
    const outgoingShare =
        countryProduction && countryProduction > 0
            ? outgoingTotal / countryProduction
            : undefined

    // When the selected country only trades this product in one
    // direction, the other view has nothing to show — coerce the
    // displayed view to the half that has data and disable the radios.
    // The user's stored view preference is left untouched so it comes
    // back when they navigate to a country-product combo with both
    // sides.
    const onlyImports = incoming.length > 0 && outgoing.length === 0
    const onlyExports = outgoing.length > 0 && incoming.length === 0
    const effectiveView: TradeFlow = onlyImports
        ? "imports"
        : onlyExports
          ? "exports"
          : view
    const viewDisabledReason: string | undefined = isAllCountry(country)
        ? "Select a country to view imports and exports separately."
        : onlyImports
          ? `${R.capitalize(articulateEntity(country))} did not export ${R.uncapitalize(product)} in ${year}.`
          : onlyExports
            ? `${R.capitalize(articulateEntity(country))} did not import ${R.uncapitalize(product)} in ${year}.`
            : undefined
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
            ? `Global ${R.uncapitalize(product)} trade in ${year}`
            : view === "imports"
              ? `${product} imports to ${articulateEntity(country)} in ${year}`
              : view === "exports"
                ? `${product} exports from ${articulateEntity(country)} in ${year}`
                : `${product} trade through ${articulateEntity(country)} in ${year}`

    const defaultSubtitle: React.ReactNode =
        mode === "centered" && view === "both" ? (
            <>
                Imports to and exports from {articulateEntity(country)} of{" "}
                {R.uncapitalize(product)}
            </>
        ) : mode === "bilateral" && hasBilateralData ? (
            <>
                {formatTrade(bilateralTotal)} of {R.uncapitalize(product)} was
                traded globally in {year}.
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
                        metadata={metadata}
                        products={products}
                        countries={countries}
                        product={product}
                        country={country}
                        view={effectiveView}
                        viewDisabledReason={viewDisabledReason}
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
                            <FoodTradeBilateralSankey
                                rows={bilateral}
                                year={year}
                            />
                        ) : (
                            <EmptyState
                                message={`No global trade of ${R.uncapitalize(product)} in ${year}.`}
                            />
                        )
                    ) : hasCenteredData ? (
                        <FoodTradeSankey
                            incoming={incoming}
                            outgoing={outgoing}
                            country={country}
                            product={product}
                            year={year}
                            incomingTotal={incomingTotal}
                            outgoingTotal={outgoingTotal}
                            incomingShare={incomingShare}
                            outgoingShare={outgoingShare}
                            view={effectiveView}
                            setView={setView}
                        />
                    ) : (
                        <EmptyState
                            message={`${R.capitalize(articulateEntity(country))} did not import or export ${R.uncapitalize(product)} in ${year}.`}
                            cta={
                                hasAnyTrade
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
                <ChartFooter
                    source={metadata.source}
                    note='Only the top ten trade partners are shown; remainder grouped as "Other".'
                />
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
                    {cta.label}
                </button>
            )}
        </div>
    )
}

function FoodTradeSkeleton() {
    return <div className="food-trade-skeleton" />
}

function FoodTradeChartError({ message }: { message: string }) {
    return <div className="food-trade-chart__error">{message}</div>
}
