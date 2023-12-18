import { OwidGdocPostContent } from "@ourworldindata/utils"
import { MigrationInterface, QueryRunner } from "typeorm"

export class IterableResearchAndWriting1694549232436
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await migrateResearchAndWritingBlocks(queryRunner, (node) => {
            const primary = node.primary as any
            const secondary = node.secondary as any
            node.primary = [primary]
            node.secondary = [secondary]
        })
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await migrateResearchAndWritingBlocks(queryRunner, (node) => {
            const primary = node.primary as any
            const secondary = node.secondary as any
            node.primary = primary[0]
            node.secondary = secondary[0]
        })
    }
}

async function migrateResearchAndWritingBlocks(
    queryRunner: QueryRunner,
    callback: (node: any) => void
): Promise<void> {
    const allGdocs = await queryRunner.query(
        "SELECT id, slug, content FROM posts_gdocs"
    )
    for (const gdoc of allGdocs) {
        const content = JSON.parse(gdoc.content) as OwidGdocPostContent
        if (!content.body) continue

        let hasResearchAndWriting = false

        // Not recursively traversing because none of our topic pages have research-and-writing blocks nested inside containers
        content.body.forEach((node) => {
            if (node.type === "research-and-writing") {
                hasResearchAndWriting = true
                callback(node)
            }
            return node
        })

        if (hasResearchAndWriting) {
            await queryRunner.query(
                "UPDATE posts_gdocs SET content = ? WHERE id = ?",
                [JSON.stringify(content), gdoc.id]
            )
        }
    }
}
