import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Relation,
} from "typeorm"
import { OwidDocumentLinkJSON } from "@ourworldindata/utils"
import { Gdoc } from "./Gdoc/Gdoc.js"

@Entity("posts_gdocs_links")
export class Link extends BaseEntity implements OwidDocumentLinkJSON {
    @PrimaryGeneratedColumn() id!: number
    @ManyToOne(() => Gdoc, (gdoc) => gdoc.id) source!: Relation<Gdoc>
    @Column() linkType!: "gdoc" | "url"
    @Column() target!: string
    @Column() componentType!: string
    @Column() text!: string
}
