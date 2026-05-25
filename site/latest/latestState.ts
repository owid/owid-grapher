import { LatestState, LatestUrlParam } from "@ourworldindata/types"
import { deserializeSet, serializeSet } from "../search/searchUtils.js"
import { decodeLatestType } from "./latestUtils.js"

// Whitelist + validate /latest URL params. Topics not present in `allAreas`
// are dropped; an unrecognized `type` becomes null. The pair with
// `stateToSearchParams` lets the SPA canonicalize the URL the same way
// /search does (see site/search/searchState.ts).
export function searchParamsToState(
    searchParams: URLSearchParams,
    allAreas: string[]
): LatestState {
    const topics = [
        ...deserializeSet(searchParams.get(LatestUrlParam.TOPICS)).intersection(
            new Set(allAreas)
        ),
    ]
    return {
        topics,
        latestType: decodeLatestType(searchParams.get(LatestUrlParam.TYPE)),
    }
}

export function stateToSearchParams(state: LatestState): URLSearchParams {
    const params = new URLSearchParams()
    const topics = serializeSet(new Set(state.topics))
    if (topics) params.set(LatestUrlParam.TOPICS, topics)
    if (state.latestType) params.set(LatestUrlParam.TYPE, state.latestType)
    return params
}

export function urlNeedsSanitization(
    searchParams: URLSearchParams,
    state: LatestState
): boolean {
    return searchParams.toString() !== stateToSearchParams(state).toString()
}
