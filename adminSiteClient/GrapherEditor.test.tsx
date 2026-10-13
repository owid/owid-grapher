/**
 * @vitest-environment happy-dom
 */
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { runInAction } from "mobx"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
    ColumnTypeNames,
    DimensionProperty,
    type GrapherInterface,
} from "@ourworldindata/types"
import { GrapherEditor, type GrapherEditorProps } from "./GrapherEditor.js"
import { csvIndicatorStore, type IndicatorStore } from "./indicatorStores.js"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const config: GrapherInterface = {
    title: "Rents",
    dimensions: [{ property: DimensionProperty.y, slug: "rent_index" }],
}

function rentStore(): IndicatorStore {
    return csvIndicatorStore({
        csv: "entityName,year,rent_index\nBerlin,2015,100\nBerlin,2020,131",
        columnDefs: [
            {
                slug: "rent_index",
                type: ColumnTypeNames.Numeric,
                name: "Rent index",
            },
        ],
    })
}

const roots: Root[] = []

afterEach(async () => {
    for (const root of roots.splice(0)) await act(async () => root.unmount())
})

async function mountEditor(
    props: Partial<GrapherEditorProps>,
    { strict = false } = {}
): Promise<GrapherEditor> {
    const ref = React.createRef<GrapherEditor>()
    const root = createRoot(
        document.body.appendChild(document.createElement("div"))
    )
    roots.push(root)
    const element = (
        <GrapherEditor
            ref={ref}
            config={config}
            store={rentStore()}
            onSave={() => undefined}
            {...props}
        />
    )
    await act(async () =>
        root.render(
            strict ? <React.StrictMode>{element}</React.StrictMode> : element
        )
    )
    await vi.waitFor(() =>
        expect(ref.current?.editor.grapherState.title).toBe("Rents")
    )
    return ref.current!
}

async function loadData(view: GrapherEditor): Promise<void> {
    await vi.waitFor(() =>
        expect(view.editor.grapherState.inputTable.numRows).toBeGreaterThan(0)
    )
}

async function editTitle(view: GrapherEditor): Promise<void> {
    await act(async () =>
        runInAction(() => {
            view.editor.grapherState.title = "Edited"
        })
    )
}

describe("GrapherEditor callbacks", () => {
    it("reports the loaded config, and no unsaved changes until it's edited", async () => {
        const onChange = vi.fn<(config: GrapherInterface) => void>()
        const onDirtyChange = vi.fn<(isModified: boolean) => void>()
        const view = await mountEditor({ onChange, onDirtyChange })
        await loadData(view)

        expect(onChange.mock.lastCall?.[0]).toMatchObject({ title: "Rents" })
        expect(onDirtyChange).not.toHaveBeenCalled()

        await editTitle(view)
        expect(onChange.mock.lastCall?.[0]).toMatchObject({ title: "Edited" })
        expect(onDirtyChange.mock.calls).toEqual([[true]])
    })

    it("keeps reporting edits when rendered in StrictMode", async () => {
        const onChange = vi.fn<(config: GrapherInterface) => void>()
        const onDirtyChange = vi.fn<(isModified: boolean) => void>()
        const view = await mountEditor(
            { onChange, onDirtyChange },
            { strict: true }
        )
        await loadData(view)

        await editTitle(view)
        expect(onDirtyChange.mock.calls).toEqual([[true]])
        expect(onChange.mock.lastCall?.[0]).toMatchObject({ title: "Edited" })
    })

    it("blocks the form until the chart's data has loaded", async () => {
        const store = rentStore()
        const pendingLoads: (() => void)[] = []
        const slowStore: IndicatorStore = {
            ...store,
            loadTable: (...args) =>
                new Promise((resolve) =>
                    pendingLoads.push(() => resolve(store.loadTable(...args)))
                ),
        }
        const view = await mountEditor({ store: slowStore })
        const blocker = (): Element | null =>
            document.querySelector(".LoadingBlocker")

        await vi.waitFor(() => expect(blocker()).toBeTruthy(), {
            timeout: 3000,
        })
        await act(async () =>
            pendingLoads.forEach((finishLoad) => finishLoad())
        )
        await loadData(view)
        await vi.waitFor(() => expect(blocker()).toBeNull(), { timeout: 3000 })
    })

    it("doesn't count loading the config as an edit while its data loads", async () => {
        const onDirtyChange = vi.fn<(isModified: boolean) => void>()
        const neverLoads: IndicatorStore = {
            ...rentStore(),
            loadTable: () => new Promise(() => undefined),
        }
        const view = await mountEditor({ onDirtyChange, store: neverLoads })

        expect(view.editor.isModified).toBe(false)
        expect(onDirtyChange).not.toHaveBeenCalled()
    })
})
