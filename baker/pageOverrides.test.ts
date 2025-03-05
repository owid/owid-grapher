/**
 * All the tests in here are skipped, currently, because mocking SQL/S3 calls is difficult:
 * see https://vitest.dev/guide/mocking#mocking-pitfalls
 */

import { vi, it, expect } from "vitest"

import { FullPost, WP_PostType } from "@ourworldindata/utils"
import { extractFormattingOptions } from "../serverUtils/wordpressUtils.js"
import * as pageOverrides from "./pageOverrides.js"

import { KnexReadonlyTransaction } from "../db/db.js"

const mockCreatePost = (slug: string): FullPost => {
    return {
        id: 123,
        type: WP_PostType.Post,
        slug: slug,
        path: "",
        title: "",
        date: new Date(0),
        modifiedDate: new Date(0),
        authors: [],
        content: "",
    }
}

const forestLandingSlug = "forests-and-deforestation"

const getPostBySlugLogToSlackNoThrow = vi.spyOn(
    pageOverrides,
    "getPostBySlugLogToSlackNoThrow"
)
getPostBySlugLogToSlackNoThrow.mockImplementation((knex, landingSlug) =>
    Promise.resolve(mockCreatePost(landingSlug))
)

it.skip("gets parent landing", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent(
            {} as KnexReadonlyTransaction,
            mockCreatePost("forest-area"),
            formattingOptions
        )
    ).resolves.toEqual(mockCreatePost(forestLandingSlug))
})

it.skip("does not get parent landing (subnavId invalid)", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:invalid subnavCurrentId:forest-area -->"
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent(
            {} as KnexReadonlyTransaction,
            mockCreatePost("forest-area"),
            formattingOptions
        )
    ).resolves.toEqual(undefined)
})

it.skip("does not get parent landing (post is already a landing)", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent(
            {} as KnexReadonlyTransaction,
            mockCreatePost(forestLandingSlug),
            formattingOptions
        )
    ).resolves.toEqual(undefined)
})

it.skip("does not get parent landing and logs (landing post not found)", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    getPostBySlugLogToSlackNoThrow.mockImplementationOnce(() =>
        Promise.resolve(undefined)
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent(
            {} as KnexReadonlyTransaction,
            mockCreatePost("forest-area"),
            formattingOptions
        )
    ).resolves.toEqual(undefined)
})
