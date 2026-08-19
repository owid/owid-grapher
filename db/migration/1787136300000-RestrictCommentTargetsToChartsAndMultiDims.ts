import { MigrationInterface, QueryRunner } from "typeorm"

export class RestrictCommentTargetsToChartsAndMultiDims1787136300000
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // A comment is now always attached to something a reader sees - a chart
        // or a multi-dim view - and never to an indicator. Metadata is commented
        // on as the chart presents it; that a value happens to come from an
        // indicator is left for whoever triages the comment to work out.
        //
        // Indicators were commentable so that metadata feedback would follow an
        // indicator to every chart using it. That turned out to be the wrong
        // default: it makes a comment about one chart appear on unrelated ones.
        await queryRunner.query(`-- sql
            DELETE FROM comments WHERE targetType = 'variable'
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE comments
                MODIFY COLUMN targetType ENUM('chart', 'multiDim') NOT NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The deleted comments are not recoverable; this only puts the column
        // back to accepting indicator targets.
        await queryRunner.query(`-- sql
            ALTER TABLE comments
                MODIFY COLUMN targetType ENUM('chart', 'variable', 'multiDim') NOT NULL
        `)
    }
}
