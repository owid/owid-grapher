import { MigrationInterface, QueryRunner } from "typeorm"

type SlideshowRow = { id: number; config: string }

// A single slide object as stored in the slideshow config JSON. We only care
// about `template` (the discriminant) and the title fields here.
type StoredSlide = {
    template?: string
    slideTitle?: unknown
    title?: unknown
    [key: string]: unknown
}

type StoredConfig = {
    slides?: StoredSlide[]
    [key: string]: unknown
}

/**
 * Rewrite every slideshow's config JSON, renaming the title field on image
 * slides. `rename` maps the old key to the new key (e.g. slideTitle -> title).
 * Only image slides that actually have the old key set are touched; all other
 * slides and config fields are preserved untouched.
 */
async function renameImageSlideTitleField(
    queryRunner: QueryRunner,
    fromKey: "slideTitle" | "title",
    toKey: "slideTitle" | "title"
): Promise<void> {
    const rows: SlideshowRow[] = await queryRunner.query(`-- sql
        SELECT id, config FROM slideshows
    `)

    for (const row of rows) {
        const config = JSON.parse(row.config) as StoredConfig
        if (!Array.isArray(config.slides)) continue

        let changed = false
        for (const slide of config.slides) {
            if (slide?.template !== "image") continue
            // Skip slides that don't carry the old key at all.
            if (!Object.prototype.hasOwnProperty.call(slide, fromKey)) continue
            slide[toKey] = slide[fromKey]
            delete slide[fromKey]
            changed = true
        }

        if (!changed) continue

        await queryRunner.query(
            `-- sql
            UPDATE slideshows SET config = ? WHERE id = ?
        `,
            [JSON.stringify(config), row.id]
        )
    }
}

export class RenameImageSlideTitleToTitle1782418495044
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Image slides previously stored their heading under `slideTitle`,
        // unlike every other slide type which uses `title`. Rename it so the
        // field is consistent across templates.
        await renameImageSlideTitleField(queryRunner, "slideTitle", "title")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse: rename `title` back to `slideTitle` on image slides.
        await renameImageSlideTitleField(queryRunner, "title", "slideTitle")
    }
}
