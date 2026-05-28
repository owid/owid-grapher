import { useCallback, useMemo } from "react"
import cx from "classnames"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UNSAFE_PortalProvider } from "react-aria"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsString, parseAsStringEnum } from "nuqs"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"

import { SankeyVariantConfig, TradeFlow, VariantProps } from "../config.js"
import { FoodTradeMetadata, ProductTradeData, TradeRow } from "../types.js"
import { useFoodTradeMetadata, useProductTradeData } from "../data.js"
import { FoodTradeControls } from "../components/FoodTradeControls.js"
import { FoodTradeChart } from "../components/FoodTradeChart.js"
import { ALL_COUNTRIES, formatTrade, isAllCountry } from "../helpers.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"

const DEFAULT_PRODUCT = "Maize (corn)"
const DEFAULT_COUNTRY = ALL_COUNTRIES
const DEFAULT_VIEW: TradeFlow = "both"

const queryClient = new QueryClient()

export function SankeyVariant({
    config,
}: VariantProps<SankeyVariantConfig>): React.ReactElement {
    const { width, node, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < MOBILE_BREAKPOINT

    // Portal react-aria overlays (dropdown popovers) back into our
    // Shadow DOM so the chart's scoped styles apply to them
    const getPortalContainer = useCallback((): HTMLElement => {
        const root = node?.getRootNode()
        if (root instanceof ShadowRoot) return root as unknown as HTMLElement
        return document.body
    }, [node])

    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <div
                    ref={ref}
                    className={cx("food-trade-chart", {
                        "food-trade-chart--narrow": isNarrow,
                    })}
                >
                    <UNSAFE_PortalProvider getContainer={getPortalContainer}>
                        <FetchingSankeyVariant config={config} />
                    </UNSAFE_PortalProvider>
                </div>
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

function FetchingSankeyVariant({ config }: { config: SankeyVariantConfig }) {
    const initialProduct = config.product ?? DEFAULT_PRODUCT
    const isUserLocation = isUserLocationCountry(config.country)
    const initialCountry =
        !config.country || isUserLocation ? DEFAULT_COUNTRY : config.country
    const initialView =
        !isUserLocation && isAllCountry(initialCountry)
            ? "both"
            : (config.tradeFlow ?? DEFAULT_VIEW)
    const urlSync = config.urlSync ?? false

    const [product, setProduct] = useUrlState({
        key: "foodTradeProduct",
        parser: parseAsString,
        defaultValue: initialProduct,
        enabled: urlSync,
    })
    const [country, _setCountry] = useUrlState({
        key: "foodTradeCountry",
        parser: parseAsString,
        defaultValue: initialCountry,
        enabled: urlSync,
    })
    const [_view, setView] = useUrlState({
        key: "foodTradeView",
        parser: parseAsStringEnum<TradeFlow>(["both", "imports", "exports"]),
        defaultValue: initialView,
        enabled: urlSync,
    })

    const { data: metadata, status: metadataStatus } = useFoodTradeMetadata()
    const productId = metadata?.productByName.get(product)?.id
    const { data: productData, status: productStatus } = useProductTradeData(
        productId,
        metadata
    )

    // When the selected country only trades this product in one direction,
    // the other view has nothing to show. Coerce the displayed view to the
    // half that has data (and disable the view switcher in this case)
    const incomingFlows = productData?.incomingFlowsByCountry.get(country) ?? []
    const outgoingFlows = productData?.outgoingFlowsByCountry.get(country) ?? []
    const hasOnlyIncomingFlows =
        incomingFlows.length > 0 && outgoingFlows.length === 0
    const hasOnlyOutgoingFlows =
        outgoingFlows.length > 0 && incomingFlows.length === 0
    const view: TradeFlow = hasOnlyIncomingFlows
        ? "imports"
        : hasOnlyOutgoingFlows
          ? "exports"
          : _view

    const setCountry = useCallback(
        (newCountry: string) => {
            _setCountry(newCountry)

            // When the user picks 'All countries', snap the view to "both" so the
            // (now-disabled) radio group reflects what's actually on screen
            if (isAllCountry(newCountry)) setView("both")
        },
        [_setCountry, setView]
    )

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
    if (productStatus === "error" || !productData)
        return <FoodTradeChartError message="Failed to load trade data" />

    return (
        <CaptionedSankeyVariant
            config={config}
            metadata={metadata}
            productData={productData}
            product={product}
            country={country}
            view={view}
            setProduct={setProduct}
            setCountry={setCountry}
            setView={setView}
        />
    )
}

function CaptionedSankeyVariant({
    metadata,
    productData,
    product,
    country,
    view,
    setProduct,
    setCountry,
    setView,
    config,
}: {
    config: SankeyVariantConfig
    metadata: FoodTradeMetadata
    productData: ProductTradeData
    product: string
    country: string
    view: TradeFlow
    setProduct: (value: string) => void
    setCountry: (value: string) => void
    setView: (value: TradeFlow) => void
}) {
    const shouldHideChrome =
        config.hideControls || !!config.title || !!config.subtitle

    return (
        <>
            {!shouldHideChrome && (
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
                        productData={productData}
                        product={product}
                        country={country}
                        view={view}
                        hideFlowSwitcher={config.hideFlowSwitcher}
                        setProduct={setProduct}
                        setCountry={setCountry}
                        setView={setView}
                    />
                </>
            )}
            <Frame className="food-trade-captioned-chart">
                <FoodTradeChartHeader
                    config={config}
                    country={country}
                    product={product}
                    year={metadata.year}
                    view={view}
                    flows={productData.flows}
                />
                <FoodTradeChart
                    productData={productData}
                    country={country}
                    product={product}
                    year={metadata.year}
                    view={view}
                    hideFlowSwitcher={config.hideFlowSwitcher}
                    setCountry={setCountry}
                    setView={setView}
                />
                <FoodTradeChartFooter source={metadata.source} />
            </Frame>
        </>
    )
}

function FoodTradeChartHeader({
    config,
    country,
    product,
    year,
    view,
    flows,
}: {
    config: SankeyVariantConfig
    country: string
    product: string
    year: number
    view: TradeFlow
    flows: TradeRow[]
}) {
    const mode: "bilateral" | "centered" = isAllCountry(country)
        ? "bilateral"
        : "centered"
    const hasAnyTrade = flows.length > 0
    const tradedTotal = useMemo(() => R.sumBy(flows, (d) => d.value), [flows])

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
        ) : mode === "bilateral" && hasAnyTrade ? (
            <>
                {formatTrade(tradedTotal)} of {R.uncapitalize(product)} was
                traded globally in {year}.
            </>
        ) : null

    return (
        <ChartHeader
            title={config.title ?? defaultTitle}
            subtitle={config.subtitle ?? defaultSubtitle}
        />
    )
}

function FoodTradeChartFooter({ source }: { source: string }) {
    return (
        <ChartFooter
            source={source}
            note='Only the top ten trade partners are shown; remainder grouped as "Other".'
        />
    )
}

function FoodTradeSkeleton() {
    return <div className="food-trade-skeleton" />
}

function FoodTradeChartError({ message }: { message: string }) {
    return <div className="food-trade-chart__error">{message}</div>
}
