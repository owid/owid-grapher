/**
 * @vitest-environment happy-dom
 */

import { act, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import type { GrapherState } from "./GrapherState.js"
import { FetchingGrapher, FetchingGrapherProps } from "./FetchingGrapher.js"

const rendered = vi.hoisted(() => ({
    grapherState: undefined as GrapherState | undefined,
}))

vi.mock(import("./Grapher.js"), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        Grapher: (({ grapherState }: { grapherState: GrapherState }) => {
            rendered.grapherState = grapherState
            return null
        }) as unknown as typeof actual.Grapher,
    }
})

vi.mock(import("./loadGrapherTableHelpers.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    fetchInputTableForConfig: async (): Promise<undefined> => undefined,
}))

afterEach(() => {
    vi.unstubAllGlobals()
})

const URL_PROPS: Omit<FetchingGrapherProps, "queryStr"> = {
    dataApiUrl: "",
    catalogUrl: "",
    archiveContext: undefined,
}

it("applies a changed queryStr to the same grapher state, as if freshly loaded", () => {
    const props: Omit<FetchingGrapherProps, "queryStr"> = {
        ...URL_PROPS,
        config: {
            chartTypes: ["LineChart"],
            hasMapTab: true,
            selectedEntityNames: ["France"],
        },
    }
    const { rerender } = render(
        <FetchingGrapher
            {...props}
            queryStr="?tab=line&country=~Germany&focus=~Germany"
        />
    )
    const grapherState = rendered.grapherState
    expect(grapherState?.activeTab).toBe(GRAPHER_TAB_NAMES.LineChart)
    expect(grapherState?.selection.selectedEntityNames).toEqual(["Germany"])
    expect(grapherState?.focusArray.seriesNames).toEqual(["Germany"])

    rerender(<FetchingGrapher {...props} queryStr="?tab=map" />)

    expect(grapherState?.activeTab).toBe(GRAPHER_TAB_NAMES.WorldMap)
    expect(grapherState?.selection.selectedEntityNames).toEqual(["France"])
    expect(grapherState?.focusArray.seriesNames).toEqual([])
})

it("keeps a queryStr that changed while the config was still loading", async () => {
    let resolveConfig = (_config: object): void => undefined
    const config = new Promise<object>((resolve) => {
        resolveConfig = resolve
    })
    vi.stubGlobal("fetch", async (): Promise<unknown> => ({
        json: () => config,
    }))
    const props = { ...URL_PROPS, configUrl: "https://example.com/config.json" }
    const { rerender } = render(
        <FetchingGrapher {...props} queryStr="?tab=line" />
    )
    rerender(<FetchingGrapher {...props} queryStr="?tab=map" />)

    await act(async () =>
        resolveConfig({ chartTypes: ["LineChart"], hasMapTab: true })
    )

    expect(rendered.grapherState?.activeTab).toBe(GRAPHER_TAB_NAMES.WorldMap)
})
