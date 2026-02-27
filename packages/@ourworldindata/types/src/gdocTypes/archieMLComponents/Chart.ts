import { PeerCountryStrategyQueryParam } from "../../grapherTypes/GrapherTypes.js"
import {
    BlockSize,
    BlockVisibility,
    EnrichedBlockWithParseErrors,
} from "./generic.js"
import { Span } from "../Spans.js"

export type RawBlockChartValue = {
    url?: string
    height?: string
    size?: BlockSize
    // TODO: position is used as a classname apparently? Should be renamed or split
    position?: string
    caption?: string
    visibility?: string
    peerCountries?: string
}

export type RawBlockChart = {
    type: "chart"
    value: RawBlockChartValue | string
}

export type EnrichedBlockChart = {
    type: "chart"
    url: string
    height?: string
    size: BlockSize
    caption?: Span[]
    visibility?: BlockVisibility
    peerCountries?: PeerCountryStrategyQueryParam
} & EnrichedBlockWithParseErrors
