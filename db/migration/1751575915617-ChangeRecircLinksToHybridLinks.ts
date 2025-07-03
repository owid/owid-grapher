import { MigrationInterface, QueryRunner } from "typeorm"

function selectGdocsWithRecircLinks(
    queryRunner: QueryRunner
): Promise<{ id: string; content: string }[]> {
    return queryRunner.query(
        `-- sql
            SELECT DISTINCT(pg.id), pg.content
            FROM posts_gdocs pg 
            JOIN posts_gdocs_components pgc ON pg.id = pgc.gdocId
            WHERE pgc.config->>"$.type" = "recirc"
            AND pg.published = TRUE`
    )
}

function selectRecircComponents(
    queryRunner: QueryRunner
): Promise<{ id: number; config: string }[]> {
    return queryRunner.query(
        `-- sql
            SELECT id, config
            FROM posts_gdocs_components pgc
            WHERE pgc.config->>"$.type" = "recirc"`
    )
}

export class ChangeRecircLinksToHybridLinks1751575915617
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const gdocsWithRecircLinks =
            await selectGdocsWithRecircLinks(queryRunner)

        for (const gdoc of gdocsWithRecircLinks) {
            const updatedContent = gdoc.content.replaceAll(
                '"recirc-link"',
                '"hybrid-link"'
            )

            await queryRunner.query(
                `-- sql
                    UPDATE posts_gdocs 
                    SET content = ? 
                    WHERE id = ?`,
                [updatedContent, gdoc.id]
            )
        }

        const recircComponents = await selectRecircComponents(queryRunner)
        for (const component of recircComponents) {
            const updatedConfig = component.config.replaceAll(
                '"recirc-link"',
                '"hybrid-link"'
            )

            await queryRunner.query(
                `-- sql
                    UPDATE posts_gdocs_components 
                    SET config = ?
                    WHERE id = ?`,
                [updatedConfig, component.id]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const gdocsWithHybridLinks =
            await selectGdocsWithRecircLinks(queryRunner)

        for (const gdoc of gdocsWithHybridLinks) {
            const updatedContent = gdoc.content.replaceAll(
                '"hybrid-link"',
                '"recirc-link"'
            )

            await queryRunner.query(
                `-- sql
                    UPDATE posts_gdocs 
                    SET content = ? 
                    WHERE id = ?`,
                [updatedContent, gdoc.id]
            )
        }

        const hybridComponents = await selectRecircComponents(queryRunner)

        for (const component of hybridComponents) {
            const updatedConfig = component.config.replaceAll(
                '"hybrid-link"',
                '"recirc-link"'
            )

            await queryRunner.query(
                `-- sql
                    UPDATE posts_gdocs_components 
                    SET config = ?
                    WHERE id = ?`,
                [updatedConfig, component.id]
            )
        }
    }
}
