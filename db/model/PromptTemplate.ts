import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Relation,
} from "typeorm"
import { PromptTemplateRow } from "@ourworldindata/utils"
import { User } from "./User.js"

@Entity("prompt_templates")
export class PromptTemplate extends BaseEntity implements PromptTemplateRow {
    @PrimaryGeneratedColumn() id!: number
    @Column() name!: string
    @Column() prompt!: string
    @Column() text!: string
    @Column() lastEditedByUserId!: number
    @Column() createdAt!: Date
    @Column({
        nullable: true,
    })
    updatedAt!: Date

    @ManyToOne(() => User, (user) => user.lastEditedCharts)
    lastEditedByUser!: Relation<User>
}
