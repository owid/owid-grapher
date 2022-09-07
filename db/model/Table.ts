import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    Unique,
    ManyToOne,
    Relation,
} from "typeorm"

import { Dataset } from "./Dataset.js"

@Entity("tables")
@Unique(["shortName", "datasetId"])
export class Table extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() datasetId!: number
    @Column({ length: 512, nullable: true }) name!: string
    @Column() shortName!: string
    @Column("text", { default: "" }) description!: string

    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column() createdByUserId!: number
    @Column() updatedByUserId!: number

    @ManyToOne(() => Dataset, (dataset) => dataset.tables)
    dataset!: Relation<Dataset>
}
