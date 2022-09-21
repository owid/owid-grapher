import React from "react"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "../../coreTable/OwidTableSynthesizers.js"
import { Spreadsheet } from "./Spreadsheet.js"
import { action, computed, observable, makeObservable } from "mobx";
import { observer } from "mobx-react"
import { Bounds } from "../../clientUtils/Bounds.js"
import { ChartTypeName } from "../core/GrapherConstants.js"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap.js"
import { OwidTableSlugs } from "../../coreTable/OwidTableConstants.js"
import { ChartTypeSwitcher } from "../chart/ChartTypeSwitcher.js"
import { OwidTable } from "../../coreTable/OwidTable.js"

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

class Editor extends React.Component {
    table = getRandomTable();

    constructor(props) {
        super(props);

        makeObservable<Editor, "shuffleTable" | "changeChartType">(this, {
            table: observable.ref,
            shuffleTable: action.bound,
            yColumnSlugs: computed,
            xColumnSlug: computed,
            chartTypeName: observable,
            selection: computed,
            changeChartType: action.bound
        });
    }

    private shuffleTable(): void {
        this.table = getRandomTable()
    }

    get yColumnSlugs(): string[] {
        return this.table.suggestedYColumnSlugs
    }

    get xColumnSlug(): string {
        return this.table.timeColumn?.slug
    }

    chartTypeName = ChartTypeName.LineChart;

    get selection(): any[] {
        return this.table.availableEntityNames
    }

    private changeChartType(type: ChartTypeName): void {
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
