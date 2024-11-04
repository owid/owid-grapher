import { MigrationInterface, QueryRunner } from "typeorm"

export class TurnRelatedQuestionIntoObject1730722779919
    implements MigrationInterface
{
    private async updateSchema(
        queryRunner: QueryRunner,
        newSchema: string
    ): Promise<void> {
        await queryRunner.query(
            `
            -- sql
            UPDATE chart_configs cc
            SET cc.patch = JSON_SET(cc.patch, '$.$schema', ?),
                cc.full = JSON_SET(cc.full, '$.$schema', ?)
        `,
            [newSchema, newSchema]
        )
    }

    private async turnRelatedQuestionIntoObject(
        queryRunner: QueryRunner,
        config: "patch" | "full"
    ): Promise<void> {
        await queryRunner.query(
            `
            -- sql
            UPDATE chart_configs
            SET
                ?? = JSON_REMOVE(
                    JSON_SET(
                        ??,
                        '$.relatedQuestion',
                        ??->'$.relatedQuestions[0]'
                    ),
                    '$.relatedQuestions'
                )
            WHERE ?? ->> '$.relatedQuestions' is not null
            `,
            [config, config, config, config]
        )
    }

    private async turnRelatedQuestionIntoArray(
        queryRunner: QueryRunner,
        config: "patch" | "full"
    ): Promise<void> {
        await queryRunner.query(
            `
            -- sql
            UPDATE chart_configs
            SET
                ?? = JSON_REMOVE(
                    JSON_SET(
                        ??,
                        '$.relatedQuestions',
                        JSON_ARRAY(
                            JSON_OBJECT(
                                'url', ?? ->> '$.relatedQuestion.url',
                                'text', ?? ->> '$.relatedQuestion.text'
                            )
                        )
                    ),
                    '$.relatedQuestion'
                )
            WHERE ?? ->> '$.relatedQuestion' IS NOT NULL
            `,
            [config, config, config, config, config]
        )
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.turnRelatedQuestionIntoObject(queryRunner, "patch")
        await this.turnRelatedQuestionIntoObject(queryRunner, "full")

        await this.updateSchema(
            queryRunner,
            "https://files.ourworldindata.org/schemas/grapher-schema.006.json"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await this.turnRelatedQuestionIntoArray(queryRunner, "patch")
        await this.turnRelatedQuestionIntoArray(queryRunner, "full")

        await this.updateSchema(
            queryRunner,
            "https://files.ourworldindata.org/schemas/grapher-schema.005.json"
        )
    }
}
