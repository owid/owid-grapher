import { useCallback } from "react"
import { match } from "ts-pattern"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { type Flow } from "../config.js"
import { ALL_COUNTRIES, isAllCountry } from "../helpers.js"
import {
    type FoodTradeSankeySettings,
    type ProductTradeData,
} from "../types.js"
import { FoodTradeBilateralSankey } from "./FoodTradeBilateralSankey.js"
import { FoodTradeSplitSankey } from "./FoodTradeSplitSankey.js"

export function FoodTradeChart({
    productData,
    country,
    product,
    year,
    view,
    sankeySettings,
    isLoading,
    hideFlowSwitcher,
    setCountry,
    setView,
}: {
    productData: ProductTradeData
    country: string
    product: string
    year: number
    view: Flow
    sankeySettings: FoodTradeSankeySettings
    isLoading?: boolean
    hideFlowSwitcher?: boolean
    setCountry: (value: string) => void
    setView: (value: Flow) => void
}) {
    const {
        flows,
        productionByCountry,
        supplyByCountry,
        incomingFlowsByCountry,
        outgoingFlowsByCountry,
    } = productData

    const mode: "bilateral" | "split" = isAllCountry(country)
        ? "bilateral"
        : "split"

    const handleSelectEntity = useCallback(
        (entity: string, side: "exporter" | "importer") => {
            setCountry(entity)
            setView(side === "exporter" ? "export" : "import")
        },
        [setCountry, setView]
    )

    return (
        <div className="food-trade-captioned-chart__chart-area">
            {isLoading && <Spinner />}
            {match(mode)
                .with("bilateral", () => {
                    return flows.length > 0 ? (
                        <FoodTradeBilateralSankey
                            trades={flows}
                            year={year}
                            sankeySettings={sankeySettings}
                            onSelectEntity={
                                hideFlowSwitcher
                                    ? undefined
                                    : handleSelectEntity
                            }
                        />
                    ) : (
                        <NoData
                            message={`No global trade of ${R.uncapitalize(product)} in ${year}.`}
                        />
                    )
                })
                .with("split", () => {
                    const incomingFlows =
                        incomingFlowsByCountry.get(country) ?? []
                    const outgoingFlows =
                        outgoingFlowsByCountry.get(country) ?? []

                    const countryProduction = productionByCountry.get(country)
                    const countrySupply = supplyByCountry.get(country)

                    const hasData =
                        incomingFlows.length > 0 || outgoingFlows.length > 0

                    if (!hasData) {
                        return (
                            <NoData
                                message={`${R.capitalize(articulateEntity(country))} did not import or export ${R.uncapitalize(product)} in ${year}.`}
                                cta={{
                                    label: `See global trade of ${R.uncapitalize(product)}`,
                                    onClick: () => setCountry(ALL_COUNTRIES),
                                }}
                            />
                        )
                    }

                    return (
                        <FoodTradeSplitSankey
                            incomingTrades={incomingFlows}
                            outgoingTrades={outgoingFlows}
                            country={country}
                            product={product}
                            year={year}
                            sankeySettings={sankeySettings}
                            countryProduction={countryProduction}
                            countrySupply={countrySupply}
                            view={view}
                            setView={setView}
                        />
                    )
                })
                .exhaustive()}
        </div>
    )
}

function NoData({
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
