import { action, makeObservable } from "mobx"

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
        makeObservable<SlideShowController, "playIndexCommand">(this, {
            playIndexCommand: action.bound,
            playNext: action.bound,
            playPrevious: action.bound,
        })

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

    private playIndexCommand(index: number) {
        const slides = this.slides
        index = index >= slides.length ? index - slides.length : index
        index = index < 0 ? slides.length + index : index
        const slide = slides[index]

        if (this.manager) this.manager.setSlide(slide)
    }

    playNext() {
        this.playIndexCommand(++this.currentIndex)
    }

    playPrevious() {
        this.playIndexCommand(--this.currentIndex)
    }
}
