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

import { SankeyVariantConfig, Flow, VariantProps } from "../config.js"
import { FoodTradeMetadata, ProductTradeData, TradeRow } from "../types.js"
import { useFoodTradeMetadata, useProductTradeData } from "../data.js"
import { FoodTradeControls } from "../components/FoodTradeControls.js"
import { FoodTradeChart } from "../components/FoodTradeChart.js"
import { ALL_COUNTRIES, formatTrade, isAllCountry } from "../helpers.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"

const DEFAULT_PRODUCT = "Maize"
const DEFAULT_COUNTRY = ALL_COUNTRIES
const DEFAULT_VIEW: Flow = "both"

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
            : (config.flow ?? DEFAULT_VIEW)
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
        key: "foodTradeFlow",
        parser: parseAsStringEnum<Flow>(["both", "import", "export"]),
        defaultValue: initialView,
        enabled: urlSync,
    })

    const { data: metadata, status: metadataStatus } = useFoodTradeMetadata()
    const productId = metadata?.productByName.get(product)?.id
    const {
        data: productData,
        status: productStatus,
        isPlaceholderData,
    } = useProductTradeData(productId, metadata)

    // Dim the chart and show a spinner while a new product file loads,
    // keeping the previous product on screen until the new one arrives.
    const isLoading = useDelayedLoading(isPlaceholderData)

    // When the selected country only trades this product in one direction,
    // the other view has nothing to show. Coerce the displayed view to the
    // half that has data (and disable the view switcher in this case)
    const incomingFlows = productData?.incomingFlowsByCountry.get(country) ?? []
    const outgoingFlows = productData?.outgoingFlowsByCountry.get(country) ?? []
    const hasOnlyIncomingFlows =
        incomingFlows.length > 0 && outgoingFlows.length === 0
    const hasOnlyOutgoingFlows =
        outgoingFlows.length > 0 && incomingFlows.length === 0
    const view: Flow = hasOnlyIncomingFlows
        ? "import"
        : hasOnlyOutgoingFlows
          ? "export"
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
            isLoading={isLoading}
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
    isLoading,
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
    view: Flow
    isLoading: boolean
    setProduct: (value: string) => void
    setCountry: (value: string) => void
    setView: (value: Flow) => void
}) {
    const shouldHideChrome =
        config.hideControls || !!config.title || !!config.subtitle

    return (
        <>
            {!shouldHideChrome && (
                <>
                    <header className="food-trade-heading">
                        <h1 className="food-trade-heading__title">
                            How does food get traded around the world?
                        </h1>
                        <p className="food-trade-heading__description">
                            Where food products are exported to and imported
                            from, based on trade as reported by importing
                            countries.
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
                    isLoading={isLoading}
                    hideFlowSwitcher={config.hideFlowSwitcher}
                    setCountry={setCountry}
                    setView={setView}
                />
                <FoodTradeChartFooter
                    source={metadata.source}
                    country={country}
                    view={view}
                />
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
    view: Flow
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
            : view === "import"
              ? `Where ${articulateEntity(country)} imported ${R.uncapitalize(product)} from in ${year}`
              : view === "export"
                ? `Where ${articulateEntity(country)} exported ${R.uncapitalize(product)} to in ${year}`
                : `${product} trade through ${articulateEntity(country)} in ${year}`

    const defaultSubtitle: React.ReactNode =
        mode === "centered" && view === "both" ? (
            <>
                Imports and exports of {R.uncapitalize(product)}, as reported by
                importing countries.
            </>
        ) : mode === "centered" && view === "import" ? (
            <>
                {product} imported into {articulateEntity(country)}, as reported
                by the importing country.
            </>
        ) : mode === "centered" && view === "export" ? (
            <>
                {product} exported by {articulateEntity(country)}, as reported
                by importing countries.
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

function FoodTradeChartFooter({
    source,
    country,
    view,
}: {
    source: string
    country: string
    view: Flow
}) {
    const topPartners =
        'Only the largest partners are shown; the rest are grouped as "Other".'
    const reporting =
        view === "import"
            ? `Figures reflect imports reported by ${articulateEntity(country)}; exporter records may differ.`
            : view === "export"
              ? "Figures reflect data reported by importing countries, which may differ from export records."
              : "Figures reflect trade reported by importers, which may differ from export records."

    return <ChartFooter source={source} note={`${topPartners} ${reporting}`} />
}

function FoodTradeSkeleton() {
    return <div className="food-trade-skeleton" />
}

function FoodTradeChartError({ message }: { message: string }) {
    return <div className="food-trade-chart__error">{message}</div>
}
