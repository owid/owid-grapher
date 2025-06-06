import { vi, it, expect } from "vitest"

import { FullPost, WP_PostType } from "@ourworldindata/utils"
import { extractFormattingOptions } from "../serverUtils/wordpressUtils.js"
import * as pageOverrides from "./pageOverrides.js"
import * as Post from "../db/model/Post.js"

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
    Post,
    "getFullPostBySlugFromSnapshot"
)
getPostBySlugLogToSlackNoThrow.mockImplementation((knex, landingSlug) =>
    Promise.resolve(mockCreatePost(landingSlug))
)

it("gets parent landing", async () => {
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

it("does not get parent landing (subnavId invalid)", async () => {
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

it("does not get parent landing (post is already a landing)", async () => {
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

it("does not get parent landing and logs (landing post not found)", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    getPostBySlugLogToSlackNoThrow.mockImplementationOnce(() =>
        Promise.resolve(undefined as any)
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent(
            {} as KnexReadonlyTransaction,
            mockCreatePost("forest-area"),
            formattingOptions
        )
    ).resolves.toEqual(undefined)
})
