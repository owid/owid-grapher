import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToMany, // TODO: should I use this?
} from "typeorm"

@Entity("posts_gdocs_x_images")
export class GdocXImage extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() docId!: number
    @Column() imageId!: number
}
