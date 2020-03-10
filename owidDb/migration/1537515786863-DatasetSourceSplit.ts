import { MigrationInterface, QueryRunner } from "typeorm"

export class DatasetSourceSplit1537515786863 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        // Split datasets with multiple source infos
        const datasets = await queryRunner.query(
            "select d.* from datasets d join sources s on s.datasetId=d.id where d.namespace='owid' group by d.id having count(s.id) > 1;"
        )

        for (const dataset of datasets) {
            const sources = (await queryRunner.query(
                "select * from sources s where s.datasetId=? order by s.id ASC",
                [dataset.id]
            )) as any[]

            const splitSources = sources.slice(1)

            for (const source of splitSources) {
                const variables = await queryRunner.query(
                    "select * from variables v where v.sourceId=?",
                    [source.id]
                )
                if (variables.length) {
                    const row = [
                        `${variables[0].name} (split)`,
                        dataset.namespace,
                        dataset.description,
                        dataset.createdAt,
                        dataset.updatedAt,
                        dataset.dataEditedAt,
                        dataset.dataEditedByUserId,
                        dataset.metadataEditedAt,
                        dataset.metadataEditedByUserId,
                        dataset.createdByUserId,
                        true
                    ]
                    const result = await queryRunner.query(
                        `INSERT INTO datasets (name, namespace, description, createdAt, updatedAt, dataEditedAt, dataEditedByUserId, metadataEditedAt, metadataEditedByUserId, createdByUserId, isPrivate) VALUES (?)`,
                        [row]
                    )

                    const datasetId = result.insertId

                    await queryRunner.query(
                        "update sources set datasetId=? where id=?",
                        [datasetId, source.id]
                    )
                    await queryRunner.query(
                        "update variables set datasetId=? where sourceId=?",
                        [datasetId, source.id]
                    )
                } else {
                    await queryRunner.query("delete from sources where id=?", [
                        source.id
                    ])
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
