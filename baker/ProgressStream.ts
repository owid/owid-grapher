import { WriteStream } from "tty"

// Wrap stderr before passing it to ProgressBar so we can save all writes
// and replay them at the end of the bake. Without this the progress bar class
// works fine, but there is no way to show the summary once the job is complete.
export class ProgressStream implements Partial<WriteStream> {
    private wrappedStream: WriteStream
    constructor(wrap: WriteStream) {
        this.wrappedStream = wrap
    }

    isTTY = true

    private allWrites: string[] = []

    replay() {
        console.log(this.allWrites.join(""))
    }

    write(buffer: string) {
        this.allWrites.push(buffer)
        return this.wrappedStream.write(buffer)
    }

    cursorTo(index: number) {
        return this.wrappedStream.cursorTo(index)
    }

    clearLine(direction: 1) {
        return this.wrappedStream.clearLine(direction)
    }

    get columns() {
        return this.wrappedStream.columns
    }
}
