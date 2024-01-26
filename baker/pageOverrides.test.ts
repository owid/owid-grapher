import {
    DbEnrichedPost,
    WP_PostType,
    extractFormattingOptions,
} from "@ourworldindata/utils"
import * as Post from "../db/model/Post.js"
import * as pageOverrides from "./pageOverrides.js"

import { jest } from "@jest/globals"

const mockCreatePost = (slug: string): DbEnrichedPost => {
    return {
        id: 123,
        type: WP_PostType.Post,
        slug: slug,
        title: "",
        authors: [],
        content: "",
        status: "",
        isListed: false,
        published_at: new Date(0),
        updated_at: new Date(0),
        updated_at_in_wordpress: new Date(0),
        gdocSuccessorId: "",
        excerpt: "",
        created_at_in_wordpress: new Date(0),
        featured_image: "",
        formattingOptions: null,
        archieml: null,
        archieml_update_statistics: null,
        markdown: "",
    }
}

const forestLandingSlug = "forests-and-deforestation"

const getPostEnrichedBySlug = jest.spyOn(Post, "getPostEnrichedBySlug")
getPostEnrichedBySlug.mockImplementation((landingSlug) =>
    Promise.resolve(mockCreatePost(landingSlug))
)

it("gets parent landing", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent("forest-area", formattingOptions)
    ).resolves.toEqual(mockCreatePost(forestLandingSlug))
})

it("does not get parent landing (subnavId invalid)", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:invalid subnavCurrentId:forest-area -->"
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent("forest-area", formattingOptions)
    ).resolves.toEqual(undefined)
})

it("does not get parent landing (post is already a landing)", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent(
            forestLandingSlug,
            formattingOptions
        )
    ).resolves.toEqual(undefined)
})

it("does not get parent landing and logs (landing post not found)", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    getPostEnrichedBySlug.mockImplementationOnce(() =>
        Promise.resolve(undefined)
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent("forest-area", formattingOptions)
    ).resolves.toEqual(undefined)
})
