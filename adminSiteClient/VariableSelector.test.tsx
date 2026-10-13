/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { DimensionSlot } from "@ourworldindata/grapher"
import { VariableSelector } from "./VariableSelector.js"
import {
    CatalogDataset,
    IndicatorCatalog,
    IndicatorSearchPage,
} from "./editorProviders.js"

function slotOf(
    dimensions: {
        variableId?: number
        columnSlug: string
        name: string
        datasetId?: number
    }[],
    { allowMultiple = true } = {}
): DimensionSlot {
    return {
        name: "Y axis",
        allowMultiple,
        dimensions: dimensions.map(({ name, datasetId, ...dimension }) => ({
            ...dimension,
            column: { name, datasetId, datasetName: undefined },
        })),
    } as unknown as DimensionSlot
}

const energy: CatalogDataset = {
    id: 3,
    name: "Energy",
    matchCount: 4,
    variables: [
        { id: 10, name: "Coal", datasetName: "Energy" },
        { id: 11, name: "Oil", datasetName: "Energy" },
    ],
}

function pageOf(...datasets: CatalogDataset[]): IndicatorSearchPage {
    return { datasets, unit: "datasets", total: datasets.length, pageSize: 8 }
}

function fakeCatalog(
    search: IndicatorCatalog["search"] = () => Promise.resolve(pageOf(energy))
): IndicatorCatalog & { search: ReturnType<typeof vi.fn> } {
    return {
        fields: [],
        initialQuery: (datasetIds) =>
            datasetIds.length ? `dataset-id:${datasetIds.join(",")}` : "",
        search: vi.fn(search),
    }
}

function renderSelector(
    catalog: IndicatorCatalog,
    slot: DimensionSlot
): {
    onComplete: ReturnType<typeof vi.fn>
    onDismiss: ReturnType<typeof vi.fn>
} {
    const onComplete = vi.fn()
    const onDismiss = vi.fn()
    render(
        <VariableSelector
            catalog={catalog}
            slot={slot}
            onComplete={onComplete}
            onDismiss={onDismiss}
        />
    )
    return { onComplete, onDismiss }
}

const searchBox = (): HTMLInputElement =>
    screen.getByPlaceholderText("Search indicators...")

const isTicked = (name: string): boolean =>
    (
        within(
            document.querySelector<HTMLElement>(".VariableSelector__results")!
        ).getByLabelText(name) as HTMLInputElement
    ).checked

const chosenNames = (): string[] =>
    [...document.querySelectorAll(".VariableSelector__chosen-item")].map(
        (item) => item.textContent ?? ""
    )

describe(VariableSelector, () => {
    it("opens on the search the catalog suggests for the slot's datasets, with the slot's indicators ticked", async () => {
        const catalog = fakeCatalog()
        renderSelector(
            catalog,
            slotOf([
                {
                    variableId: 10,
                    columnSlug: "10",
                    name: "Coal",
                    datasetId: 3,
                },
            ])
        )

        expect(searchBox().value).toBe("dataset-id:3")
        expect(catalog.search).toHaveBeenCalledWith("dataset-id:3", 1)
        expect(chosenNames()).toEqual(["Coal"])
        await screen.findByLabelText("Oil")
        expect(isTicked("Coal")).toBe(true)
        expect(isTicked("Oil")).toBe(false)
    })

    it("returns the ticked indicators in the order they were picked, a host table's columns by slug", async () => {
        const table: CatalogDataset = {
            id: 1,
            name: "housing.csv",
            variables: [{ id: 1, slug: "rent_index", name: "Rent index" }],
        }
        const { onComplete } = renderSelector(
            fakeCatalog(() => Promise.resolve(pageOf(energy, table))),
            slotOf([{ variableId: 10, columnSlug: "10", name: "Coal" }])
        )

        fireEvent.click(await screen.findByLabelText("Rent index"))
        fireEvent.click(screen.getByLabelText("Oil"))
        fireEvent.click(screen.getByRole("button", { name: "Set variables" }))

        expect(onComplete).toHaveBeenCalledWith([
            { variableId: 10 },
            { slug: "rent_index" },
            { variableId: 11 },
        ])
    })

    it("swaps the indicator of a slot that takes one", async () => {
        const { onComplete } = renderSelector(
            fakeCatalog(),
            slotOf([{ variableId: 10, columnSlug: "10", name: "Coal" }], {
                allowMultiple: false,
            })
        )

        fireEvent.click(await screen.findByLabelText("Oil"))
        expect(chosenNames()).toEqual(["Oil Energy"])
        fireEvent.click(screen.getByRole("button", { name: "Set variable" }))
        expect(onComplete).toHaveBeenCalledWith([{ variableId: 11 }])
    })

    it("unticking in the selected list removes the indicator", async () => {
        const { onComplete } = renderSelector(
            fakeCatalog(),
            slotOf([{ variableId: 10, columnSlug: "10", name: "Coal" }])
        )
        await screen.findByLabelText("Oil")

        const chosen = document.querySelector(
            ".VariableSelector__chosen-item input"
        ) as HTMLInputElement
        fireEvent.click(chosen)

        expect(chosenNames()).toEqual([])
        expect(isTicked("Coal")).toBe(false)
        fireEvent.click(screen.getByRole("button", { name: "Set variables" }))
        expect(onComplete).toHaveBeenCalledWith([])
    })

    it("narrows to a dataset in place when its 'more' link is followed", async () => {
        const catalog = fakeCatalog()
        renderSelector(catalog, slotOf([]))

        fireEvent.click(await screen.findByText(/2 more in this dataset/))

        expect(searchBox().value).toBe("dataset-id:3")
    })

    it("says so when a search fails, rather than showing an empty result", async () => {
        renderSelector(
            fakeCatalog(() => Promise.reject(new Error("502 Bad Gateway"))),
            slotOf([])
        )

        await screen.findByText("The search failed: 502 Bad Gateway")
        expect(
            screen.queryByText("No indicators match this search.")
        ).toBeNull()
    })

    it("shows the latest search's results when an earlier one answers last", async () => {
        vi.useFakeTimers()
        try {
            const pending = new Map<
                string,
                (page: IndicatorSearchPage) => void
            >()
            const catalog = fakeCatalog(
                (query) => new Promise((resolve) => pending.set(query, resolve))
            )
            renderSelector(catalog, slotOf([]))

            fireEvent.change(searchBox(), { target: { value: "coal" } })
            await act(() => vi.advanceTimersByTimeAsync(300))
            fireEvent.change(searchBox(), { target: { value: "oil" } })
            await act(() => vi.advanceTimersByTimeAsync(300))

            await act(async () => {
                pending.get("oil")!(
                    pageOf({ ...energy, variables: [energy.variables[1]] })
                )
                pending.get("coal")!(
                    pageOf({ ...energy, variables: [energy.variables[0]] })
                )
            })

            expect(screen.queryByLabelText("Oil")).not.toBeNull()
            expect(screen.queryByLabelText("Coal")).toBeNull()
        } finally {
            vi.useRealTimers()
        }
    })

    it("closes on Escape", () => {
        const { onDismiss } = renderSelector(fakeCatalog(), slotOf([]))
        fireEvent.keyDown(searchBox(), { key: "Escape" })
        expect(onDismiss).toHaveBeenCalled()
    })
})
