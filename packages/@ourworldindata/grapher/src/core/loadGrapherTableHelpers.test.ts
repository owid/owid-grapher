import { afterEach, describe, expect, it, vi } from "vitest"
import { getDataApiInternalHeaders } from "@ourworldindata/utils"
import { DimensionProperty } from "@ourworldindata/types"
import { fetchInputTableForConfig } from "./loadGrapherTableHelpers.js"

// The data API only serves non-redistributable indicators' data files to
// browsers on our sites, and to our servers that send the internal key. So the
// headers a server-side caller passes must reach every request to the API.

const DATA_API_URL = "https://api.ourworldindata.org/v1/indicators/"

function mockDataApi(): Map<string, Headers> {
    const requestHeaders = new Map<string, Headers>()
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input)
        requestHeaders.set(url, new Headers(init?.headers))
        const body = url.endsWith(".metadata.json")
            ? {
                  id: 1,
                  type: "float",
                  dimensions: {
                      entities: { values: [] },
                      years: { values: [] },
                  },
              }
            : { values: [], entities: [], years: [] }
        return Response.json(body)
    })
    return requestHeaders
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe("fetching a chart's input table from the data API", () => {
    it("sends the given headers with both the data and the metadata request", async () => {
        const requestHeaders = mockDataApi()

        await fetchInputTableForConfig({
            dimensions: [{ property: DimensionProperty.y, variableId: 1 }],
            dataApiUrl: DATA_API_URL,
            dataApiHeaders: getDataApiInternalHeaders("secret"),
        })

        expect([...requestHeaders.keys()].sort()).toEqual([
            `${DATA_API_URL}1.data.json`,
            `${DATA_API_URL}1.metadata.json`,
        ])
        for (const headers of requestHeaders.values()) {
            expect(headers.get("X-OWID-Internal-Key")).toBe("secret")
            // ...without losing the User-Agent that marks our server requests
            expect(headers.get("User-Agent")).toContain("Our World In Data")
        }
    })
})
