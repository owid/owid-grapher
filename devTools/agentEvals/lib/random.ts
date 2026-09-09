/** Small seeded PRNG (mulberry32) so case generation is reproducible. */
export class Random {
    private state: number

    constructor(seed: number) {
        this.state = seed >>> 0
    }

    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0
        let t = this.state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    pick<T>(items: readonly T[]): T | undefined {
        if (items.length === 0) return undefined
        return items[Math.floor(this.next() * items.length)]
    }

    /** Up to `n` distinct items, in random order. */
    sample<T>(items: readonly T[], n: number): T[] {
        const pool = [...items]
        const out: T[] = []
        while (pool.length > 0 && out.length < n) {
            const i = Math.floor(this.next() * pool.length)
            out.push(pool.splice(i, 1)[0])
        }
        return out
    }
}

export function hashString(s: string): number {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}
