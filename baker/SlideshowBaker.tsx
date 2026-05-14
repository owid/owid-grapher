import path from "path"
import fs from "fs-extra"
import * as db from "../db/db.js"
import {
    DbPlainSlideshow,
    SlideshowsTableName,
    ImageMetadata,
    Slide,
    SlideTemplate,
    ResolvedSlideChartInfo,
} from "@ourworldindata/types"
import { searchParamsToMultiDimView, Url } from "@ourworldindata/utils"
import { renderSlideshowPage } from "./siteRenderers.js"
import { getImagesByFilenames } from "../db/model/Image.js"
import { getMinimalAuthorsByNames } from "../db/model/Gdoc/GdocBase.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { getMultiDimDataPageBySlug } from "../db/model/MultiDimDataPage.js"

/** Extract all image filenames referenced in the slides */
function extractImageFilenames(slides: Slide[]): string[] {
    const filenames: string[] = []
    for (const slide of slides) {
        if (slide.template === SlideTemplate.Image && slide.filename) {
            filenames.push(slide.filename)
        }
    }
    return filenames
}

/** Resolve the chart type for a slide URL by checking the DB */
async function resolveChartInfo(
    knex: db.KnexReadonlyTransaction,
    url: string
): Promise<ResolvedSlideChartInfo> {
    const parsed = Url.fromURL(url)
    const pathname = parsed.pathname ?? ""
    const slug = parsed.slug ?? ""

    if (pathname.startsWith("/explorers/")) {
        return { type: "explorer" }
    }

    // Try as a regular grapher
    try {
        await getChartConfigBySlug(knex, slug)
        return { type: "grapher" }
    } catch {
        // Not a grapher — try multi-dim
    }

    // Try as a multi-dim
    const multiDim = await getMultiDimDataPageBySlug(knex, slug)
    if (multiDim) {
        const searchParams = new URLSearchParams(
            parsed.queryStr?.replace(/^\?/, "") ?? ""
        )
        // searchParamsToMultiDimView falls back to the default view
        // when no dimension-related search params are present
        try {
            const view = searchParamsToMultiDimView(
                multiDim.config,
                searchParams
            )
            return { type: "multi-dim", configId: view.fullConfigId }
        } catch {
            // No view found even for default dimensions — fall through
        }
    }

    // Fallback: treat as grapher and let the client handle it
    return { type: "grapher" }
}

/** Resolve chart types for all chart slides in a slideshow */
export async function resolveSlideChartTypes(
    knex: db.KnexReadonlyTransaction,
    slides: Slide[]
): Promise<Record<string, ResolvedSlideChartInfo>> {
    const resolutions: Record<string, ResolvedSlideChartInfo> = {}
    for (const slide of slides) {
        if (slide.template === SlideTemplate.Chart && slide.url) {
            resolutions[slide.url] = await resolveChartInfo(knex, slide.url)
        } else if (slide.template === SlideTemplate.TwoCharts) {
            if (slide.url1) {
                resolutions[slide.url1] = await resolveChartInfo(
                    knex,
                    slide.url1
                )
            }
            if (slide.url2) {
                resolutions[slide.url2] = await resolveChartInfo(
                    knex,
                    slide.url2
                )
            }
        }
    }
    return resolutions
}

export async function bakeAllPublishedSlideshows(
    bakedSiteDir: string,
    knex: db.KnexReadonlyTransaction
): Promise<void> {
    const slideshows = await knex<DbPlainSlideshow>(SlideshowsTableName)
        .where("isPublished", 1)
        .select()

    if (slideshows.length === 0) return

    // Collect all image filenames across all slideshows
    const allImageFilenames = new Set<string>()
    for (const slideshow of slideshows) {
        const config =
            typeof slideshow.config === "string"
                ? JSON.parse(slideshow.config)
                : slideshow.config
        for (const filename of extractImageFilenames(config.slides)) {
            allImageFilenames.add(filename)
        }
    }

    // Fetch image metadata for all referenced images at once
    const imageMetadataByFilename: Record<string, ImageMetadata> = {}
    if (allImageFilenames.size > 0) {
        const images = await getImagesByFilenames(knex, [...allImageFilenames])
        for (const image of images) {
            imageMetadataByFilename[image.filename] = image
        }
    }

    // Collect all author names and resolve to LinkedAuthors
    const allAuthorNames = new Set<string>()
    for (const slideshow of slideshows) {
        const config =
            typeof slideshow.config === "string"
                ? JSON.parse(slideshow.config)
                : slideshow.config
        if (config.authors) {
            for (const name of config.authors.split(",")) {
                const trimmed = name.trim()
                if (trimmed) allAuthorNames.add(trimmed)
            }
        }
    }
    const allLinkedAuthors =
        allAuthorNames.size > 0
            ? await getMinimalAuthorsByNames(knex, [...allAuthorNames])
            : []

    for (const slideshow of slideshows) {
        const config =
            typeof slideshow.config === "string"
                ? JSON.parse(slideshow.config)
                : slideshow.config

        // Filter linked authors to only those referenced by this slideshow
        const authorNames = config.authors
            ? config.authors
                  .split(",")
                  .map((n: string) => n.trim())
                  .filter(Boolean)
            : []
        const linkedAuthors = allLinkedAuthors.filter((a) =>
            authorNames.includes(a.name)
        )

        // Resolve chart types for all chart slides
        const chartResolutions = await resolveSlideChartTypes(
            knex,
            config.slides
        )

        const html = await renderSlideshowPage(
            {
                title: slideshow.title,
                slug: slideshow.slug,
                config,
            },
            imageMetadataByFilename,
            linkedAuthors,
            chartResolutions
        )

        const outDir = path.join(bakedSiteDir, "slideshows")
        await fs.mkdirp(outDir)
        const outPath = path.join(outDir, `${slideshow.slug}.html`)
        await fs.writeFile(outPath, html)
    }
}
