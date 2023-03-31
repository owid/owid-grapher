import { Entity, BaseEntity, PrimaryColumn } from "typeorm"

@Entity("posts_gdocs_links")
export class GdocPostsXTag extends BaseEntity {
    static table = "posts_gdocs_x_tags"
    @PrimaryColumn() gdocId!: string
    @PrimaryColumn() tagId!: number
}
