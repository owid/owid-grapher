import { describe, expect, it } from "vitest"
import { makeDatasetPageJsonLd } from "./datasetPageJsonLd.js"

describe(makeDatasetPageJsonLd, () => {
    it("gives the JSON-LD the address of the page it is in", () => {
        const jsonLd = {
            "@context": "https://schema.org/",
            "@type": "Dataset",
            "@id": "https://catalog.ourworldindata.org/energy/owid_energy/#dataset",
            url: "https://catalog.ourworldindata.org/energy/owid_energy/",
            name: "Energy dataset",
        }
        expect(
            makeDatasetPageJsonLd(
                jsonLd,
                "https://ourworldindata.org/datasets/energy/owid_energy"
            )
        ).toEqual({
            ...jsonLd,
            "@id": "https://ourworldindata.org/datasets/energy/owid_energy#dataset",
            url: "https://ourworldindata.org/datasets/energy/owid_energy",
        })
    })
})
