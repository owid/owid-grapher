import { SlideshowConfig } from "../domainTypes/Slideshow.js"

export const SlideshowsTableName = "slideshows"

export interface DbInsertSlideshow {
    id?: number
    slug: string
    title: string
    config: SlideshowConfig
    userId: number
    createdAt?: Date
    updatedAt?: Date
    isPublished?: number
    publishedAt?: Date | null
}

export type DbPlainSlideshow = Required<DbInsertSlideshow>
