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

/**
 * Which entities a tab shows, without and with picked countries
 *
 * `withoutPickedCountry`, when the reader hasn't picked a country:
 * - `defaultSelection`: the author's selection
 * - `defaultSelectionCapped`: the first `maxEntities` of the author's selection
 * - `dataRangePeers`: an even spread of `maxEntities` by value
 *
 * `withPickedCountry`, when the reader has picked one or more countries:
 * - `pickedOnly`: the picked countries
 * - `pickedFocused`: the picked countries, focused
 * - `peers`: the picked countries, focused, plus peers up to `maxEntities`
 * - `defaultSelectionCapped`: the picked countries, focused, plus the author's selection up to `maxEntities`
 */
type EntitySelectionRule =
    | {
          withoutPickedCountry: "defaultSelection"
          withPickedCountry: "pickedOnly"
      }
    | {
          withoutPickedCountry: "dataRangePeers"
          withPickedCountry: "pickedFocused" | "peers"
          shouldClearPreviewSelectionWithoutPickedCountry?: boolean
          maxEntities: number
      }
    | {
          withoutPickedCountry: "defaultSelectionCapped"
          withPickedCountry: "defaultSelectionCapped"
          maxEntities: number
      }

// oxfmt-ignore
const ENTITY_SELECTION_BY_TAB: Record<GrapherTabName, EntitySelectionRule> = {
    [GRAPHER_TAB_NAMES.LineChart]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 4 },
    [GRAPHER_TAB_NAMES.SlopeChart]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 4 },
    [GRAPHER_TAB_NAMES.DiscreteBar]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 6 },
    [GRAPHER_TAB_NAMES.StackedDiscreteBar]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 6 },
    [GRAPHER_TAB_NAMES.Dumbbell]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "peers", maxEntities: 6 },
    [GRAPHER_TAB_NAMES.Swimlane]: { withoutPickedCountry: "defaultSelectionCapped", withPickedCountry: "defaultSelectionCapped", maxEntities: 6 },
    [GRAPHER_TAB_NAMES.Marimekko]: { withoutPickedCountry: "dataRangePeers", withPickedCountry: "pickedFocused", maxEntities: 3, shouldClearPreviewSelectionWithoutPickedCountry: true },
    [GRAPHER_TAB_NAMES.ScatterPlot]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
    [GRAPHER_TAB_NAMES.StackedArea]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
    [GRAPHER_TAB_NAMES.StackedBar]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
    [GRAPHER_TAB_NAMES.WorldMap]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
    [GRAPHER_TAB_NAMES.Table]: { withoutPickedCountry: "defaultSelection", withPickedCountry: "pickedOnly" },
}

export function toAllChartsBlockGrapherParams({
    tab,
    countries,
    target,
}: {
    tab: GrapherTabName
    countries: string[]
    target: "thumbnail" | "preview"
}): GrapherQueryParams {
    return {
        ...toGrapherQueryParams({ tab, entities: countries }),
        ...toPeerQueryParams(ENTITY_SELECTION_BY_TAB[tab], countries, target),
    }
}

function toPeerQueryParams(
    rule: EntitySelectionRule,
    pickedCountries: string[],
    target: "thumbnail" | "preview"
): GrapherQueryParams {
    return pickedCountries.length === 0
        ? toPeerQueryParamsWithoutPickedCountry(rule, target)
        : toPeerQueryParamsWithPickedCountry(rule, pickedCountries)
}

function toPeerQueryParamsWithoutPickedCountry(
    rule: EntitySelectionRule,
    target: "thumbnail" | "preview"
): GrapherQueryParams {
    return match(rule)
        .with({ withoutPickedCountry: "defaultSelection" }, () => ({}))
        .with({ withoutPickedCountry: "defaultSelectionCapped" }, (rule) => ({
            country: "",
            peerCountries: PeerCountryStrategy.DefaultSelection,
            peerCount: String(rule.maxEntities),
        }))
        .with({ withoutPickedCountry: "dataRangePeers" }, (rule) =>
            target === "preview" &&
            rule.shouldClearPreviewSelectionWithoutPickedCountry
                ? { country: "" }
                : {
                      country: "",
                      peerCountries: PeerCountryStrategy.DataRange,
                      peerCount: String(rule.maxEntities),
                  }
        )
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
            "defaultSelectionCapped",
            () => PeerCountryStrategy.DefaultSelection
        )
        .exhaustive()

    return {
        peerCountries,
        peerCount: String(peerCount),
        focus,
    }
}
