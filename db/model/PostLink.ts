import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm"
import { formatUrls } from "../../site/formatting.js"
import { getLinkType, Url, getUrlTarget } from "@ourworldindata/utils"

@Entity("posts_links")
export class PostLink extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    // TODO: posts is not a TypeORM but a Knex class so we can't use a TypeORM relationship here yet

    @Column({ type: "int", nullable: false }) sourceId!: number

    @Column() linkType!: "gdoc" | "url" | "grapher" | "explorer"
    @Column() target!: string
    @Column() queryString!: string
    @Column() hash!: string
    @Column() componentType!: string
    @Column() text!: string

    static createFromUrl({
        url,
        sourceId,
        text = "",
        componentType = "",
    }: {
        url: string
        sourceId: number
        text?: string
        componentType?: string
    }): PostLink {
        const formattedUrl = formatUrls(url)
        const urlObject = Url.fromURL(formattedUrl)
        const linkType = getLinkType(formattedUrl)
        const target = getUrlTarget(formattedUrl)
        const queryString = urlObject.queryStr
        const hash = urlObject.hash
        return PostLink.create({
            target,
            linkType,
            queryString,
            hash,
            sourceId,
            text,
            componentType,
        })
    }
}
