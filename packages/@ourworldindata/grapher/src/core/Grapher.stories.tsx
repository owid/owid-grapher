import React from "react"
import { Grapher, GrapherProgrammaticInterface } from "./Grapher"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
    BlankOwidTable,
} from "@ourworldindata/core-table"
import {
    GRAPHER_CHART_TYPES,
    FacetStrategy,
    GRAPHER_TAB_OPTIONS,
} from "@ourworldindata/types"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import { ChartTypeSwitcher } from "../chart/ChartTypeSwitcher"
import { DimensionProperty } from "@ourworldindata/utils"

export default {
    title: "Grapher",
    component: Grapher,
}

const table = SynthesizeGDPTable({ entityCount: 10 })
const basics: GrapherProgrammaticInterface = {
    table,
    selectedEntityNames: table.sampleEntityName(5),
    hasMapTab: true,
    yAxis: {
        canChangeScaleType: true,
    },
    xAxis: {
        canChangeScaleType: true,
    },
    dimensions: [
        {
            slug: SampleColumnSlugs.GDP,
            property: DimensionProperty.y,
            variableId: SampleColumnSlugs.GDP as any,
        },
        {
            slug: SampleColumnSlugs.Population,
            property: DimensionProperty.x,
            variableId: SampleColumnSlugs.Population as any,
        },
    ],
}

export const Line = (): React.ReactElement => <Grapher {...basics} />

export const SlopeChart = (): React.ReactElement => {
    const model = {
        chartTypes: [GRAPHER_CHART_TYPES.SlopeChart],
        ...basics,
    }
    return <Grapher {...model} />
}

export const ScatterPlot = (): React.ReactElement => {
    const model = {
        chartTypes: [GRAPHER_CHART_TYPES.ScatterPlot],
        ...basics,
    }
    return <Grapher {...model} />
}

export const DiscreteBar = (): React.ReactElement => {
    const model = {
        chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        ...basics,
    }
    return <Grapher {...model} />
}

export const StackedBar = (): React.ReactElement => {
    const model = {
        chartTypes: [GRAPHER_CHART_TYPES.StackedBar],
        ...basics,
    }
    return <Grapher {...model} />
}

export const StackedArea = (): React.ReactElement => {
    const model = {
        chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
        ...basics,
    }
    return <Grapher {...model} />
}

export const MapFirst = (): React.ReactElement => {
    const model = {
        ...basics,
        tab: GRAPHER_TAB_OPTIONS.map,
    }
    return <Grapher {...model} />
}

export const BlankGrapher = (): React.ReactElement => {
    const model = {
        tab: GRAPHER_TAB_OPTIONS.map,
        table: BlankOwidTable(),
        hasMapTab: true,
    }
    return <Grapher {...model} />
}

export const NoMap = (): React.ReactElement => {
    const model = {
        ...basics,
        hasMapTab: false,
    }
    return <Grapher {...model} />
}

export const Faceting = (): React.ReactElement => {
    const model = {
        chartTypes: [GRAPHER_CHART_TYPES.StackedArea],
        facet: FacetStrategy.entity,
        ...basics,
    }
    return <Grapher {...model} />
}

export const WithAuthorTimeFilter = (): React.ReactElement => {
    const model: GrapherProgrammaticInterface = {
        ...basics,
        timelineMinTime: 1993,
        timelineMaxTime: 1996,
    }
    return <Grapher {...model} />
}

@observer
class PerfGrapher extends React.Component {
    @action.bound loadBigTable(): void {
        this.table = SynthesizeGDPTable({
            entityCount: 200,
            timeRange: [1500, 2000],
        })
    }

    @observable.ref table = basics.table!

    @action.bound private changeChartType(type: GRAPHER_CHART_TYPES): void {
        this.chartTypeName = type
    }

    @observable chartTypeName = GRAPHER_CHART_TYPES.LineChart

    render(): React.ReactElement {
        const key = Math.random() // I do this hack to force a rerender until can re-add the grapher model/grapher view that we used to have. @breck 10/29/2020
        return (
            <div>
                <div>
                    <button onClick={this.loadBigTable}>
                        Big Table for Perf
                    </button>
                    <ChartTypeSwitcher onChange={this.changeChartType} />
                </div>
                <Grapher
                    {...basics}
                    table={this.table}
                    chartTypes={[this.chartTypeName]}
                    key={key}
                />
            </div>
        )
    }
}

export const Perf = (): React.ReactElement => <PerfGrapher />
