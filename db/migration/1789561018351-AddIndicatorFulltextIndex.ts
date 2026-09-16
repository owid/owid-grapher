import { MigrationInterface, QueryRunner } from "typeorm"

export class AddIndicatorFulltextIndex1789561018351
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Indicator search matches words in the name and the catalog path.
        // Without an index that is a substring scan of every row — about a
        // second per search, growing with the table.
        //
        // MySQL's stopword list means this index doesn't contain `who`, `when`
        // and a few dozen other words. An index can be built against an empty
        // stopword table instead, but the association lives in InnoDB metadata
        // and not in the DDL, so a database restored from a dump would rebuild
        // the index with the server's own list — prod and every developer's
        // machine would then search differently, invisibly. Those words are
        // handled in the query instead, by `canUseFulltext`.
        await queryRunner.query(`-- sql
            ALTER TABLE variables
            ADD FULLTEXT INDEX ft_variables_name_catalogPath (name, catalogPath)`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE variables DROP INDEX ft_variables_name_catalogPath`)
    }
}
