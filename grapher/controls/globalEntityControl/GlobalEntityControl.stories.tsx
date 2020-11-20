import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { Explorer } from "explorer/client/Explorer"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import * as React from "react"
import { GlobalEntityControl } from "./GlobalEntityControl"
import { GlobalEntitySelection } from "./GlobalEntitySelection"

// We create a "Page" mock, because it never makes sense to have a global entity control not attached to a page.
class GlobalEntityControlPage extends React.Component<{ explorers?: boolean }> {
    render() {
        if (this.props.explorers) return this.renderExplorers()
        const table = SynthesizeGDPTable({ entityCount: 10 })
        const basics: GrapherProgrammaticInterface = {
            table,
            selectedEntityNames: table.sampleEntityName(5),
            ySlugs: SampleColumnSlugs.GDP,
        }
        const selection = new GlobalEntitySelection()
        const stackedBar = {
            type: ChartTypeName.StackedBar,
            ...basics,
        }
        const stackedArea = {
            type: ChartTypeName.StackedArea,
            ...basics,
        }
        return (
            <div>
                <GlobalEntityControl globalEntitySelection={selection} />
                <Grapher {...stackedBar} />
                <Grapher {...stackedArea} />
            </div>
        )
    }

    private renderExplorers() {
        const selection = new GlobalEntitySelection()
        return (
            <div>
                <GlobalEntityControl globalEntitySelection={selection} />
                <Explorer slug="" program="" />
            </div>
        )
    }
}

export default {
    title: "GlobalEntityControl",
    component: GlobalEntityControl,
}

export const WithNoGraphers = () => {
    const selection = new GlobalEntitySelection()
    return <GlobalEntityControl globalEntitySelection={selection} />
}

export const WithGraphers = () => <GlobalEntityControlPage />
export const WithExplorers = () => <GlobalEntityControlPage explorers={true} />
