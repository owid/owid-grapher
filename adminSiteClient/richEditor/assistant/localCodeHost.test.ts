// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { createLocalCodeHost } from "./localCodeHost.js"

describe("localCodeHost", () => {
    it("writes, reads, and lists files", async () => {
        const host = createLocalCodeHost()
        await host.writeFile("/data/input.csv", "a,b\n1,2\n")
        const read = await host.readFile("/data/input.csv")
        expect(read.text).toBe("a,b\n1,2\n")
        expect((await host.listFiles()).map((f) => f.path)).toEqual([
            "/data/input.csv",
        ])
    })

    it("reads in bounded chunks with offsets", async () => {
        const host = createLocalCodeHost()
        await host.writeFile("/big.txt", "x".repeat(100))
        const first = await host.readFile("/big.txt", {
            offset: 0,
            maxChars: 40,
        })
        expect(first.text.length).toBe(40)
        expect(first.truncated).toBe(true)
        expect(first.nextOffset).toBe(40)
    })

    it("rejects relative and parent paths", async () => {
        const host = createLocalCodeHost()
        await expect(host.writeFile("nope.txt", "x")).rejects.toThrow(
            /absolute/
        )
        await expect(host.writeFile("/a/../b.txt", "x")).rejects.toThrow(
            /'\.\.'/
        )
    })

    it("runs JavaScript with fs, console, and aq", async () => {
        const host = createLocalCodeHost()
        await host.writeFile("/data/rows.json", '[{"v":1},{"v":2},{"v":3}]')
        const result = await host.runJs(`
            const rows = JSON.parse(await fs.readFile("/data/rows.json"))
            const table = aq.from(rows)
            console.log("rows:", rows.length)
            await fs.writeFile("/out/sum.txt", String(table.rollup({ s: aq.op.sum("v") }).get("s", 0)))
            return { sum: table.rollup({ s: aq.op.sum("v") }).get("s", 0) }
        `)
        expect(result.result).toEqual({ sum: 6 })
        expect(result.logs).toEqual(["rows: 3"])
        expect((await host.readFile("/out/sum.txt")).text).toBe("6")
    })

    it("times out runaway scripts", async () => {
        const host = createLocalCodeHost()
        await expect(
            host.runJs("await new Promise(() => {})", { timeoutMs: 150 })
        ).rejects.toThrow(/timed out/)
    })
})
