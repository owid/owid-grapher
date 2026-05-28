import { OwidGdocType } from "../gdocTypes/Gdoc.js"
import { WP_PostType } from "../wordpressTypes/WordpressTypes.js"
import { RelatedChart } from "../grapherTypes/GrapherTypes.js"

export interface IndexPost {
    title: string
    slug: string
    type?: WP_PostType | OwidGdocType
    date: Date
    modifiedDate: Date
    authors: string[]
    excerpt?: string
    imageUrl?: string
}

export interface FullPost extends IndexPost {
    id: number
    path: string
    content: string
    thumbnailUrl?: string
    imageId?: number
    postId?: number
    relatedCharts?: RelatedChart[]
}
