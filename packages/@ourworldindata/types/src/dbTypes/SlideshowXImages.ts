export const SlideshowXImagesTableName = "slideshow_x_images"

export interface DbInsertSlideshowXImage {
    id?: number
    slideshowId: number
    imageId: number
}

export type DbPlainSlideshowXImage = Required<DbInsertSlideshowXImage>
