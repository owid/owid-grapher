import { MigrationInterface, QueryRunner } from "typeorm"

export class AddMoreLinkTypes1679090531333 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE posts_gdocs_links MODIFY linkType ENUM('gdoc', 'url', 'grapher', 'explorer');`
        )
    }

    public async down(): Promise<void> {
        // There's no need to undo this
    }
}
