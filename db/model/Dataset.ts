import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Unique,
    type Relation,
} from "typeorm"
import { Writable } from "stream"

import { User } from "./User.js"
import { Source } from "./Source.js"

import * as db from "../db.js"
import {
    DbPlainTag,
    DbRawVariable,
    VariablesTableName,
    slugify,
} from "@ourworldindata/utils"
import filenamify from "filenamify"
import { writeVariableCSV } from "./Variable.js"
import _ from "lodash"
import { Knex } from "knex"
import { knexRaw } from "../db.js"

@Entity("datasets")
@Unique(["name", "namespace"])
export class Dataset extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() name!: string
    @Column({ default: "owid" }) namespace!: string
    @Column({ default: "" }) description!: string
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column() metadataEditedAt!: Date
    @Column() metadataEditedByUserId!: number
    @Column() dataEditedAt!: Date
    @Column() dataEditedByUserId!: number
    @Column({ default: false }) isPrivate!: boolean
    @Column({ default: false }) nonRedistributable!: boolean

    @ManyToOne(() => User, (user) => user.createdDatasets)
    createdByUser!: Relation<User>

    // Export dataset variables to CSV (not including metadata)
    static async writeCSV(
        datasetId: number,
        stream: Writable,
        knex: Knex<any, any[]>
    ): Promise<void> {
        // get variables of a dataset
        const variableIds = (
            await knexRaw(
                `
            SELECT
                id as variableId
            FROM variables v
            WHERE datasetId=?`,
                knex,
                [datasetId]
            )
        ).map((row: any) => row.variableId)

        await writeVariableCSV(variableIds, stream, knex)
    }

    static async setTags(datasetId: number, tagIds: number[]): Promise<void> {
        await db.transaction(async (t) => {
            const tagRows = tagIds.map((tagId) => [tagId, datasetId])
            await t.execute(`DELETE FROM dataset_tags WHERE datasetId=?`, [
                datasetId,
            ])
            if (tagRows.length)
                await t.execute(
                    `INSERT INTO dataset_tags (tagId, datasetId) VALUES ?`,
                    [tagRows]
                )
        })
    }

    async toCSV(knex: Knex<any, any[]>): Promise<string> {
        let csv = ""
        await Dataset.writeCSV(
            this.id,
            {
                write: (s: string) => (csv += s),
                end: () => null,
            } as any,
            knex
        )
        return csv
    }

    get filename(): string {
        return filenamify(this.name)
    }

    get slug(): string {
        return slugify(this.name)
    }

    // Return object representing datapackage.json for this dataset
    async toDatapackage(): Promise<any> {
        // XXX
        const sources = await Source.findBy({ datasetId: this.id })
        const variables = (await db
            .knexTable(VariablesTableName)
            .where({ datasetId: this.id })) as DbRawVariable[]
        const tags: Pick<DbPlainTag, "id" | "name">[] = await knexRaw(
            `SELECT t.id, t.name FROM dataset_tags dt JOIN tags t ON t.id=dt.tagId WHERE dt.datasetId=?`,
            db.knexInstance(), // TODO: pass down the knex instance instead of using the global one
            [this.id]
        )

        const initialFields = [
            { name: "Entity", type: "string" },
            { name: "Year", type: "year" },
        ]

        const dataPackage = {
            name: this.name,
            title: this.name,
            id: this.id,
            description:
                (sources[0] &&
                    sources[0].description &&
                    sources[0].description.additionalInfo) ||
                "",
            sources: sources.map((s) => s.toDatapackage()),
            owidTags: tags.map((t: any) => t.name),
            resources: [
                {
                    path: `${this.name}.csv`,
                    schema: {
                        fields: initialFields.concat(
                            variables.map((v) => ({
                                name: v.name ?? "",
                                type: "any",
                                description: v.description,
                                owidDisplaySettings: v.display,
                            }))
                        ),
                    },
                },
            ],
        }

        return dataPackage
    }
}
