import {
    JsonError,
    SlideshowsTableName,
    SlideshowLinksTableName,
    SlideshowXImagesTableName,
    DbInsertSlideshow,
    DbPlainSlideshow,
    DbInsertSlideshowLink,
    DbInsertSlideshowXImage,
    SlideshowConfig,
    Slide,
    SlideTemplate,
    ContentGraphLinkType,
    SlideshowCreateSchema,
    SlideshowUpdateSchema,
} from "@ourworldindata/types"
import { ApiSlideshowOverview } from "../../adminShared/AdminTypes.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"

function extractLinksFromSlides(slides: Slide[]): {
    links: Omit<DbInsertSlideshowLink, "slideshowId">[]
    imageFilenames: string[]
} {
    const links: Omit<DbInsertSlideshowLink, "slideshowId">[] = []
    const imageFilenames: string[] = []

    for (const slide of slides) {
        if (slide.template === SlideTemplate.Image && slide.filename) {
            imageFilenames.push(slide.filename)
        } else if (slide.template === SlideTemplate.Chart) {
            links.push({
                target: slide.slug,
                linkType: ContentGraphLinkType.Grapher,
                queryString: slide.queryString ?? "",
                hash: "",
            })
        }
    }

    return { links, imageFilenames }
}

async function rebuildSlideshowLinks(
    trx: db.KnexReadWriteTransaction,
    slideshowId: number,
    config: SlideshowConfig
): Promise<void> {
    const { links, imageFilenames } = extractLinksFromSlides(config.slides)

    // Rebuild slideshow_links
    await trx(SlideshowLinksTableName).where({ slideshowId }).delete()
    if (links.length > 0) {
        await trx(SlideshowLinksTableName).insert(
            links.map((link) => ({ ...link, slideshowId }))
        )
    }

    // Rebuild slideshow_x_images
    await trx(SlideshowXImagesTableName).where({ slideshowId }).delete()
    if (imageFilenames.length > 0) {
        const images = await trx("images")
            .select("id")
            .whereIn("filename", imageFilenames)
            .whereNull("replacedBy")

        if (images.length > 0) {
            await trx(SlideshowXImagesTableName).insert(
                images.map(
                    (img): DbInsertSlideshowXImage => ({
                        slideshowId,
                        imageId: img.id,
                    })
                )
            )
        }
    }
}

export async function getSlideshows(
    _req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const rows = await db.knexRaw<ApiSlideshowOverview>(
        trx,
        `-- sql
        SELECT
            s.id,
            s.slug,
            s.title,
            s.isPublished,
            s.updatedAt,
            u.fullName as authorName
        FROM slideshows s
        JOIN users u ON s.userId = u.id
        ORDER BY s.updatedAt DESC
        `
    )

    return { slideshows: rows }
}

export async function getSlideshowById(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const id = expectInt(req.params.id)

    const row = await trx<DbPlainSlideshow>(SlideshowsTableName)
        .where({ id })
        .first()

    if (!row) {
        throw new JsonError(`No slideshow found for id ${id}`, 404)
    }

    return {
        slideshow: {
            ...row,
            config: JSON.parse(row.config as unknown as string),
        },
    }
}

export async function createSlideshow(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const parseResult = SlideshowCreateSchema.safeParse(req.body)
    if (!parseResult.success) {
        throw new JsonError(JSON.stringify(parseResult.error), 400)
    }
    const { slug, title, config: rawConfig } = parseResult.data

    const existing = await trx(SlideshowsTableName).where({ slug }).first()
    if (existing) {
        throw new JsonError(`Slideshow with slug "${slug}" already exists`, 400)
    }

    const config: SlideshowConfig = rawConfig ?? { slides: [] }

    const [id] = await trx<DbInsertSlideshow>(SlideshowsTableName).insert({
        slug,
        title,
        config: JSON.stringify(config) as any,
        userId: res.locals.user.id,
    })

    await rebuildSlideshowLinks(trx, id, config)

    return { success: true, slideshowId: id }
}

export async function updateSlideshow(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)

    const existing = await trx(SlideshowsTableName).where({ id }).first()
    if (!existing) {
        throw new JsonError(`No slideshow found for id ${id}`, 404)
    }

    const parseResult = SlideshowUpdateSchema.safeParse(req.body)
    if (!parseResult.success) {
        throw new JsonError(JSON.stringify(parseResult.error), 400)
    }
    const { slug, title, config, isPublished } = parseResult.data

    const updates: Partial<DbInsertSlideshow> = {}
    if (slug !== undefined) updates.slug = slug
    if (title !== undefined) updates.title = title
    if (config !== undefined) updates.config = JSON.stringify(config) as any
    if (isPublished !== undefined) {
        updates.isPublished = isPublished
        if (isPublished && !existing.publishedAt) {
            updates.publishedAt = new Date()
        }
    }

    await trx(SlideshowsTableName).where({ id }).update(updates)

    if (config !== undefined) {
        await rebuildSlideshowLinks(trx, id, config)
    }

    return { success: true }
}

export async function deleteSlideshow(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)

    const existing = await trx(SlideshowsTableName).where({ id }).first()
    if (!existing) {
        throw new JsonError(`No slideshow found for id ${id}`, 404)
    }

    await trx(SlideshowsTableName).where({ id }).delete()

    return { success: true }
}
