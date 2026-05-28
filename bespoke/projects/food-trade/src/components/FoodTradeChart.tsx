import { useCallback } from "react"
import { match } from "ts-pattern"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { ALL_COUNTRIES, isAllCountry } from "../constants.js"
import { TradeFlow } from "../config.js"
import { ProductTradeData } from "../data.js"
import { FoodTradeBilateralSankey } from "./FoodTradeBilateralSankey.js"
import { FoodTradeSplitSankey } from "./FoodTradeSplitSankey.js"

export function FoodTradeChart({
    productData,
    country,
    product,
    year,
    view,
    hideFlowSwitcher,
    setCountry,
    setView,
}: {
    productData: ProductTradeData
    country: string
    product: string
    year: number
    view: TradeFlow
    hideFlowSwitcher?: boolean
    setCountry: (value: string) => void
    setView: (value: TradeFlow) => void
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
            setView(side === "exporter" ? "exports" : "imports")
        },
        [setCountry, setView]
    )

    return (
        <div className="food-trade-captioned-chart__chart-area">
            {match(mode)
                .with("bilateral", () => {
                    return flows.length > 0 ? (
                        <FoodTradeBilateralSankey
                            rows={flows}
                            year={year}
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
                            incoming={incomingFlows}
                            outgoing={outgoingFlows}
                            country={country}
                            product={product}
                            year={year}
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
