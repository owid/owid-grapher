import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Relation,
} from "typeorm"
import { Gdoc } from "./Gdoc/Gdoc.js"

@Entity("links")
export class Link extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @ManyToOne(() => Gdoc, (gdoc) => gdoc.id) source!: Relation<Gdoc>
    @Column() type!: "gdoc" | "url"
    @Column() target!: string
    @Column() context!: string
    @Column() text!: string
}
