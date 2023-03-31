import { Entity, Column, BaseEntity, ManyToOne, Relation } from "typeorm"
import { Gdoc } from "./Gdoc/Gdoc.js"

@Entity("posts_gdocs_links")
export class GdocPostsXTag extends BaseEntity {
    static table = "posts_gdocs_x_tags"
    @ManyToOne(() => Gdoc, (gdoc) => gdoc.id) gdocId!: Relation<Gdoc>
    @Column() tagId!: number
}
