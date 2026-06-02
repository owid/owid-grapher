import { useCallback, useMemo } from "react"
import * as R from "remeda"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faArrowRightArrowLeft,
} from "@fortawesome/free-solid-svg-icons"

import { BasicDropdownOption } from "@ourworldindata/grapher"
import { articulateEntity, Tippy } from "@ourworldindata/utils"

import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
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

import { TradeFlow } from "../config.js"
import { ALL_COUNTRIES, isAllCountry } from "../helpers.js"
import { FoodTradeMetadata, ProductTradeData } from "../types.js"

export function FoodTradeControls({
    metadata,
    productData,
    product,
    country,
    view,
    hideFlowSwitcher,
    setProduct,
    setCountry,
    setView,
}: {
    metadata: FoodTradeMetadata
    productData: ProductTradeData
    product: string
    country: string
    view: TradeFlow
    hideFlowSwitcher?: boolean
    setProduct: (value: string) => void
    setCountry: (value: string) => void
    setView: (value: TradeFlow) => void
}): React.ReactElement {
    return (
        <div className="food-trade-controls">
            <h3 className="food-trade-controls__title">Configure the data</h3>
            <div className="food-trade-controls__content">
                <div className="food-trade-controls__row">
                    <ProductDropdown
                        metadata={metadata}
                        product={product}
                        country={country}
                        setProduct={setProduct}
                    />
                    <CountryDropdown
                        metadata={metadata}
                        product={product}
                        country={country}
                        setCountry={setCountry}
                        includeAllCountries={
                            !hideFlowSwitcher || view === "both"
                        }
                    />
                    {!hideFlowSwitcher && (
                        <ViewSwitcher
                            metadata={metadata}
                            productData={productData}
                            product={product}
                            country={country}
                            view={view}
                            setView={setView}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

function ProductDropdown({
    metadata,
    product,
    country,
    setProduct,
}: {
    metadata: FoodTradeMetadata
    product: string
    country: string
    setProduct: (value: string) => void
}) {
    const productNames = useMemo(
        () => metadata.products.map((p) => p.name),
        [metadata]
    )

    const options = useMemo<DropdownCollection>(
        () =>
            R.sortBy(
                productNames.map((productName) => ({
                    value: productName,
                    label: productName,
                })),
                // Sort products the selected country doesn't trade to the bottom
                (option) =>
                    hasTradeData(metadata, country, option.value) ? 0 : 1
            ),
        [productNames, metadata, country]
    )

    const noDataValues = useMemo(
        () =>
            new Set(
                productNames.filter(
                    (productName) =>
                        !hasTradeData(metadata, country, productName)
                )
            ),
        [productNames, metadata, country]
    )

    const renderProductOption = useCallback(
        (option: BasicDropdownOption) =>
            renderOptionWithNoData(option, noDataValues),
        [noDataValues]
    )

    return (
        <InlineLabeledDropdown
            label="Product"
            options={options}
            selectedValue={product}
            onChange={setProduct}
            placeholder="Select a product…"
            aria-label="Select a product"
            isSearchable
            menuClassName="food-trade-controls__menu"
            renderMenuOption={renderProductOption}
        />
    )
}

function CountryDropdown({
    metadata,
    product,
    country,
    setCountry,
    includeAllCountries,
}: {
    metadata: FoodTradeMetadata
    product: string
    country: string
    setCountry: (value: string) => void
    includeAllCountries: boolean
}) {
    const { data: userCountryInfo } = useUserCountryInformation()

    const countryNames = useMemo(
        () =>
            includeAllCountries
                ? [ALL_COUNTRIES, ...metadata.entities.map((e) => e.name)]
                : metadata.entities.map((e) => e.name),
        [metadata, includeAllCountries]
    )

    const options = useMemo<DropdownCollection>(() => {
        const options = countryNames.map((countryName) => ({
            value: countryName,
            label: countryName,
        }))

        const [optionsWithData, optionsWithoutData] = R.partition(
            options,
            (option) => hasTradeData(metadata, option.value, product)
        )

        const groupedOptions = groupByUserLocation(
            optionsWithData,
            userCountryInfo,
            includeAllCountries ? [ALL_COUNTRIES] : []
        )

        if (optionsWithoutData.length === 0) return groupedOptions

        const lastGroup = groupedOptions[groupedOptions.length - 1]
        if (lastGroup && "options" in lastGroup) {
            return [
                ...groupedOptions.slice(0, -1),
                {
                    ...lastGroup,
                    options: [...lastGroup.options, ...optionsWithoutData],
                },
            ]
        }

        return [...groupedOptions, ...optionsWithoutData]
    }, [countryNames, product, metadata, userCountryInfo, includeAllCountries])

    const noDataValues = useMemo(
        () =>
            new Set(
                countryNames.filter(
                    (country) => !hasTradeData(metadata, country, product)
                )
            ),
        [countryNames, product, metadata]
    )

    const renderCountryOption = useCallback(
        (option: BasicDropdownOption) =>
            renderOptionWithNoData(option, noDataValues),
        [noDataValues]
    )

    return (
        <InlineLabeledDropdown
            label="Country"
            options={options}
            selectedValue={country}
            onChange={setCountry}
            placeholder="Select a country…"
            aria-label="Select a country"
            isSearchable
            menuClassName="food-trade-controls__menu"
            renderMenuOption={renderCountryOption}
        />
    )
}

function ViewSwitcher({
    metadata,
    productData,
    product,
    country,
    view,
    setView,
}: {
    metadata: FoodTradeMetadata
    productData: ProductTradeData
    product: string
    country: string
    view: TradeFlow
    setView: (value: TradeFlow) => void
}) {
    const { ref: switcherWrapperRef, getTippyContainer } =
        useTippyContainer<HTMLDivElement>()

    const options: SwitcherItem<TradeFlow>[] = [
        {
            key: "imports",
            element: (
                <>
                    <FontAwesomeIcon
                        icon={faArrowRight}
                        size="sm"
                        aria-hidden
                    />
                    Imports
                </>
            ),
        },
        {
            key: "exports",
            element: (
                <>
                    Exports
                    <FontAwesomeIcon
                        icon={faArrowRight}
                        size="sm"
                        aria-hidden
                    />
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

    // Whether the selected country only trades this product in one direction
    // (so the radios should be disabled with a tooltip explaining why)
    const incomingCount =
        productData.incomingFlowsByCountry.get(country)?.length ?? 0
    const outgoingCount =
        productData.outgoingFlowsByCountry.get(country)?.length ?? 0
    const hasOnlyImports = incomingCount > 0 && outgoingCount === 0
    const hasOnlyExports = outgoingCount > 0 && incomingCount === 0

    const countryLabel = R.capitalize(articulateEntity(country))
    const productLabel = R.uncapitalize(product)
    const viewDisabledReason: string | undefined = isAllCountry(country)
        ? "Select a country to view imports and exports separately."
        : hasOnlyImports
          ? `${countryLabel} did not export ${productLabel} in ${metadata.year}.`
          : hasOnlyExports
            ? `${countryLabel} did not import ${productLabel} in ${metadata.year}.`
            : undefined
    const isViewDisabled = !!viewDisabledReason

    return (
        <Tippy
            content={viewDisabledReason ?? ""}
            disabled={!isViewDisabled}
            appendTo={getTippyContainer}
            maxWidth={270}
        >
            <div
                ref={switcherWrapperRef}
                className="food-trade-controls__switcher-wrapper"
            >
                <Switcher
                    items={options}
                    selectedKey={view}
                    onChange={setView}
                    isDisabled={isViewDisabled}
                    ariaLabel="Trade flow"
                />
            </div>
        </Tippy>
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

const hasTradeData = (
    metadata: FoodTradeMetadata,
    country: string,
    productName: string
) => isAllCountry(country) || metadata.hasTradeData(country, productName)
