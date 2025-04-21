import { describe, expect, it } from "vitest"
import { urlRegex } from "./remarkPlainLinks.js"

describe("urlRegex", () => {
    const urls = [
        "https://example.com",
        "http://example.com/",
        "http://example.com/path/to/resource",
        "http://example.com/path/to/resource?query=string",
        "http://example.com/path/to/resource.svg#fragment",
        "http://example.com/path/to/resource?query=string#fragment",
        "http://example.com/path/to/resource#fragment?query=string",
        "http://example.com/path/to/resource?query=string&another=query#fragment",
        "https://sub1.sub2.example.com/path/to/resource#fragment&another=query?query=string",
        "https://sub1.sub2.example.com/path/to/你好",
    ]

    it.each(urls)("should match URL: %s", (url) => {
        const input = `This is a test string with a URL: ${url}`
        const match = input.match(urlRegex)
        expect(match).toBeTruthy()
        expect(match![0]).toBe(url)
    })

    it("should match multiple URLs in string", () => {
        const input = `This is a test string with a URL: ${urls[0]} and another URL: ${urls[1]}`
        const matches = input.match(urlRegex)
        expect(matches).toBeTruthy()
        expect(matches).toHaveLength(2)
        expect(matches![0]).toBe(urls[0])
        expect(matches![1]).toBe(urls[1])
    })

    it("should match all URLs", () => {
        const input = `This is a test string with all URLs: ${urls.join(" ")}`
        const matches = input.match(urlRegex)
        expect(matches).toBeTruthy()
        expect(matches).toHaveLength(urls.length)
        urls.forEach((url, index) => {
            expect(matches![index]).toBe(url)
        })
    })

    it("should not match non-URL", () => {
        const input =
            "This is a test string without a URL, but it contains http:// and example.com"
        const match = input.match(urlRegex)
        expect(match).toBeFalsy()
    })

    it("should exclude trailing period", () => {
        const input = `This is an http://example.com.`
        const match = input.match(urlRegex)
        expect(match).toBeTruthy()
        expect(match![0]).toBe("http://example.com")
    })

    it("should exclude trailing question mark", () => {
        const input = `Is this an http://example.com?`
        const match = input.match(urlRegex)
        expect(match).toBeTruthy()
        expect(match![0]).toBe("http://example.com")
    })

    it("should match urls without TLD", () => {
        const input = `This is a test string with a URL: http://staging-site-example`
        const match = input.match(urlRegex)
        expect(match).toBeTruthy()
        expect(match![0]).toBe("http://staging-site-example")
    })

    it("should match localhost URLs with port", () => {
        const input = `This is a test string with a URL: http://localhost:3000/path/to/resource`
        const match = input.match(urlRegex)
        expect(match).toBeTruthy()
        expect(match![0]).toBe("http://localhost:3000/path/to/resource")
    })
})
