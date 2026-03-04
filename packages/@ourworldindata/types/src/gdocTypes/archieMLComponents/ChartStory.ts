import { EnrichedBlockChart } from "./Chart.js"
import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"
import { EnrichedBlockText } from "./Text.js"

export type RawChartStoryValue = {
    narrative?: string
    chart?: string
    technical?: { list?: string[] }
}

export type RawBlockChartStory = {
    type: "chart-story"
    value: RawChartStoryValue[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedChartStoryItem = {
    narrative: EnrichedBlockText
    chart: EnrichedBlockChart
    technical: EnrichedBlockText[]
}

export type EnrichedBlockChartStory = {
    type: "chart-story"
    items: EnrichedChartStoryItem[]
} & EnrichedBlockWithParseErrors
