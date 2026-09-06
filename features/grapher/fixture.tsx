import { createRoot } from "react-dom/client"
import {
    renderSingleGrapherOnGrapherPage,
    latestGrapherConfigSchema,
} from "@ourworldindata/grapher"
import { DimensionProperty, EntitySelectionMode } from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"
import { MultiEmbedderSingleton } from "../../site/multiembedder/MultiEmbedder.js"
import MultiDim from "../../site/multiDim/MultiDim.js"
import "../../site/owid.scss"
import "./fixture.scss"

const mode = new URLSearchParams(location.search).get("fixture") ?? "standalone"
const root = document.getElementById("fixture")!
if (mode === "multi") {
    createRoot(root).render(
        <MultiDim
            config={MultiDimDataPageConfig.fromObject({
                title: { title: "Fixture views" },
                dimensions: [
                    {
                        slug: "metric",
                        name: "Metric",
                        choices: [
                            { slug: "first", name: "First metric" },
                            { slug: "second", name: "Second metric" },
                        ],
                    },
                ],
                views: [
                    {
                        dimensions: { metric: "first" },
                        indicators: { y: [{ id: 101 }] },
                        fullConfigId: "first",
                    },
                    {
                        dimensions: { metric: "second" },
                        indicators: { y: [{ id: 202 }] },
                        fullConfigId: "second",
                    },
                ],
            })}
            slug="fixture"
            queryStr={location.search}
        />
    )
} else {
    for (let i = 0; i < (mode === "embeds" ? 2 : 1); i++) {
        const figure = document.createElement("figure")
        figure.id = `chart-${i}`
        figure.setAttribute("data-grapher-src", "/grapher/fixture")
        root.append(figure)
    }
    if (mode === "embeds") MultiEmbedderSingleton.embedAll()
    else
        renderSingleGrapherOnGrapherPage({
            config: {
                $schema: latestGrapherConfigSchema,
                title: "Fixture chart",
                slug: "fixture",
                dimensions: [
                    { property: DimensionProperty.y, variableId: 101 },
                ],
                selectedEntityNames: ["France", "Germany"],
                hasMapTab: true,
                addCountryMode: EntitySelectionMode.MultipleEntities,
            },
            dataApiUrl: "/v1/indicators",
            catalogUrl: "/catalog",
        })
}
