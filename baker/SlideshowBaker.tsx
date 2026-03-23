import path from "path"
import fs from "fs-extra"
import * as _ from "lodash-es"
import * as db from "../db/db.js"
import {
    DbPlainSlideshow,
    SlideshowsTableName,
    ImageMetadata,
    Slide,
    SlideMedia,
} from "@ourworldindata/types"
import { renderSlideshowPage } from "./siteRenderers.js"
import { getImagesByFilenames } from "../db/model/Image.js"

/** Extract all image filenames referenced in the slides */
function extractImageFilenames(slides: Slide[]): string[] {
    const filenames: string[] = []
    for (const slide of slides) {
        if (!("media" in slide) || !slide.media) continue
        const media = slide.media as SlideMedia
        if (media.type === "image") {
            filenames.push(media.filename)
        }
    }
    return filenames
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

    for (const slideshow of slideshows) {
        const config =
            typeof slideshow.config === "string"
                ? JSON.parse(slideshow.config)
                : slideshow.config

        const html = await renderSlideshowPage(
            {
                title: slideshow.title,
                slug: slideshow.slug,
                config,
            },
            imageMetadataByFilename
        )

        const outDir = path.join(bakedSiteDir, "slideshows")
        await fs.mkdirp(outDir)
        const outPath = path.join(outDir, `${slideshow.slug}.html`)
        await fs.writeFile(outPath, html)
    }
}
