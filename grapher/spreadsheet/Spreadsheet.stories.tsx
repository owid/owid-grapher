import * as React from "react"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { Spreadsheet } from "./Spreadsheet"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { OwidTable } from "coreTable/OwidTable"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { ChartComponentClassMap } from "grapher/chart/ChartTypeMap"

export default {
    title: "Spreadsheet",
    component: Spreadsheet,
}

const getRandomTable = () =>
    SynthesizeGDPTable({
        entityCount: 2,
        timeRange: [2020, 2024],
    })
        .dropColumns([SampleColumnSlugs.GDP, SampleColumnSlugs.Population])
        .selectAll() as OwidTable

@observer
class Editor extends React.Component {
    @observable.ref table = getRandomTable()

    @action.bound private shuffleTable() {
        this.table = getRandomTable()
    }

    @computed get yColumnSlugs() {
        return [SampleColumnSlugs.LifeExpectancy]
    }

    @observable chartTypeName = ChartTypeName.LineChart

    render() {
        const ChartClass = ChartComponentClassMap.get(this.chartTypeName)!

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
            </div>
        )
    }
}

export const Default = () => <Editor />
