import fs from "fs/promises"

async function exampleFunctionToProfile() {
    let sum = 0
    if (benchmarker.flags.sum) {
        for (let i = 0; i < 1000000000; i++) {
            sum += i
        }
    }

    if (benchmarker.flags.promise) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return sum
}

export class Benchmarker {
    flags: Record<string, boolean>
    accessedProperties = new Set<string>()

    constructor() {
        const bm = this
        this.flags = new Proxy(
            {},
            {
                get(target: any, prop: string, receiver: any) {
                    // don't add toJSON - it's used by JSON.stringify when writing the report
                    if (prop !== "toJSON") {
                        bm.accessedProperties.add(prop)
                    }
                    return Reflect.get(target, prop, receiver)
                },
            }
        )
    }

    async init({
        name,
        callback,
    }: {
        name: string
        callback: () => void | Promise<void>
    }) {
        console.log("Running initial performance test (all flags disabled)")
        const start = performance.now()
        await callback()
        const end = performance.now()
        console.log("Time taken", end - start)
        await this.writeReport({
            name,
            start,
            end,
            flags: Object.fromEntries(
                [...this.accessedProperties].map((key) => [key, false])
            ),
        })
        console.log(
            "Enabling all flags: ",
            [...this.accessedProperties].join(", ")
        )
        for (const key of this.accessedProperties) {
            this.flags[key] = true
        }
    }

    async runPermutation({
        name,
        flags,
        callback,
    }: {
        name: string
        flags: Record<string, boolean>
        callback: () => void | Promise<void>
    }) {
        console.log(`Running test with flags: ${JSON.stringify(flags)}`)
        for (const key of Object.keys(flags)) {
            this.flags[key] = flags[key]
        }
        const start = performance.now()
        await callback()
        const end = performance.now()
        console.log("Time taken", end - start)
        await this.writeReport({ name, start, end, flags })
    }

    async writeReport({
        name,
        end,
        start,
        flags,
    }: {
        name: string
        start: number
        end: number
        flags: Record<string, boolean>
    }) {
        await fs.mkdir("./devTools/benchmarker/results", { recursive: true })
        const serializedFlags = Object.entries(flags)
            .map(([key, value]) => `${key}-${value}`)
            .join("-")
        await fs.writeFile(
            `./devTools/benchmarker/results/${name}-${serializedFlags}.json`,
            JSON.stringify({ time: end - start, flags })
        )
    }

    async benchmark({
        name,
        callback,
    }: {
        name: string
        callback: () => void | Promise<void>
    }) {
        await this.init({ name, callback })

        // generate permutations of flags
        const flags = Object.keys(this.flags)
        const permutations = this.generatePermutations(flags)
        for (const permutation of permutations) {
            await this.runPermutation({
                name,
                flags: permutation,
                callback,
            })
        }
    }

    generatePermutations(flags: string[]): Record<string, boolean>[] {
        const permutations: Record<string, boolean>[] = []
        // start at 1 to skip the all-false permutation which we've already done in the init function
        for (let i = 1; i < 2 ** flags.length; i++) {
            const permutation: Record<string, boolean> = {}
            for (let j = 0; j < flags.length; j++) {
                // the way this works is:
                // 1 << j generates a number with a single bit set at position j
                // i & (1 << j) checks if that bit is set in the number i
                // if it is, we set the flag to true, otherwise false
                permutation[flags[j]] = Boolean(i & (1 << j))
            }
            permutations.push(permutation)
        }
        return permutations
    }
}

const benchmarker = new Benchmarker()

benchmarker.benchmark({
    name: "profiling-example-function",
    callback: async () => {
        await exampleFunctionToProfile()
    },
})
