/**
 * Test vocabulary for the chart editor browser tests.
 *
 * A test seeds the chart it needs through the admin API (`seedChart`), opens
 * it in the editor (`openEditor`), drives the one control under test and then
 * saves. `ChartEditorPage.save()` returns the patch config the editor sent to
 * the server, which is the contract these tests protect: changing a control
 * must change exactly the corresponding config field. The save still goes
 * through, so the server's validation also runs, and every test works on its
 * own chart, so tests can run in parallel without cleaning up.
 *
 * Requests to anything other than the local test stack are aborted, and any
 * uncaught error on the page fails the test.
 */
import {
    test as base,
    expect,
    type Locator,
    type Page,
    type Request,
} from "@playwright/test"
import type { GrapherInterface } from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { HOST } from "./ports.js"

export { expect }

export interface SeededChart {
    id: number
}

export interface SeedOptions {
    /** Whether the chart inherits from its indicator's config (default: off) */
    inheritance?: boolean
}

interface AdminFixtures {
    seedChart: (
        config: GrapherInterface,
        options?: SeedOptions
    ) => Promise<SeededChart>
    openEditor: (chart: SeededChart) => Promise<ChartEditorPage>
    openNewChartEditor: () => Promise<ChartEditorPage>
}

export const test = base.extend<AdminFixtures>({
    context: async ({ context }, use) => {
        await context.route(
            (url) => url.hostname !== HOST,
            (route) => route.abort("blockedbyclient")
        )
        await use(context)
    },

    page: async ({ page }, use) => {
        const errors: Error[] = []
        page.on("pageerror", (error) => errors.push(error))
        await use(page)
        expect(errors, "uncaught errors on the page").toEqual([])
    },

    seedChart: async ({ request }, use) => {
        await use(async (config, { inheritance = false } = {}) => {
            const response = await request.post(
                `/admin/api/charts?inheritance=${inheritance ? "enable" : "disable"}`,
                { data: { $schema: latestGrapherConfigSchema, ...config } }
            )
            const json = await response.json()
            expect(
                json,
                `seeding a chart: ${JSON.stringify(json.error)}`
            ).toMatchObject({ success: true })
            return { id: json.chartId as number }
        })
    },

    openEditor: async ({ page }, use) => {
        await use(async (chart) => {
            await page.goto(`/admin/charts/${chart.id}/edit`, {
                waitUntil: "commit",
            })
            const editor = new ChartEditorPage(page, chart.id)
            await editor.waitUntilReady()
            return editor
        })
    },

    openNewChartEditor: async ({ page }, use) => {
        await use(async () => {
            await page.goto("/admin/charts/create", { waitUntil: "commit" })
            const editor = new ChartEditorPage(page)
            await editor.waitUntilReady()
            return editor
        })
    },
})

export type EditorTabName =
    | "Basic"
    | "Data"
    | "Text"
    | "Customize"
    | "Map"
    | "Scatter"
    | "Marimekko"
    | "Revisions"
    | "Refs"
    | "Export"
    | "Debug"

const exactly = (text: string): RegExp =>
    new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`)

export class ChartEditorPage {
    /** The id of the edited chart; undefined until a new chart is saved */
    constructor(
        readonly page: Page,
        readonly chartId?: number
    ) {}

    /** The left-hand panel with the tabs, form and save buttons */
    get settings(): Locator {
        return this.page.locator(".chart-editor-settings")
    }

    /** The form of the currently open tab */
    get form(): Locator {
        return this.settings.locator(".innerForm")
    }

    /** The live chart preview */
    get preview(): Locator {
        return this.page.locator(".chart-editor-view figure")
    }

    get tabs(): Locator {
        return this.settings.locator(".nav-tabs .nav-link")
    }

    async waitUntilReady(): Promise<void> {
        await expect(this.settings.locator(".nav-tabs")).toBeVisible()
        await expect(this.page.locator(".LoadingBlocker")).toHaveCount(0)
        await expect(this.preview.locator(".GrapherComponent")).toBeVisible()
        if (this.chartId !== undefined)
            await expect(
                this.preview.getByText("No table loaded yet"),
                "the chart's data has loaded"
            ).toHaveCount(0)
    }

    async openTab(name: EditorTabName): Promise<Locator> {
        await this.tabs.filter({ hasText: new RegExp(`^${name}\\b`) }).click()
        return this.form
    }

    /** A form section by its heading */
    section(name: string, scope: Locator = this.form): Locator {
        return scope.locator("section").filter({
            has: this.page.getByRole("heading", { name, exact: true }),
        })
    }

    /** The text input, textarea or select of a labelled form field */
    field(label: string, scope: Locator = this.form): Locator {
        return scope
            .locator(".form-group")
            .filter({
                has: this.page.locator(":scope > label", {
                    hasText: exactly(label),
                }),
            })
            .locator("input, textarea, select")
            .first()
    }

    checkbox(label: string, scope: Locator = this.form): Locator {
        return scope.getByRole("checkbox", { name: label, exact: true })
    }

    /** A radio button, found by the label of its option */
    radio(label: string, scope: Locator = this.form): Locator {
        return scope.getByRole("radio", { name: label, exact: true })
    }

    button(name: string | RegExp, scope: Locator = this.settings): Locator {
        return scope.getByRole("button", {
            name,
            exact: typeof name === "string",
        })
    }

    /** Replaces a text field's value and commits it like a user tabbing out */
    async fill(field: Locator, value: string): Promise<void> {
        await field.fill(value)
        await field.blur()
    }

    /** Accepts the next `window.confirm` (e.g. when publishing) */
    acceptNextDialog(): void {
        this.page.once("dialog", (dialog) => void dialog.accept())
    }

    /**
     * Clicks the chart's save button and returns the patch config the editor
     * sent to the server, after checking that the server accepted it.
     */
    async save(): Promise<GrapherInterface> {
        return this.saveWith(this.button(/^(Create draft|Save draft|Update chart)$/))
    }

    /** Clicks a button that saves the chart and returns the sent patch */
    async saveWith(button: Locator): Promise<GrapherInterface> {
        const [request] = await Promise.all([
            this.page.waitForRequest((request) =>
                isChartSave(request, this.chartId)
            ),
            button.click(),
        ])
        const json = await (await request.response())?.json()
        expect(
            json,
            `saving the chart: ${JSON.stringify(json?.error)}`
        ).toMatchObject({ success: true })
        return request.postDataJSON()
    }
}

/** Saving an existing chart PUTs to its id, saving a new one POSTs */
function isChartSave(request: Request, chartId: number | undefined): boolean {
    const { pathname } = new URL(request.url())
    return chartId === undefined
        ? request.method() === "POST" && pathname === "/admin/api/charts"
        : request.method() === "PUT" &&
              pathname === `/admin/api/charts/${chartId}`
}
