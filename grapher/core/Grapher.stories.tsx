import * as React from "react"
import { Grapher, GrapherProgrammaticInterface } from "./Grapher"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import {
    ChartTypeName,
    DimensionProperty,
    FacetStrategy,
    GrapherTabOption,
} from "./GrapherConstants"
import { BlankOwidTable } from "coreTable/OwidTable"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import { ChartTypeSwitcher } from "grapher/chart/ChartTypeSwitcher"

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

export const Line = () => <Grapher {...basics} />

export const SlopeChart = () => {
    const model = {
        type: ChartTypeName.SlopeChart,
        ...basics,
    }
    return <Grapher {...model} />
}

export const ScatterPlot = () => {
    const model = {
        type: ChartTypeName.ScatterPlot,
        ...basics,
    }
    return <Grapher {...model} />
}

export const DiscreteBar = () => {
    const model = {
        type: ChartTypeName.DiscreteBar,
        ...basics,
    }
    return <Grapher {...model} />
}

export const StackedBar = () => {
    const model = {
        type: ChartTypeName.StackedBar,
        ...basics,
    }
    return <Grapher {...model} />
}

export const StackedArea = () => {
    const model = {
        type: ChartTypeName.StackedArea,
        ...basics,
    }
    return <Grapher {...model} />
}

export const MapFirst = () => {
    const model = {
        ...basics,
        tab: GrapherTabOption.map,
    }
    return <Grapher {...model} />
}

export const BlankGrapher = () => {
    const model = {
        type: ChartTypeName.WorldMap,
        tab: GrapherTabOption.map,
        table: BlankOwidTable(),
        hasMapTab: true,
    }
    return <Grapher {...model} />
}

export const NoMap = () => {
    const model = {
        ...basics,
        hasMapTab: false,
    }
    return <Grapher {...model} />
}

export const Faceting = () => {
    const model = {
        type: ChartTypeName.StackedArea,
        facet: FacetStrategy.country,
        ...basics,
    }
    return <Grapher {...model} />
}

export const WithKeyboardShortcuts = () => {
    const model = {
        ...basics,
        enableKeyboardShortcuts: true,
    }
    return <Grapher {...model} />
}

export const WithAuthorTimeFilter = () => {
    const model: GrapherProgrammaticInterface = {
        ...basics,
        timelineMinTime: 1993,
        timelineMaxTime: 1996,
    }
    return <Grapher {...model} />
}

@observer
class PerfGrapher extends React.Component {
    @action.bound loadBigTable() {
        this.table = SynthesizeGDPTable({
            entityCount: 200,
            timeRange: [1500, 2000],
        })
    }

    @observable.ref table = basics.table!

    @action.bound private changeChartType(type: ChartTypeName) {
        this.chartTypeName = type
    }

    @observable chartTypeName = ChartTypeName.LineChart

    render() {
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
                    type={this.chartTypeName}
                    key={key}
                />
            </div>
        )
    }
}

export const Perf = () => <PerfGrapher />
