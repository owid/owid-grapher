import { generateFocusedSeriesNamesParam } from "@ourworldindata/grapher"
import {
    GRAPHER_TAB_NAMES,
    PeerCountryStrategy,
    type PeerCountryStrategyQueryParam,
    type GrapherQueryParams,
    type GrapherTabName,
} from "@ourworldindata/types"
import { toGrapherQueryParams } from "../search/searchUtils.js"
import { match } from "ts-pattern"

type EntitySelectionRule =
    | {
          withoutPickedCountry: "defaultSelection"
          withPickedCountry: "pickedOnly"
      }
    | {
          withoutPickedCountry: "dataRangePeers"
          withPickedCountry: "pickedFocused" | "peers"
          maxEntities: number
      }
    | {
          withoutPickedCountry: "defaultSelection"
          withPickedCountry: "peers"
          maxEntities: number
      }
    | {
          withoutPickedCountry: "defaultSelectionPeers"
          withPickedCountry: "defaultSelectionPeers"
          maxEntities: number
      }

// oxfmt-ignore
const ENTITY_SELECTION_BY_TAB: Record<GrapherTabName, EntitySelectionRule> = {
    [GRAPHER_TAB_NAMES.LineChart]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 4 },
    [GRAPHER_TAB_NAMES.SlopeChart]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 4 },
    [GRAPHER_TAB_NAMES.DiscreteBar]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 6 },
    [GRAPHER_TAB_NAMES.StackedDiscreteBar]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 6 },
    [GRAPHER_TAB_NAMES.Dumbbell]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 6 },
    [GRAPHER_TAB_NAMES.Swimlane]: { withoutPickedCountry: "defaultSelectionPeers", withPickedCountry: "defaultSelectionPeers", maxEntities: 6 },
    [GRAPHER_TAB_NAMES.Marimekko]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "pickedFocused", maxEntities: 3 },
    [GRAPHER_TAB_NAMES.ScatterPlot]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
    [GRAPHER_TAB_NAMES.StackedArea]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
    [GRAPHER_TAB_NAMES.StackedBar]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
    [GRAPHER_TAB_NAMES.WorldMap]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
    [GRAPHER_TAB_NAMES.Table]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
}

export function toAllChartsGrapherParams({
    tab,
    countries,
}: {
    tab: GrapherTabName
    countries: string[]
}): GrapherQueryParams {
    return {
        ...toGrapherQueryParams({ tab, entities: countries }),
        ...toPeerQueryParams(ENTITY_SELECTION_BY_TAB[tab], countries),
    }
}

function toPeerQueryParams(
    rule: EntitySelectionRule,
    pickedCountries: string[]
): GrapherQueryParams {
    return pickedCountries.length === 0
        ? toPeerQueryParamsWithoutPickedCountry(rule)
        : toPeerQueryParamsWithPickedCountry(rule, pickedCountries)
}

function toPeerQueryParamsWithoutPickedCountry(
    rule: EntitySelectionRule
): GrapherQueryParams {
    return match(rule)
        .with({ withoutPickedCountry: "dataRangePeers" }, (rule) => ({
            country: "",
            peerCountries: PeerCountryStrategy.DataRange,
            peerCount: String(rule.maxEntities),
        }))
        .with({ withoutPickedCountry: "defaultSelectionPeers" }, (rule) => ({
            country: "",
            peerCountries: PeerCountryStrategy.DefaultSelection,
            peerCount: String(rule.maxEntities),
        }))
        .with({ withoutPickedCountry: "defaultSelection" }, () => ({}))
        .exhaustive()
}

function toPeerQueryParamsWithPickedCountry(
    rule: EntitySelectionRule,
    pickedCountries: string[]
): GrapherQueryParams {
    const focus = generateFocusedSeriesNamesParam(pickedCountries)

    if (rule.withPickedCountry === "pickedOnly") return {}
    if (rule.withPickedCountry === "pickedFocused") return { focus }

    const peerCount = rule.maxEntities - pickedCountries.length
    if (peerCount <= 0) return {}

    const peerCountries = match(rule.withPickedCountry)
        .returnType<PeerCountryStrategyQueryParam>()
        .with("peers", () => "auto")
        .with(
            "defaultSelectionPeers",
            () => PeerCountryStrategy.DefaultSelection
        )
        .exhaustive()

    return {
        peerCountries,
        peerCount: String(peerCount),
        focus,
    }
}
