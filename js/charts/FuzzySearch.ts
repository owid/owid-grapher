const Fuse = require("fuse.js")

export default class FuzzySearch<T> {
    fuse: any

    constructor(data: T[], key: string) {
        this.fuse = new Fuse(data, {
            shouldSort: true,
            threshold: 0.6,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 1,
            keys: [key]
        })
    }

    search(input: string): T[] {
        return this.fuse.search(input)
    }
}