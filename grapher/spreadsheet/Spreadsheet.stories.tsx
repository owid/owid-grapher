import * as React from "react"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { Spreadsheet } from "./Spreadsheet"
// import "handsontable/dist/handsontable.full.css" // todo: this breaks storybook/webpack build. but without it this story is useless
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import { StackedAreaChart } from "grapher/stackedCharts/StackedAreaChart"
import { Bounds } from "grapher/utils/Bounds"
import { OwidTable } from "coreTable/OwidTable"

export default {
    title: "Spreadsheet",
    component: Spreadsheet,
}

const getRandomTable = () =>
    SynthesizeGDPTable({
        entityCount: 2,
        timeRange: [2000, 2005],
    })
        .dropRandomRows(3)
        .withoutColumns([SampleColumnSlugs.GDP, SampleColumnSlugs.Population])
        .selectAll() as OwidTable

@observer
class Editor extends React.Component {
    @observable.ref table = getRandomTable()

    @action.bound private shuffleTable() {
        this.table = getRandomTable()
    }

    render() {
        return (
            <div>
                <Spreadsheet manager={this} />
                <svg width={400} height={300}>
                    <StackedAreaChart
                        manager={this}
                        bounds={new Bounds(0, 0, 400, 300)}
                    />
                </svg>
                <button onClick={this.shuffleTable}>Shuffle</button>
                <pre>${this.table.toAlignedTextTable()}</pre>
            </div>
        )
    }
}

export const Default = () => <Editor />
