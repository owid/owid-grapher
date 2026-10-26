// =============================================================================
// PROTOTYPE ONLY — DO NOT MERGE: seeds the rankings prototype profiles for the
// staging server of branch country-profile-rankings.
// =============================================================================
//
// Data-only migration. Inserts the rankings prototype profile gdocs (which only
// exist in a local dev DB, created by devTools/profiles/seedRankings*.ts) plus
// their posts_gdocs_x_tags and posts_gdocs_components rows, so the staging
// bake and admin previews have them. The rows are read from
// ./data/PrototypeSeedRankingProfiles.json, which is regenerated from the local
// DB with devTools/profiles/dumpRankingsProfilesForMigration.ts.
//
// up() is idempotent (delete-then-insert for these ids); down() removes them.
// Remove this migration (and its data file) before merging the branch.

import fs from "fs"
import path from "path"
import { MigrationInterface, QueryRunner } from "typeorm"

interface SeedGdoc {
    id: string
    slug: string
    content: string
    published: number
    createdAt: string
    publishedAt: string | null
    updatedAt: string
    publicationContext: "listed" | "unlisted"
    revisionId: string | null
    manualBreadcrumbs: string | null
    markdown: string | null
}

interface SeedTag {
    gdocId: string
    tagId: number
}

interface SeedComponent {
    gdocId: string
    config: string | null
    parent: string | null
    path: string | null
}

interface SeedData {
    gdocs: SeedGdoc[]
    tags: SeedTag[]
    components: SeedComponent[]
}

const loadSeedData = (): SeedData =>
    JSON.parse(
        fs.readFileSync(
            path.join(__dirname, "data/PrototypeSeedRankingProfiles.json"),
            "utf8"
        )
    )

const deleteSeededRows = async (
    queryRunner: QueryRunner,
    ids: string[]
): Promise<void> => {
    if (ids.length === 0) return
    const placeholders = ids.map(() => "?").join(", ")
    for (const [table, column] of [
        ["posts_gdocs_components", "gdocId"],
        ["posts_gdocs_x_tags", "gdocId"],
        ["posts_gdocs_x_images", "gdocId"],
        ["posts_gdocs_links", "sourceId"],
        ["posts_gdocs", "id"],
    ]) {
        await queryRunner.query(
            `DELETE FROM ${table} WHERE ${column} IN (${placeholders})`,
            ids
        )
    }
}

export class PrototypeSeedRankingProfiles1791895749000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const { gdocs, tags, components } = loadSeedData()
        await deleteSeededRows(
            queryRunner,
            gdocs.map((gdoc) => gdoc.id)
        )

        for (const gdoc of gdocs) {
            await queryRunner.query(
                `-- sql
                INSERT INTO posts_gdocs (
                    id, slug, content, published, createdAt, publishedAt,
                    updatedAt, publicationContext, revisionId,
                    manualBreadcrumbs, markdown
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    gdoc.id,
                    gdoc.slug,
                    gdoc.content,
                    gdoc.published,
                    gdoc.createdAt,
                    gdoc.publishedAt,
                    gdoc.updatedAt,
                    gdoc.publicationContext,
                    gdoc.revisionId,
                    gdoc.manualBreadcrumbs,
                    gdoc.markdown,
                ]
            )
        }

        // Tag ids come from prod; only link tags that exist on this DB
        for (const { gdocId, tagId } of tags) {
            await queryRunner.query(
                `-- sql
                INSERT INTO posts_gdocs_x_tags (gdocId, tagId)
                SELECT ?, id FROM tags WHERE id = ?`,
                [gdocId, tagId]
            )
        }

        for (const component of components) {
            await queryRunner.query(
                `-- sql
                INSERT INTO posts_gdocs_components (gdocId, config, parent, path)
                VALUES (?, ?, ?, ?)`,
                [
                    component.gdocId,
                    component.config,
                    component.parent,
                    component.path,
                ]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const { gdocs } = loadSeedData()
        await deleteSeededRows(
            queryRunner,
            gdocs.map((gdoc) => gdoc.id)
        )
    }
}
