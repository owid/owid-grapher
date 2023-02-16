import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Relation,
} from "typeorm"
import { Gdoc } from "./Gdoc/Gdoc.js"

export const gdocUrlRegex =
    /https:\/\/docs\.google\.com\/document\/u\/\d\/d\/([^\/]+)\/edit/

export function getUrlType(url: string): Link["type"] {
    if (url.match(gdocUrlRegex)) {
        return "gdoc"
    }
    return "url"
}

export function getUrlTarget(url: string): string {
    const gdocsMatch = url.match(gdocUrlRegex)
    if (gdocsMatch) {
        const [_, gdocId] = gdocsMatch
        return gdocId
    }
    return url
}

@Entity("links")
export class Link extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @ManyToOne(() => Gdoc, (gdoc) => gdoc.id) source!: Relation<Gdoc>
    @Column() type!: "gdoc" | "url"
    @Column() target!: string
    @Column() context!: string
    @Column() text!: string
}
