import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany, ManyToOne} from "typeorm"

import User from './User'
import { Variable } from './Variable'

@Entity("datasets")
export class Dataset extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ nullable: false, default: "owid" }) namespace!: string
    @Column({ nullable: false, default: "" }) description!: string
    @Column({ name: 'created_at' }) createdAt!: Date
    @Column({ name: 'updated_at' }) updatedAt!: Date
    @Column() categoryId!: number
    @Column() subcategoryId!: number
    @Column({ nullable: false, default: false }) isPrivate!: boolean

    @OneToMany(type => Variable, variable => variable.dataset)
    variables!: Variable[]

    @ManyToOne(type => User, user => user.createdDatasets)
    createdByUser!: User
}