import { action } from "mobx"

export interface SlideShowManager<SlideData> {
    setSlide: (slide: SlideData) => void
}

// A "slide" is just a query string.
export class SlideShowController<SlideData> {
    constructor(
        slides: SlideData[] = [],
        currentIndex = 0,
        manager?: SlideShowManager<SlideData>
    ) {
        this.currentIndex = currentIndex
        this.slides = slides
        this.manager = manager
    }
    private slides: SlideData[]
    private currentIndex: number
    private manager?: SlideShowManager<SlideData>

    get isEmpty() {
        return this.slides.length === 0
    }

    @action.bound private playIndexCommand(index: number) {
        const slides = this.slides
        index = index >= slides.length ? index - slides.length : index
        index = index < 0 ? slides.length + index : index
        const slide = slides[index]

        if (this.manager) this.manager.setSlide(slide)
    }

    @action.bound playNext() {
        this.playIndexCommand(++this.currentIndex)
    }

    @action.bound playPrevious() {
        this.playIndexCommand(--this.currentIndex)
    }
}
