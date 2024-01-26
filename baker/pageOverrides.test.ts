import {
    FullPost,
    WP_PostType,
    extractFormattingOptions,
} from "@ourworldindata/utils"
import * as pageOverrides from "./pageOverrides.js"

const mockCreatePost = (slug: string): FullPost => {
    return {
        id: 123,
        type: WP_PostType.Post,
        slug: slug,
        title: "",
        date: new Date(0),
        modifiedDate: new Date(0),
        authors: [],
        content: "",
    }
}

const forestLandingSlug = "forests-and-deforestation"

it("gets parent landing", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent(
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
            mockCreatePost(forestLandingSlug),
            formattingOptions
        )
    ).resolves.toEqual(undefined)
})

it("does not get parent landing and logs (landing post not found)", async () => {
    const formattingOptions = extractFormattingOptions(
        "<!-- formatting-options subnavId:forests subnavCurrentId:forest-area -->"
    )

    await expect(
        pageOverrides.getLandingOnlyIfParent(
            mockCreatePost("forest-area"),
            formattingOptions
        )
    ).resolves.toEqual(undefined)
})
