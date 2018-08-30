import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany, ManyToOne} from "typeorm"
import { Writable } from "stream"

import User from './User'
import { Source } from './Source'
import { Variable } from './Variable'
import { csvRow, slugify } from '../admin/serverUtil'
import * as db from '../db'

@Entity("datasets")
export class Dataset extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ nullable: false }) name!: string
    @Column({ nullable: false, default: "owid" }) namespace!: string
    @Column({ nullable: false, default: "" }) description!: string
    @Column({ name: 'created_at' }) createdAt!: Date
    @Column({ name: 'updated_at' }) updatedAt!: Date
    @Column() categoryId!: number
    @Column() subcategoryId!: number
    @Column({ nullable: false, default: false }) isPrivate!: boolean

    @OneToMany(type => Variable, variable => variable.dataset)
    variables!: Variable[]

    @OneToMany(type => Source, source => source.dataset)
    sources!: Source[]

    @ManyToOne(type => User, user => user.createdDatasets)
    createdByUser!: User

    // Export dataset variables to CSV (not including metadata)
    static async writeCSV(datasetId: number, stream: Writable) {
        const csvHeader = ["Entity", "Year"]
        const variables = await db.query(`SELECT name FROM variables v WHERE v.datasetId=? ORDER BY v.columnOrder ASC, v.id ASC`, [datasetId])
        for (const variable of variables) {
            csvHeader.push(variable.name)
        }

        stream.write(csvRow(csvHeader))

        const data = await db.query(`
            SELECT e.name AS entity, dv.year, dv.value FROM data_values dv
            JOIN variables v ON v.id=dv.variableId
            JOIN datasets d ON v.datasetId=d.id
            JOIN entities e ON dv.entityId=e.id
            WHERE d.id=?
            ORDER BY e.name ASC, dv.year ASC, dv.variableId ASC`, [datasetId])

        let row: string[] = []
        for (const datum of data) {
            if (datum.entity !== row[0] || datum.year !== row[1]) {
                // New row
                if (row.length) {
                    stream.write(csvRow(row))
                }
                row = [datum.entity, datum.year]
            }

            row.push(datum.value)
        }

        // Final row
        stream.write(csvRow(row))

        stream.end()
    }

    async toCSV(): Promise<string> {
        let csv = ""
        await Dataset.writeCSV(this.id, { write: (s: string) => csv += s, end: () => null } as any)
        return csv
    }

    get slug() {
        return this.name//return slugify(this.name)
    }

    // Return object representing datapackage.json for this dataset
    async toDatapackage(): Promise<any> {
        const initialFields = [
            { name: "Entity", type: "string" },
            { name: "Year", type: "year" }
        ]

        const dataPackage = {
            name: this.slug,
            title: this.name,
            description: this.description,
            sources: [this.sources.map(s => s.toDatapackage())],
            resources: [{
                path: `${this.slug}.csv`,
                schema: {
                    fields: initialFields.concat(this.variables.map(v => ({
                        name: v.name,
                        type: "any",
                        description: v.description,
                        owidDisplaySettings: v.display
                    })))
                }
            }]
        }

        return dataPackage
    }
}