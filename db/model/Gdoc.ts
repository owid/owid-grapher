import { Entity, PrimaryColumn, Column, BaseEntity } from "typeorm"
import { OwidArticleContent } from "../../clientUtils/owidTypes.js"

@Entity("posts_gdocs")
export class Gdoc extends BaseEntity {
    @PrimaryColumn() id!: string
    @Column() slug!: string
    @Column({ default: "{}", type: "json" }) content!: OwidArticleContent
    @Column() published!: boolean
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
}
