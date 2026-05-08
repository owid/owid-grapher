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
import { FoodTradeSankey, formatTrade } from "../components/FoodTradeSankey.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"

const DATA_YEAR = 2024

const DEFAULT_PRODUCT = "Maize (corn)"
const DEFAULT_EXPORTER = "United States of America"

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
    const exporters = useMemo(
        () => Array.from(new Set(data?.map((d) => d.exporter) ?? [])).sort(),
        [data]
    )

    const [product, setProduct] = useState<string>(DEFAULT_PRODUCT)
    const [exporter, setExporter] = useState<string>(DEFAULT_EXPORTER)

    const chartData = useMemo(() => {
        if (!data) return []
        return data.filter((d) => d.item === product && d.exporter === exporter)
    }, [data, product, exporter])

    if (status === "pending") return <FoodTradeSkeleton />
    if (status === "error" || !data)
        return <FoodTradeChartError error={error} />

    return (
        <CaptionedMainVariant
            data={chartData}
            products={products}
            exporters={exporters}
            product={product}
            exporter={exporter}
            setProduct={setProduct}
            setExporter={setExporter}
        />
    )
}

function CaptionedMainVariant({
    data,
    products,
    exporters,
    product,
    exporter,
    setProduct,
    setExporter,
}: {
    data: TradeRow[]
    products: string[]
    exporters: string[]
    product: string
    exporter: string
    setProduct: (value: string) => void
    setExporter: (value: string) => void
}) {
    const totalValue = useMemo(
        () => data.reduce((sum, d) => sum + d.value, 0),
        [data]
    )
    const importerCount = data.length
    const unit = data[0]?.unit ?? ""

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
                            label="Exporter"
                            values={exporters}
                            selected={exporter}
                            onChange={setExporter}
                        />
                    </div>
                </div>
            </Frame>
            <Frame className="food-trade-captioned-chart">
                <ChartHeader
                    title={`${product} exports from ${exporter} in ${DATA_YEAR}`}
                    subtitle={
                        importerCount === 0 ? (
                            <>
                                {exporter} did not export {product} in{" "}
                                {DATA_YEAR}.
                            </>
                        ) : (
                            <>
                                {exporter} exported{" "}
                                <strong>
                                    {formatTrade(totalValue, unit)} of {product}
                                </strong>{" "}
                                in {DATA_YEAR}.
                            </>
                        )
                    }
                />
                <div className="food-trade-captioned-chart__chart-area">
                    {data.length === 0 ? (
                        <p className="food-trade-captioned-chart__empty">
                            No {DATA_YEAR} exports of {product} from {exporter}{" "}
                            recorded.
                        </p>
                    ) : (
                        <FoodTradeSankey
                            data={data}
                            exporter={exporter}
                            unit={unit}
                        />
                    )}
                </div>
                <ChartFooter source="UN Food and Agriculture Organization (FAO)" />
            </Frame>
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
