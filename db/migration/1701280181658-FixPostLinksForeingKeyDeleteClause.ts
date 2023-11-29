import { MigrationInterface, QueryRunner } from "typeorm"

export class FixPostLinksForeingKeyDeleteClause1701280181658
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE posts_links
            DROP FOREIGN KEY posts_links_ibfk_1;
        `)
        await queryRunner.query(`
            ALTER TABLE posts_links
            ADD CONSTRAINT posts_links_ibfk_1
            FOREIGN KEY (sourceId)
            REFERENCES posts(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
