import * as React from "react"
import { MapTooltip } from "./MapTooltip"
import { Grapher, GrapherProps } from "grapher/core/Grapher"

const config: GrapherProps = {
    hasMapTab: true,
    tab: "map",
    map: {
        timeTolerance: 5,
    },
    dimensions: [
        {
            variableId: 3512,
            property: "y",
            display: {
                name: "",
                unit: "% of children under 5",
                tolerance: 5,
                isProjection: false,
            },
        },
    ],
    owidDataset: {
        variables: {
            "3512": {
                years: [2000, 2010, 2010],
                entities: [207, 15, 207],
                values: [4, 20, 34],
                id: 3512,
                shortUnit: "%",
            },
        },
        entityKey: {
            "15": { name: "Afghanistan", id: 15, code: "AFG" },
            "207": { name: "Iceland", id: 207, code: "ISL" },
        },
    },
    queryStr: "?time=2002",
}

export default {
    title: "MapTooltip",
    component: MapTooltip,
}

export const Default = () => {
    // todo: refactor TooltipView stuff so we can decouple.
    return <Grapher {...config} />
}
