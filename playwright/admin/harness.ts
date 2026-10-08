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
import { isDeepStrictEqual } from "node:util"
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
            const response = await page.request.get(
                `/admin/api/charts/${chart.id}.patchConfig.json`
            )
            const openedPatch = (await response.json()) as GrapherInterface
            await page.goto(`/admin/charts/${chart.id}/edit`, {
                waitUntil: "commit",
            })
            const editor = new ChartEditorPage(page, chart.id, openedPatch)
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
    | "Publishing"
    | "Export"
    | "Debug"

export const escapeRegExp = (text: string): string =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Matches exactly this text, ignoring surrounding whitespace */
export const exactly = (text: string): RegExp =>
    new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`)

export class ChartEditorPage {
    constructor(
        readonly page: Page,
        /** The id of the edited chart; undefined for a new chart */
        readonly chartId?: number,
        /** The chart's stored patch config when the editor was opened */
        readonly openedPatch: GrapherInterface = {}
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
        // loading the admin bundle takes a few seconds on a busy machine
        const timeout = 20_000
        await expect(this.settings.locator(".nav-tabs")).toBeVisible({
            timeout,
        })
        await expect(this.page.locator(".LoadingBlocker")).toHaveCount(0, {
            timeout,
        })
        await expect(this.preview.locator(".GrapherComponent")).toBeVisible({
            timeout,
        })
        if (this.chartId !== undefined)
            await expect(
                this.preview.getByText("No table loaded yet"),
                "the chart's data has loaded"
            ).toHaveCount(0, { timeout })
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

    /**
     * An antd select, found by the text its form group starts with (a
     * `<label>` or, in some sections, a bare text node)
     */
    antSelect(label: string, scope: Locator = this.form): Locator {
        return scope
            .locator(".form-group")
            .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}`) })
            .locator(".ant-select")
            .first()
    }

    /**
     * Opens an antd select and picks the option with exactly this text (or
     * matching this pattern, for options with a second line). Searchable
     * selects (like the color scheme ones) only render the options in view,
     * so pass `search` to type the option's name first.
     */
    async chooseAntOption(
        select: Locator,
        option: string | RegExp,
        { search = false }: { search?: boolean } = {}
    ): Promise<void> {
        await select.click()
        if (search && typeof option === "string")
            await select.locator("input").fill(option)
        await this.page
            .locator(".ant-select-dropdown:visible .ant-select-item-option")
            .filter({
                hasText: typeof option === "string" ? exactly(option) : option,
            })
            .click()
    }

    /**
     * Picks a color in a color box's picker by typing its hex code. The
     * picker reports colors after a debounce, so this waits until the box
     * shows the color.
     */
    async pickColor(colorBox: Locator, hex: string): Promise<void> {
        await colorBox.click()
        const picker = this.page.locator(".colorpicker-tooltip")
        const custom = picker.locator("details.AdminColorPicker__custom")
        if (!(await custom.evaluate((el: HTMLDetailsElement) => el.open)))
            await custom.locator("summary").click()
        await picker.getByRole("textbox", { name: "Hex color" }).fill(hex)
        await expect(colorBox).toHaveCSS("background-color", hexToRgb(hex))
        await this.page.keyboard.press("Escape")
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

    /**
     * Accepts the next `window.confirm` (e.g. when publishing) and resolves
     * to its message
     */
    acceptNextDialog(): Promise<string> {
        return this.handleNextDialog("accept")
    }

    /** Dismisses the next `window.confirm` and resolves to its message */
    dismissNextDialog(): Promise<string> {
        return this.handleNextDialog("dismiss")
    }

    private handleNextDialog(action: "accept" | "dismiss"): Promise<string> {
        return new Promise((resolve) =>
            this.page.once("dialog", async (dialog) => {
                resolve(dialog.message())
                await dialog[action]()
            })
        )
    }

    /**
     * Clicks the chart's save button and returns the patch config the editor
     * sent to the server, after checking that the server accepted it.
     */
    async save(): Promise<GrapherInterface> {
        return this.saveWith(
            this.button(/^(Create draft|Save draft|Update chart)$/)
        )
    }

    /**
     * Saves the chart and returns how the sent patch differs from the one
     * the chart had when the editor was opened, as a map from dotted config
     * paths to new values (undefined for removed ones). Asserting on the
     * whole result checks both that the control wrote its field and that it
     * changed nothing else.
     */
    async saveChanges(): Promise<ConfigChanges> {
        return diffConfigs(this.openedPatch, await this.save())
    }

    /**
     * How the chart's stored patch differs from the one it had when the
     * editor was opened, in the same form as `saveChanges`. The server diffs
     * the sent patch against the chart's parent configs again, so for charts
     * that inherit, this is what shows which fields became overrides: the
     * editor e.g. always sends the effective title, inherited or not.
     */
    async storedChanges(): Promise<ConfigChanges> {
        const response = await this.page.request.get(
            `/admin/api/charts/${this.chartId}.patchConfig.json`
        )
        return diffConfigs(this.openedPatch, await response.json())
    }

    /** Clicks a button that saves the chart and returns the sent patch */
    async saveWith(button: Locator): Promise<GrapherInterface> {
        await expect(
            button,
            "saving is possible (editing errors disable it)"
        ).toBeEnabled()
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

function hexToRgb(hex: string): string {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return `rgb(${r}, ${g}, ${b})`
}

/** Changed config values by dotted path, e.g. `{ "map.time": 2010 }` */
export type ConfigChanges = Record<string, unknown>

// Not part of what the editor authors: the server bumps it on every save
const IGNORED_PATHS = new Set(["version"])

function diffConfigs(
    before: GrapherInterface,
    after: GrapherInterface
): ConfigChanges {
    const beforeLeaves = flattenConfig(before)
    const afterLeaves = flattenConfig(after)
    const changes: ConfigChanges = {}
    for (const path of new Set([
        ...beforeLeaves.keys(),
        ...afterLeaves.keys(),
    ])) {
        if (IGNORED_PATHS.has(path)) continue
        const value = afterLeaves.get(path)
        if (!isDeepStrictEqual(beforeLeaves.get(path), value))
            changes[path] = value
    }
    return changes
}

/**
 * Maps the dotted path of every non-object value (arrays included) to it.
 * Empty objects count as absent: the editor sometimes sends one for a
 * section that has no settings, e.g. `map.colorScale: {}`.
 */
function flattenConfig(
    config: object,
    prefix = "",
    leaves = new Map<string, unknown>()
): Map<string, unknown> {
    for (const [key, value] of Object.entries(config)) {
        const path = prefix + key
        const isObject =
            typeof value === "object" && value !== null && !Array.isArray(value)
        if (isObject) flattenConfig(value, `${path}.`, leaves)
        else leaves.set(path, value)
    }
    return leaves
}

/** Saving an existing chart PUTs to its id, saving a new one POSTs */
function isChartSave(request: Request, chartId: number | undefined): boolean {
    const { pathname } = new URL(request.url())
    return chartId === undefined
        ? request.method() === "POST" && pathname === "/admin/api/charts"
        : request.method() === "PUT" &&
              pathname === `/admin/api/charts/${chartId}`
}
