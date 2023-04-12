import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Relation,
} from "typeorm"
import { OwidGdocLinkJSON } from "@ourworldindata/utils"
import { Gdoc } from "./Gdoc/Gdoc.js"

@Entity("posts_gdocs_links")
export class Link extends BaseEntity implements OwidGdocLinkJSON {
    @PrimaryGeneratedColumn() id!: number
    @ManyToOne(() => Gdoc, (gdoc) => gdoc.id) source!: Relation<Gdoc>
    @Column() linkType!: "gdoc" | "url" | "grapher" | "explorer"
    @Column() target!: string
    @Column() componentType!: string
    @Column() text!: string
}
