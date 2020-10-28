import * as React from "react"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { Spreadsheet } from "./Spreadsheet"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { ChartComponentClassMap } from "grapher/chart/ChartTypeMap"
import { OwidTableSlugs } from "coreTable/OwidTableConstants"

export default {
    title: "Spreadsheet",
    component: Spreadsheet,
}

const getRandomTable = () =>
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

    @action.bound private shuffleTable() {
        this.table = getRandomTable()
    }

    @computed get yColumnSlugs() {
        return this.table.suggestedYColumnSlugs
    }

    @computed get xColumnSlug() {
        return this.table.timeColumn?.slug
    }

    @observable chartTypeName = ChartTypeName.LineChart

    @computed get selection() {
        return this.table.availableEntityNames
    }

    @action.bound private changeChartType(type: ChartTypeName) {
        this.chartTypeName = type
    }

    render() {
        const ChartClass = ChartComponentClassMap.get(this.chartTypeName)!

        // Due to a bug with postcss (or maybe autoprefixer, or storybook, or webpack) we can't load the simple handsontable.css from the node_modules folder.
        // So for this story to work, just load it from the web.
        const css = (
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/handsontable/8.1.0/handsontable.css"
            />
        )

        return (
            <div>
                {css}
                <Spreadsheet manager={this} />
                <svg width={400} height={300}>
                    <ChartClass
                        manager={this}
                        bounds={new Bounds(0, 0, 400, 300)}
                    />
                </svg>
                <button onClick={this.shuffleTable}>Shuffle</button>
                <select
                    onChange={(event) =>
                        this.changeChartType(event.target.value as any)
                    }
                >
                    {Object.values(ChartTypeName).map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                </select>
            </div>
        )
    }
}

export const Default = () => <Editor />
