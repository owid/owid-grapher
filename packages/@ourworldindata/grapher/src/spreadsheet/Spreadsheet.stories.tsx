import React from "react"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
    OwidTableSlugs,
    OwidTable,
} from "@ourworldindata/core-table"
import { Spreadsheet } from "./Spreadsheet.js"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "@ourworldindata/utils"
import { ChartTypeName } from "../core/GrapherConstants.js"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap.js"
import { ChartTypeSwitcher } from "../chart/ChartTypeSwitcher.js"

export default {
    title: "Spreadsheet",
    component: Spreadsheet,
}

const getRandomTable = (): OwidTable =>
    SynthesizeGDPTable({
        entityCount: 2,
        timeRange: [2020, 2024],
    })
        .dropColumns([
            SampleColumnSlugs.GDP,
            SampleColumnSlugs.Population,
            OwidTableSlugs.entityCode,
            OwidTableSlugs.entityId,
        ])
        .sortColumns([OwidTableSlugs.entityName, OwidTableSlugs.year])

@observer
class Editor extends React.Component {
    @observable.ref table = getRandomTable()

    @action.bound private shuffleTable(): void {
        this.table = getRandomTable()
    }

    @computed get yColumnSlugs(): string[] {
        return this.table.suggestedYColumnSlugs
    }

    @computed get xColumnSlug(): string {
        return this.table.timeColumn?.slug
    }

    @observable chartTypeName = ChartTypeName.LineChart

    @computed get selection(): any[] {
        return this.table.availableEntityNames
    }

    @action.bound private changeChartType(type: ChartTypeName): void {
        this.chartTypeName = type
    }

    render(): JSX.Element {
        const ChartClass =
            ChartComponentClassMap.get(this.chartTypeName) ?? DefaultChartClass

        return (
            <div>
                <Spreadsheet manager={this} />
                <svg width={400} height={300}>
                    <ChartClass
                        manager={this}
                        bounds={new Bounds(0, 0, 400, 300)}
                    />
                </svg>
                <button onClick={this.shuffleTable}>Shuffle</button>
                <ChartTypeSwitcher onChange={this.changeChartType} />
            </div>
        )
    }
}

export const Default = (): JSX.Element => <Editor />
