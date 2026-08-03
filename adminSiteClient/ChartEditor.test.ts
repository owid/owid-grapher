/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest"
import { ChartEditor, type ChartEditorManager } from "./ChartEditor.js"

const makeManager = (): ChartEditorManager => ({
    admin: {} as ChartEditorManager["admin"],
    patchConfig: {},
    parentConfig: {},
    isInheritanceEnabled: true,
    logs: [],
    references: undefined,
    redirects: [],
    deprecationNotice: "This chart is archived.",
})

describe("ChartEditor deprecation notice", () => {
    it("tracks notice changes without overriding the base isModified computation", () => {
        vi.stubGlobal("localStorage", { getItem: () => null })
        const editor = new ChartEditor({ manager: makeManager() })

        expect(() => editor.isModified).not.toThrow()
        expect(editor.isDeprecationNoticeModified).toBe(false)

        editor.grapherState.deprecationNotice = "Use the replacement chart."
        expect(editor.isDeprecationNoticeModified).toBe(true)

        editor.dispose()
        vi.unstubAllGlobals()
    })
})
