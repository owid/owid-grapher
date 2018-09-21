import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToMany, Unique} from "typeorm"
import { Dataset } from './Dataset'

@Entity("tag")
@Unique(["name", "categoryId"])
export class Tag extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number

    @Column() name!: string
    @Column() categoryId!: number
    @Column() type!: string

    @ManyToMany(type => Dataset)
    datasets!: Dataset[]
}