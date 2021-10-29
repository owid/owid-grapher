#! /usr/bin/env jest

import {
    ProminentLinkStyles,
    PROMINENT_LINK_CLASSNAME,
    renderAuthoredProminentLinks,
    WITH_IMAGE,
} from "../site/blocks/ProminentLink"
import * as cheerio from "cheerio"
import { FullPost, WP_PostType } from "../clientUtils/owidTypes"
import * as wpdb from "../db/wpdb"
import { renderAutomaticProminentLinks } from "./siteRenderers"
import { BAKED_BASE_URL } from "../settings/clientSettings"

// There are many possible dimensions to test:
// - style: default / thin
// - title: with / without
// - content: with / without
// - image: with / without
// - authored / automatic
// - link to: post / grapher page / missing page
//
// Only a few significant ones have been selected in order to have a offer good
// coverage while keeping the maitenance burden in check.

const title = "The prominent link title"
const content = "<p>Some text</p>"
const imageSrc = `${BAKED_BASE_URL}/path/to/image.png`
const imageId = 123
const postSlug = "child-mortality"
const grapherSlug = "cancer-deaths-rate-and-age-standardized-rate-index"
const grapherUrl = `${BAKED_BASE_URL}/grapher/${grapherSlug}?country=~OWID_WRL`

const getMockBlock = (
    url: string,
    title: string,
    imageSrc: string | null,
    content: string,
    style?: ProminentLinkStyles
) => {
    const image = imageSrc
        ? `
    <img width="768" height="382"
        src=${imageSrc}
        class="attachment-medium_large size-medium_large" alt="" loading="lazy"
        srcset="${BAKED_BASE_URL}/app/uploads/2021/10/image-768x382.png 768w, ${BAKED_BASE_URL}/app/uploads/2021/10/image-400x199.png 400w, ${BAKED_BASE_URL}/app/uploads/2021/10/image-800x398.png 800w, ${BAKED_BASE_URL}/app/uploads/2021/10/image-150x75.png 150w, ${BAKED_BASE_URL}/app/uploads/2021/10/image.png 1492w"
        sizes="(max-width: 768px) 100vw, 768px" />`
        : ""
    return `
<block type="prominent-link" style="${style || ""}">
    <link-url>${url}</link-url>
    <title>${title}</title>
    <content>${content}</content>
    <figure>${image}</figure>
</block>
`
}

const getMockTitle = (slug: string): string => {
    return `title of ${slug}`
}

const getMockPostWithImage = (slug: string): FullPost => {
    return {
        id: 123,
        type: WP_PostType.Post,
        slug: slug,
        path: "",
        title: getMockTitle(slug),
        date: new Date(0),
        modifiedDate: new Date(0),
        authors: [],
        content: "",
        glossary: false,
        imageId,
    }
}

const getMockThumbnailUrl = (id: number) => {
    return `${BAKED_BASE_URL}/path/to/image-${id}.svg`
}

const getMockGrapherThumbnailUrl = (slug: string) => {
    return `${BAKED_BASE_URL}/grapher/exports/${slug}.svg`
}

const getPostBySlug = jest.spyOn(wpdb, "getPostBySlug")
getPostBySlug.mockImplementation(
    (slug) => Promise.resolve(getMockPostWithImage(slug)) // only for more descriptive error message
)

const getMediaThumbnailUrl = jest.spyOn(wpdb, "getMediaThumbnailUrl")
getMediaThumbnailUrl.mockImplementation((id) =>
    Promise.resolve(getMockThumbnailUrl(id))
)

it("renders authored prominent link (grapher, image override, default style)", () => {
    const block = getMockBlock(grapherUrl, title, imageSrc, content)
    const cheerioEl = cheerio.load(block)
    renderAuthoredProminentLinks(cheerioEl)
    const prominentLinkEl = cheerioEl(`.${PROMINENT_LINK_CLASSNAME}`)

    expect(prominentLinkEl.hasClass(WITH_IMAGE)).toBe(true)
    expect(prominentLinkEl.attr("data-style")).toEqual(
        ProminentLinkStyles.default
    )
    expect(cheerioEl("h3").text()).toEqual(title)
    expect(cheerioEl("figure > img").attr("src")).toEqual(imageSrc)
    expect(cheerioEl(".content").html()).toEqual(content)
})

it("renders authored prominent link (grapher, thin, no image override)", () => {
    const block = getMockBlock(
        grapherUrl,
        title,
        null,
        content,
        ProminentLinkStyles.thin
    )
    const cheerioEl = cheerio.load(block)
    renderAuthoredProminentLinks(cheerioEl)
    const prominentLinkEl = cheerioEl(`.${PROMINENT_LINK_CLASSNAME}`)

    expect(prominentLinkEl.hasClass(WITH_IMAGE)).toBe(true)
    expect(prominentLinkEl.attr("data-style")).toEqual(ProminentLinkStyles.thin)
    expect(cheerioEl(".title").text()).toEqual(title)
    expect(cheerioEl("figure > img").attr("src")).toEqual(
        getMockGrapherThumbnailUrl(grapherSlug)
    )
    expect(cheerioEl(".content").html()).toEqual(content)
})

it("renders automatic prominent link (link to post, thin)", async () => {
    const htmlLink = `<p><a href="${BAKED_BASE_URL}/${postSlug}"></a></p>`

    const cheerioEl = cheerio.load(htmlLink)

    await renderAutomaticProminentLinks(
        cheerioEl,
        getMockPostWithImage("current-post") // only for more descriptive error message
    )

    const prominentLinkEl = cheerioEl(`.${PROMINENT_LINK_CLASSNAME}`)

    expect(prominentLinkEl.hasClass(WITH_IMAGE)).toBe(true)
    expect(prominentLinkEl.attr("data-style")).toEqual(ProminentLinkStyles.thin)

    expect(cheerioEl(".title").text()).toEqual(getMockTitle(postSlug))
    expect(cheerioEl("figure > img").attr("src")).toEqual(
        getMockThumbnailUrl(imageId)
    )
    expect(cheerioEl(".content").html()).toBeNull()
})

it("does not convert links with surrounding text", async () => {
    const htmlLink = `<p>this should not be converted <a href="${BAKED_BASE_URL}/${postSlug}"></a></p>`

    const cheerioEl = cheerio.load(htmlLink)

    await renderAutomaticProminentLinks(
        cheerioEl,
        getMockPostWithImage("current-post") // only for more descriptive error message
    )

    const prominentLinkEl = cheerioEl(`.${PROMINENT_LINK_CLASSNAME}`)

    expect(prominentLinkEl.length).toEqual(0)
})
