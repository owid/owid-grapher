import React from "react"
import { Region } from "@ourworldindata/utils"
import { DataCatalogResearchRibbonResult } from "./DataCatalogUtils.js"
import { CatalogComponentId } from "./DataCatalogState.js"
import { DataCatalogResearchHit } from "./DataCatalogResearchHit.js"

interface DataCatalogResearchRibbonsProps {
    results?: DataCatalogResearchRibbonResult[]
    componentCount: Record<CatalogComponentId, number>
    setComponentCount?: (componentId: CatalogComponentId, count: number) => void
    selectedCountries?: Region[]
    topics?: Set<string>
    addTopic?: (topic: string) => void
    isLoading?: boolean
}

export const DataCatalogResearchRibbons: React.FC<
    DataCatalogResearchRibbonsProps
> = ({ results, componentCount, addTopic, isLoading }) => {
    if (!results || results.length === 0 || isLoading) return null

    const researchToShow = componentCount[CatalogComponentId.RESEARCH] || 4

    // We'll only show ribbons that have actual results
    const ribbonsWithResults = results.filter(
        (ribbon) => ribbon.hits.length > 0
    )

    return (
        <div className="data-catalog-research-ribbons-container span-cols-12 col-start-2">
            <header className="data-catalog-ribbon-header">
                <h2 className="h2-bold data-catalog-ribbon-title">
                    Research & Writing
                </h2>
            </header>

            <div className="grid grid-cols-4 grid-sm-cols-1">
                {ribbonsWithResults.map((ribbon) => (
                    <div
                        className="data-catalog-research-ribbon-section"
                        key={ribbon.title}
                    >
                        {addTopic && (
                            <div
                                className="data-catalog-research-ribbon-header"
                                onClick={() => addTopic(ribbon.title)}
                            >
                                <h3
                                    className="h3-bold data-catalog-research-ribbon-title"
                                    style={{ cursor: "pointer" }}
                                >
                                    {ribbon.title}
                                </h3>
                                {ribbon.nbHits > researchToShow && (
                                    <button className="data-catalog-research-ribbon-topic-filter">
                                        Show all {ribbon.nbHits} articles
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="data-catalog-ribbon-content">
                            <ul
                                className="data-catalog-research-ribbon-items grid grid-cols-1"
                                style={{ listStyleType: "none" }}
                            >
                                {ribbon.hits
                                    .slice(0, researchToShow)
                                    .map((hit) => (
                                        <li
                                            className="data-catalog-research-ribbon-item"
                                            key={hit.objectID}
                                        >
                                            <DataCatalogResearchHit hit={hit} />
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
