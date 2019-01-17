import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToMany, Unique} from "typeorm"
import { Dataset } from './Dataset'

@Entity("tags")
@Unique(["name", "parentId"])
export class Tag extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number

    @Column() name!: string
    @Column() parentId!: number
    @Column() specialType!: string
    @Column() isBulkImport!: boolean

    @ManyToMany(type => Dataset)
    datasets!: Dataset[]
}