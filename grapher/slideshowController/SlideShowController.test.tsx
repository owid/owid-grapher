#! /usr/bin/env yarn jest

import { SlideShowController } from "./SlideShowController"

it("can create a new slideshow", () => {
    let newSlide = ""
    const setSlide = (slide: string) => (newSlide = slide)
    const slideShow = new SlideShowController(["red", "blue"], 0, { setSlide })

    expect(newSlide).toEqual("")
    expect(slideShow.isEmpty).toEqual(false)
    slideShow.playNext()
    expect(newSlide).toEqual("blue")
    slideShow.playPrevious()
    expect(newSlide).toEqual("red")
    slideShow.playPrevious()
    expect(newSlide).toEqual("blue")
})
