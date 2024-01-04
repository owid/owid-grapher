import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    type Relation,
    In,
} from "typeorm"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import { OwidGdocLinkJSON, Url } from "@ourworldindata/utils"
import { GdocBase } from "./Gdoc/GdocBase.js"
import { formatUrls } from "../../site/formatting.js"
import { OwidGdocLinkType } from "@ourworldindata/types"

@Entity("posts_gdocs_links")
export class Link extends BaseEntity implements OwidGdocLinkJSON {
    @PrimaryGeneratedColumn() id!: number
    @ManyToOne(() => GdocBase, (gdoc) => gdoc.id) source!: Relation<GdocBase>
    @Column() linkType!: OwidGdocLinkType
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
        source: GdocBase
        text?: string
        componentType?: string
    }): Link {
        const formattedUrl = formatUrls(url)
        const urlObject = Url.fromURL(formattedUrl)
        const linkType = getLinkType(formattedUrl)
        const target = getUrlTarget(formattedUrl)
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
