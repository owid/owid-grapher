import { describe, expect, it } from "vitest"
import type { JSONSchema7 } from "json-schema"
import { formatGrapherSchemaUrl } from "@ourworldindata/utils"
import { compareSchemaToPublished } from "./grapherSchemaRevisionCheck.js"

function schemaAt(revision: number | undefined, title: string): JSONSchema7 {
    const $id =
        revision === undefined
            ? formatGrapherSchemaUrl("011")
            : formatGrapherSchemaUrl("011", revision)
    return { $id, title }
}

describe(compareSchemaToPublished, () => {
    it.each([
        {
            name: "a schema identical to the published one",
            schema: schemaAt(4, "Published"),
            published: schemaAt(4, "Published"),
        },
        {
            name: "a changed schema that declares the next, unpublished revision",
            schema: schemaAt(5, "Changed"),
            published: schemaAt(4, "Published"),
        },
        {
            name: "any schema while the published one predates revisions",
            schema: schemaAt(4, "Changed"),
            published: schemaAt(undefined, "Published"),
        },
    ])("passes $name", ({ schema, published }) => {
        expect(
            compareSchemaToPublished("011", schema, published).isPassing
        ).toBe(true)
    })

    it("fails a schema that declares no revision", () => {
        for (const published of [
            schemaAt(4, "Published"),
            schemaAt(undefined, "Published"),
        ]) {
            const result = compareSchemaToPublished(
                "011",
                schemaAt(undefined, "Changed"),
                published
            )
            expect(result.isPassing).toBe(false)
            expect(result.message).toContain("names no revision")
        }
    })

    it("fails a change to a published revision", () => {
        const result = compareSchemaToPublished(
            "011",
            schemaAt(4, "Changed"),
            schemaAt(4, "Published")
        )

        expect(result.isPassing).toBe(false)
        expect(result.message).toContain("grapher-schema.011.05.json")
    })

    it("fails a branch behind the published revision", () => {
        const result = compareSchemaToPublished(
            "011",
            schemaAt(4, "Changed"),
            schemaAt(6, "Published")
        )

        expect(result.isPassing).toBe(false)
        expect(result.message).toContain("Update this branch")
        expect(result.message).toContain("grapher-schema.011.07.json")
    })
})
