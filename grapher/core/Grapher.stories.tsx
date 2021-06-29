import * as React from "react"
import { Grapher, GrapherProgrammaticInterface } from "./Grapher"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "../../coreTable/OwidTableSynthesizers"
import {
    ChartTypeName,
    FacetStrategy,
    GrapherTabOption,
} from "./GrapherConstants"
import { BlankOwidTable } from "../../coreTable/OwidTable"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import { ChartTypeSwitcher } from "../chart/ChartTypeSwitcher"
import { DimensionProperty } from "../../clientUtils/owidTypes"

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

export const Line = (): JSX.Element => <Grapher {...basics} />

export const SlopeChart = (): JSX.Element => {
    const model = {
        type: ChartTypeName.SlopeChart,
        ...basics,
    }
    return <Grapher {...model} />
}

export const ScatterPlot = (): JSX.Element => {
    const model = {
        type: ChartTypeName.ScatterPlot,
        ...basics,
    }
    return <Grapher {...model} />
}

export const DiscreteBar = (): JSX.Element => {
    const model = {
        type: ChartTypeName.DiscreteBar,
        ...basics,
    }
    return <Grapher {...model} />
}

export const StackedBar = (): JSX.Element => {
    const model = {
        type: ChartTypeName.StackedBar,
        ...basics,
    }
    return <Grapher {...model} />
}

export const StackedArea = (): JSX.Element => {
    const model = {
        type: ChartTypeName.StackedArea,
        ...basics,
    }
    return <Grapher {...model} />
}

export const MapFirst = (): JSX.Element => {
    const model = {
        ...basics,
        tab: GrapherTabOption.map,
    }
    return <Grapher {...model} />
}

export const BlankGrapher = (): JSX.Element => {
    const model = {
        type: ChartTypeName.WorldMap,
        tab: GrapherTabOption.map,
        table: BlankOwidTable(),
        hasMapTab: true,
    }
    return <Grapher {...model} />
}

export const NoMap = (): JSX.Element => {
    const model = {
        ...basics,
        hasMapTab: false,
    }
    return <Grapher {...model} />
}

export const Faceting = (): JSX.Element => {
    const model = {
        type: ChartTypeName.StackedArea,
        facet: FacetStrategy.entity,
        ...basics,
    }
    return <Grapher {...model} />
}

export const WithAuthorTimeFilter = (): JSX.Element => {
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

    @action.bound private changeChartType(type: ChartTypeName): void {
        this.chartTypeName = type
    }

    @observable chartTypeName = ChartTypeName.LineChart

    render(): JSX.Element {
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

export const Perf = (): JSX.Element => <PerfGrapher />
