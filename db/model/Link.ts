import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Relation,
    In,
} from "typeorm"
import { OwidGdocLinkJSON, getLinkType, Url } from "@ourworldindata/utils"
import { Gdoc } from "./Gdoc/Gdoc.js"
import { formatUrls } from "../../site/formatting.js"

@Entity("posts_gdocs_links")
export class Link extends BaseEntity implements OwidGdocLinkJSON {
    @PrimaryGeneratedColumn() id!: number
    @ManyToOne(() => Gdoc, (gdoc) => gdoc.id) source!: Relation<Gdoc>
    @Column() linkType!: "gdoc" | "url" | "grapher" | "explorer"
    @Column() target!: string
    @Column() queryString!: string
    @Column() hash!: string
    @Column() componentType!: string
    @Column() text!: string

    static async getPublishedLinksTo(
        ids: string[],
        linkType?: Link["linkType"]
    ): Promise<Link[]> {
        return Link.find({
            where: { target: In(ids), linkType },
            relations: ["source"],
        }).then((links) => links.filter((link) => link.source.published))
    }

    static createFromUrl({
        url,
        source,
        text = "",
        componentType = "",
    }: {
        url: string
        source: Gdoc
        text?: string
        componentType?: string
    }): Link {
        const formattedUrl = formatUrls(url)
        const urlObject = Url.fromURL(formattedUrl)
        const linkType = getLinkType(formattedUrl)
        const target =
            linkType === "grapher" || linkType === "explorer"
                ? urlObject.slug
                : urlObject.originAndPath
        const queryString = urlObject.queryStr
        const hash = urlObject.hash
        return Link.create({
            target,
            linkType,
            queryString,
            hash,
            source,
            text,
            componentType,
        })
    }
}
