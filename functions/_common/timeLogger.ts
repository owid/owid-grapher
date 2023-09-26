export class TimeLogger {
  time: number
  lastTime: number
  name: string
  constructor(name: string) {
    this.time = Date.now()
    this.lastTime = this.time
    this.name = name
    console.log(`${name}: timer start`)
  }

  log(msg: any) {
    console.log(
      `${this.name}: [${Date.now() - this.time}ms] +${
        Date.now() - this.lastTime
      }ms`,
      msg
    )
    this.lastTime = Date.now()
  }
}
