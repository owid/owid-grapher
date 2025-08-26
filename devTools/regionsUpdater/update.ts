import { readFile, writeFile } from "fs/promises"
import { execFileSync } from "child_process"
import { parse } from "papaparse"
import { topology } from "topojson-server"
import {
    type FeatureCollection,
    type Polygon,
    type MultiPolygon,
} from "geojson"
import prettier from "prettier"
import * as _ from "lodash-es"

const ETL_REGIONS_URL =
        process.env.ETL_REGIONS_URL ||
        "https://catalog.ourworldindata.org/external/owid_grapher/latest/regions/regions.csv?nocache",
    GEO_JSON_URL =
        "https://raw.githubusercontent.com/alexabruck/worldmap-sensitive/master/dist/world.geo.json",
    GRAPHER_ROOT = __dirname.replace(/\/devTools.*/, ""),
    GRAPHER_REGIONS_PATH = `${GRAPHER_ROOT}/packages/@ourworldindata/utils/src/regions.json`,
    GRAPHER_TOPOLOGY_PATH = `${GRAPHER_ROOT}/packages/@ourworldindata/grapher/src/mapCharts/MapTopology.ts`,
    SEARCH_ALIASES = {
        ARE: ["UAE"],
        CZE: ["Czech Republic"],
        GBR: ["UK"],
        MKD: ["Macedonia"],
        SWZ: ["Swaziland"],
        USA: ["US", "USA"],
    },
    REGIONS_TO_EXCLUDE: string[] = [],
    // used for Intl.DisplayNames mapping
    // see https://github.com/unicode-org/cldr/blob/480029bab5301d79e762b872b463e9101ba91a40/common/main/en.xml#L927-L957 for these codes
    // note that these currently only work in Firefox and Safari, not Chrome: see https://issues.chromium.org/issues/40801814
    TRANSLATION_CODES = {
        OWID_WRL: "001",

        // Continents & aggregates according to OWID
        OWID_AFR: "002",
        OWID_ASI: "142",
        OWID_EUR: "150",
        OWID_MNS: "054",
        OWID_NAM: "003",
        OWID_OCE: "009",
        OWID_PYA: "061",
        OWID_SAM: "005",

        // Regions according to the UN
        UNM49_AFR: "002",
        UNM49_AMR: "019",
        UNM49_ANZ: "053",
        UNM49_ASI: "142",
        UNM49_CAM: "013",
        UNM49_CAR: "029",
        UNM49_CAS: "143",
        UNM49_EAF: "014",
        UNM49_EAS: "030",
        UNM49_EEU: "151",
        UNM49_EUR: "150",
        UNM49_LAC: ["419", "029"],
        UNM49_MAF: "017",
        UNM49_MEL: "054",
        UNM49_MIC: "057",
        UNM49_NAF: "015",
        UNM49_NAM: "003",
        UNM49_NEU: "154",
        UNM49_OCE: "009",
        UNM49_POL: "061",
        UNM49_SAF: "018",
        UNM49_SAM: "005",
        UNM49_SAS: "034",
        UNM49_SEA: "035",
        UNM49_SEU: "039",
        UNM49_SSA: "202",
        UNM49_WAF: "011",
        UNM49_WAS: "145",
        UNM49_WEU: "155",

        // Regions according to World Bank
        WB_EAP: ["030", "009"], // East Asia; Pacific ≈ Oceania
        WB_ECA: ["143", "150"],
        WB_LAC: ["419", "029"],
        WB_MENA: ["145", "015"], // Middle East ≈ Western Asia; Northern Africa
        WB_NA: "003",
        WB_SA: "034",
        WB_SSA: "202",

        // Regions according to WHO
        WHO_AFR: "002",
        WHO_AMR: "019",
        WHO_EMR: "145",
        WHO_EUR: "150",
        WHO_SEAR: "035",
        WHO_WPAC: ["030", "035", "009"], // Western Pacific ≈ East Asia + Southeast Asia + Oceania
    }

interface Entity {
    code: string
    short_code?: string
    name: string
    short_name?: string
    slug?: string
    region_type?: string
    defined_by?: string
    is_mappable?: boolean
    is_historical?: boolean
    is_unlisted?: boolean
    variant_names?: string[]
    translation_codes?: string[]
    members?: string[]
}

function prettifiedJson(obj: any): Promise<string> {
    // make sure the json we emit is diff-able even after running prettier on the repo
    return prettier.format(JSON.stringify(obj), {
        parser: "json",
        tabWidth: 4,
    })
}

function csvToJson(val: string, col: string) {
    switch (col) {
        case "is_mappable":
        case "is_historical":
        case "is_unlisted":
            return val === "True"

        case "members":
            return (val && val.split(";")) || undefined

        default:
            return val
    }
}

async function prettifiedTopology(geoJson: FeatureCollection): Promise<string> {
    // make sure the MapTopology.ts file will be diff-able even after running prettier on the repo
    const topoData = topology({ world: geoJson }),
        arcs = _.remove(topoData.arcs),
        arcJson = arcs
            .map((vector) => `${JSON.stringify(vector)},`)
            .join("\n      ")

    // sort the countries by name and make sure their properties are consistently ordered
    const geomKey = "objects.world.geometries"
    _.set(topoData, geomKey, _.sortBy(_.get(topoData, geomKey), "id"))
    _.set(
        topoData,
        geomKey,
        _.map(_.get(topoData, geomKey), (country) =>
            _.pick(country, "id", "type", "arcs")
        )
    )

    const formatted = await prettier.format(
        `export const MapTopology = ${JSON.stringify(topoData)}`,
        {
            parser: "typescript",
            tabWidth: 4,
            semi: false,
        }
    )
    return formatted.replace(
        /^( {4}arcs:\s*\[)\]/m,
        `\n    // prettier-ignore\n$1\n      ${arcJson}\n    ]`
    )
}

function transformGeography(orig: FeatureCollection): FeatureCollection {
    const type = "Feature"
    const properties = {}
    let greenlandCoords // to be pulled out of Denmark

    const features = orig.features.map(({ id, geometry }) => {
        if (id === "DNK") {
            // remove Greenland from Denmark and save for later
            const { coordinates } = geometry as MultiPolygon
            greenlandCoords = coordinates.pop()
        } else if (id === "-99") {
            // use owid code for Kosovo
            id = "OWID_KOS"
        } else if (id === "PSE") {
            // add Gaza to the outline for Palestine
            geometry = {
                type: "MultiPolygon",
                coordinates: [
                    (geometry as Polygon).coordinates,
                    [
                        [
                            [34.488107, 31.605539],
                            [34.556372, 31.548824],
                            [34.265433, 31.219361],
                            [34.488107, 31.605539],
                        ],
                    ],
                ],
            }
        }

        return { id, type, properties, geometry }
    })

    // add outline for Greenland
    if (greenlandCoords) {
        features.push({
            id: "GRL",
            type,
            properties,
            geometry: {
                type: "Polygon",
                coordinates: greenlandCoords,
            },
        })
    }

    // add outline for French Southern Territories
    features.push({
        id: "ATF",
        type,
        properties,
        geometry: {
            type: "Polygon",
            coordinates: [
                [
                    [68.935, -48.625],
                    [69.58, -48.94],
                    [70.525, -49.065],
                    [70.56, -49.255],
                    [70.28, -49.71],
                    [68.745, -49.775],
                    [68.72, -49.2425],
                    [68.8675, -48.83],
                    [68.935, -48.625],
                ],
            ],
        },
    })

    return { type: "FeatureCollection", features } as FeatureCollection
}

async function didChange(path: string, newData: string): Promise<boolean> {
    const oldData = await readFile(path, "utf8").catch(() => "")
    const message = newData === oldData ? "No changes" : "Contents changed"
    console.log(`${message}: ${path}`)

    return newData !== oldData
}

async function main() {
    // fetch geojson outlines
    console.log(`Fetching ${GEO_JSON_URL}`)
    const wsGeoJson = await (await fetch(GEO_JSON_URL)).json()
    const owidGeoJson = transformGeography(wsGeoJson)

    // fetch csv and js-ify non-string fields
    console.log(`Fetching ${ETL_REGIONS_URL}`)
    const response = await fetch(ETL_REGIONS_URL)
    let { data } = parse(await response.text(), {
        header: true,
        transform: csvToJson,
    })

    // strip out empty and excluded rows and make sure entities are sorted
    data = _.sortBy(data, "code")
        .filter((c: any) => !!c.code)
        .filter((c: any) => !REGIONS_TO_EXCLUDE.includes(c.code))

    const entities = _.map(data as Entity[], (entity) => {
        // drop redundant attrs
        if (entity.short_name === entity.name) delete entity.short_name
        if (entity.region_type !== "country" && entity.region_type !== "other")
            delete entity.is_mappable
        if (entity.defined_by === "owid") delete entity.defined_by

        // update geojson with canonical names & validate mappability flag
        const outline = owidGeoJson.features.find(
            ({ id }) => id === entity.code
        )
        if (outline) {
            outline.id = entity.name
        } else if (entity.is_mappable) {
            console.log(
                `⚠️  ${entity.name} (${entity.code}) claims to be mappable but has no geojson data`
            )
        }

        if (entity.members) entity.members = entity.members.toSorted()

        // merge in alternate search names and translation codes
        entity.variant_names = _.get(SEARCH_ALIASES, entity.code)
        entity.translation_codes = _.get(TRANSLATION_CODES, entity.code)

        if (
            entity.translation_codes &&
            !Array.isArray(entity.translation_codes)
        )
            entity.translation_codes = [entity.translation_codes]

        return _.chain(entity)
            .mapKeys((_val, key) =>
                // rename keys to camelCase
                _.camelCase(key)
            )
            .pickBy(
                // omit dangling keys
                (val) => !!val
            )
            .pick(
                // give keys a consistent ordering
                "code",
                "shortCode",
                "name",
                "shortName",
                "slug",
                "regionType",
                "definedBy",
                "isMappable",
                "isHistorical",
                "isUnlisted",
                "variantNames",
                "translationCodes",
                "members"
            )
            .value()
    })

    // generate new MapTopology.ts file and compare to old version
    const newTopology = await prettifiedTopology(owidGeoJson)
    if (await didChange(GRAPHER_TOPOLOGY_PATH, newTopology)) {
        await writeFile(GRAPHER_TOPOLOGY_PATH, newTopology)
    }

    // generate new regions.json file and compare to old version
    const regionsJson = await prettifiedJson(entities)
    if (await didChange(GRAPHER_REGIONS_PATH, regionsJson)) {
        await writeFile(GRAPHER_REGIONS_PATH, regionsJson)
        const diff = execFileSync("git", [
            "diff",
            "--color=always",
            GRAPHER_REGIONS_PATH,
        ])
        console.log(diff.toString())
        console.log(
            "Be sure to set up redirects for any slugs that have changed at:\nhttps://owid.cloud/wp/wp-admin/tools.php?page=redirection.php"
        )
    }
}

void main()
