import {
    excludeNullish,
    EnrichedDetail,
    EnrichedFaq,
    Ref,
    OwidGdocContent,
} from "@ourworldindata/utils"
import { MigrationInterface, QueryRunner } from "typeorm"
import { enrichedBlocksToMarkdown } from "../model/Gdoc/enrichedToMarkdown.js"

export class AddMarkdownColumns1702059907881 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // add a text column to the posts table
        await queryRunner.query(
            "ALTER TABLE posts ADD COLUMN markdown LONGTEXT"
        )
        // add a text column to the posts_gdocs table
        await queryRunner.query(
            "ALTER TABLE posts_gdocs ADD COLUMN markdown LONGTEXT"
        )

        const archieMlInGdocs = await queryRunner.query(
            `SELECT id,
            content
            from posts_gdocs`
        )

        // I considered doing this for posts as well, but we have the sync script
        // for these jobs and it's probably nicer to do less work in the migration
        // const archieMlInPosts = await queryRunner.query(
        //     `SELECT id,
        //     archieml ->> '$.content' as content
        //     from posts`
        // )

        this.createAndStoreMarkdown("posts_gdocs", archieMlInGdocs, queryRunner)
        // this.createAndStoreMarkdown("posts", archieMlInPosts, queryRunner)
    }

    private createAndStoreMarkdown(
        tableName: string,
        blocks: { id: string | number; content: string }[],
        queryRunner: QueryRunner
    ): void {
        for (const row of blocks) {
            try {
                const content: OwidGdocContent = JSON.parse(row.content)
                const blocks = excludeNullish([
                    content.body,
                    // TODO: this just concats detail text with no separators for the DoD document, could be improved
                    content.details
                        ? Object.values(content.details).flatMap(
                              (detail: unknown) =>
                                  (detail as EnrichedDetail).text
                          )
                        : undefined,
                    content.parsedFaqs
                        ? Object.values(content.parsedFaqs).flatMap(
                              (faq: unknown) => (faq as EnrichedFaq).content
                          )
                        : undefined,
                    content.refs && content.refs.definitions
                        ? Object.values(content.refs.definitions).flatMap(
                              (definition: unknown) =>
                                  (definition as Ref).content
                          )
                        : undefined,
                ]).flat()

                const markdown = enrichedBlocksToMarkdown(blocks, true)
                queryRunner.query(
                    `UPDATE ${tableName} SET markdown=? WHERE id=?`,
                    [markdown, row.id]
                )
            } catch (e) {
                console.error(`FAILED TO MIGRATE ${tableName} ${row.id}`)
                console.error(e)
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // drop the text column from the posts table
        await queryRunner.query("ALTER TABLE posts DROP COLUMN markdown")
        // drop the text column from the posts_gdocs table
        await queryRunner.query("ALTER TABLE posts_gdocs DROP COLUMN markdown")
    }
}
