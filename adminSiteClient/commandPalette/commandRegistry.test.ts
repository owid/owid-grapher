import { expect, it, describe, vi } from "vitest"
import { faTag } from "@fortawesome/free-solid-svg-icons"
import {
    AdminCommand,
    COMMAND_CATEGORIES,
    createCommandRegistryForTesting,
} from "./commandRegistry.js"
import { deriveActions } from "./paletteTypes.js"

const makeCommand = (id: string): AdminCommand => ({
    id,
    title: id,
    category: COMMAND_CATEGORIES.thisPage,
    icon: faTag,
    actions: [{ label: "Open", to: `/${id}` }],
})

describe(createCommandRegistryForTesting, () => {
    it("registers and disposes commands", () => {
        const registry = createCommandRegistryForTesting()
        expect(registry.getAll()).toEqual([])

        const dispose = registry.register([makeCommand("a"), makeCommand("b")])
        expect(registry.getAll().map((c) => c.id)).toEqual(["a", "b"])

        dispose()
        expect(registry.getAll()).toEqual([])
    })

    it("keeps registrations independent", () => {
        const registry = createCommandRegistryForTesting()
        const disposeA = registry.register([makeCommand("a")])
        registry.register([makeCommand("b")])

        disposeA()
        expect(registry.getAll().map((c) => c.id)).toEqual(["b"])
    })

    it("notifies subscribers on register and dispose, not after unsubscribe", () => {
        const registry = createCommandRegistryForTesting()
        const listener = vi.fn()
        const unsubscribe = registry.subscribe(listener)

        const dispose = registry.register([makeCommand("a")])
        expect(listener).toHaveBeenCalledTimes(1)

        dispose()
        expect(listener).toHaveBeenCalledTimes(2)

        unsubscribe()
        registry.register([makeCommand("b")])
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it("returns a stable snapshot between mutations", () => {
        const registry = createCommandRegistryForTesting()
        registry.register([makeCommand("a")])
        expect(registry.getAll()).toBe(registry.getAll())
    })

    it("disposing twice is a no-op", () => {
        const registry = createCommandRegistryForTesting()
        const dispose = registry.register([makeCommand("a")])
        registry.register([makeCommand("b")])
        dispose()
        dispose()
        expect(registry.getAll().map((c) => c.id)).toEqual(["b"])
    })
})

describe(deriveActions, () => {
    it("derives an open-in-new-tab secondary for route actions", () => {
        const actions = deriveActions([{ label: "Open", to: "/charts" }])
        expect(actions).toEqual([
            { label: "Open", to: "/charts" },
            { label: "Open in new tab", to: "/charts", newTab: true },
        ])
    })

    it("keeps a declared secondary", () => {
        const declared = [
            { label: "Edit", to: "/charts/1/edit" },
            { label: "View on site", href: "https://example.com" },
        ]
        expect(deriveActions(declared)).toBe(declared)
    })

    it("does not derive a secondary for callbacks", () => {
        const actions = deriveActions([{ label: "Run", run: () => {} }])
        expect(actions).toHaveLength(1)
    })

    it("derives a new-tab secondary for non-external hrefs", () => {
        const actions = deriveActions([{ label: "Open", href: "/admin/x" }])
        expect(actions).toEqual([
            { label: "Open", href: "/admin/x" },
            { label: "Open in new tab", href: "/admin/x", external: true },
        ])
    })

    it("does not derive a secondary for already-external hrefs", () => {
        const actions = deriveActions([
            { label: "Open", href: "https://example.com", external: true },
        ])
        expect(actions).toHaveLength(1)
    })
})
