import { MigrationInterface, QueryRunner } from "typeorm"
import fs from "fs/promises"
import { get, set } from "lodash"

/**
 * This file includes the code I used to generate the data we're inserting into the new column
 */

// SELECT name FROM tags WHERE isTopic = TRUE
const topicTagNames = [
    "Population Growth",
    "Fertility Rate",
    "Age Structure",
    "Child & Infant Mortality",
    "Life Expectancy",
    "Gender Ratio",
    "Eradication of Diseases",
    "HIV/AIDS",
    "Malaria",
    "Maternal Mortality",
    "Smoking",
    "Suicides",
    "Vaccination",
    "Cancer",
    "Financing Healthcare",
    "Causes of Death",
    "Burden of Disease",
    "Cardiovascular Diseases",
    "Tuberculosis",
    "Mental Health",
    "Food Supply",
    "Hunger & Undernourishment",
    "Famines",
    "Human Height",
    "Employment in Agriculture",
    "Fertilizers",
    "Food Prices",
    "Agricultural Production",
    "Diet Compositions",
    "Obesity",
    "Meat & Dairy Production",
    "CO2 & Greenhouse Gas Emissions",
    "Energy",
    "Nuclear Energy",
    "Renewable Energy",
    "Fossil Fuels",
    "Forests & Deforestation",
    "Indoor Air Pollution",
    "Land Use",
    "Natural Disasters",
    "Oil Spills",
    "Climate Change",
    "Biodiversity",
    "Water Use & Stress",
    "Ozone Layer",
    "Air Pollution",
    "Waste Management",
    "Research & Development",
    "Technological Change",
    "Space Exploration & Satellites",
    "Economic Growth",
    "Economic Inequality",
    "Economic Inequality by Gender",
    "Happiness & Life Satisfaction",
    "Human Development Index (HDI)",
    "Light at Night",
    "Working Hours",
    "Urbanization",
    "Homelessness",
    "Child Labor",
    "Government Spending",
    "Trade & Globalization",
    "Tourism",
    "Migration",
    "Nuclear Weapons",
    "Terrorism",
    "War & Peace",
    "Democracy",
    "Homicides",
    "Women's Rights",
    "Human Rights",
    "Violence Against Children & Children's Rights",
    "LGBT+ Rights",
    "Animal Welfare",
    "Education Spending",
    "Global Education",
    "Tertiary Education",
    "Quality of Education",
    "Literacy",
    "Pre-Primary Education",
    "Teachers & Schools",
    "Books",
    "Internet",
    "Trust",
    "Marriages & Divorces",
    "Smallpox",
    "Diarrheal Diseases",
    "Polio",
    "Neurodevelopmental Disorders",
    "Alcohol Consumption",
    "Pesticides",
    "Plastic Pollution",
    "Sanitation",
    "Transport",
    "Taxation",
    "Corruption",
    "Women's Employment",
    "Poverty",
    "Micronutrient Deficiency",
    "Tetanus",
    "Access to Energy",
    "Crop Yields",
    "COVID-19",
    "Fish & Overfishing",
    "Environmental Impacts of Food Production",
    "Lead Pollution",
    "Biological & Chemical Weapons",
    "Artificial Intelligence",
    "Farm Size",
    "Influenza",
    "Rights of Marginalized Ethnic Groups",
    "Pandemics",
    "Alzheimer's & Dementia",
    "Clean Water & Sanitation",
    "Electricity Mix",
    "Energy Mix",
    "Global Health",
    "Labor Supply & Employment",
    "Loneliness & Social Connections",
    "Mpox (monkeypox)",
    "Outdoor Air Pollution",
    "Pneumonia",
    "Primary & Secondary Education",
    "State Capacity",
    "Time Use",
    "Illicit Drug Use",
    "Military Personnel & Spending",
    "Clean Water",
]

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/&/g, "and")
        .replace(/'/g, "")
        .replace(/[^\w-]+/g, "")
}

const TS_DIR = "./db/migration"

const SLUGMAP_FILENAME = "1701450183524-TagTopicSlug.json"

const SLUGMAP_PATH = `${TS_DIR}/${SLUGMAP_FILENAME}`

async function readSlugMap(): Promise<Record<string, string>> {
    return fs
        .readFile(SLUGMAP_PATH, "utf8")
        .then(JSON.parse)
        .catch(async (e) => {
            if (e.code === "ENOENT") {
                console.log("slugMap.json doesn't exist. Creating it.")
                await fs.writeFile(SLUGMAP_PATH, "{}")
                return {}
            } else {
                throw e
            }
        })
}

async function writeToSlugMap(path: string, slug: string): Promise<void> {
    let slugMap = await readSlugMap()
    const value = get(slugMap, path)
    if (value) {
        console.log(`${path} → ${slug} already exists in slugMap.json`)
        return
    }

    slugMap = set(slugMap, path, slug)

    await fs.writeFile(SLUGMAP_PATH, JSON.stringify(slugMap, null, 2))
    return
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function resolveSlugs(): Promise<void> {
    console.log("Resolving slugs 🚀")
    const slugMap = await readSlugMap()
    for (const topicTagName of topicTagNames) {
        // Skip if already in slugMap
        if (
            get(slugMap, topicTagName) ||
            get(slugMap, ["unresolved", topicTagName])
        )
            continue

        const slugCandidate = slugify(topicTagName)
        console.log("Trying: ", slugCandidate)
        const attempt = await fetch(
            `https://ourworldindata.org/${slugCandidate}`
        )

        if (attempt.status === 200) {
            console.log(
                `${topicTagName} successfully resolved to ${slugCandidate}`
            )
            await writeToSlugMap(topicTagName, slugCandidate)
        }
        if (attempt.status === 404) {
            console.log(
                `${topicTagName} could not be resolved to ${slugCandidate}`
            )
            await writeToSlugMap(`unresolved.${topicTagName}`, slugCandidate)
            continue
        }
    }
}

// According to @edomt, these topics have been deprecated
const topicsThatAreNoLongerTopics = [
    "Teachers & Schools",
    "Rights of Marginalized Ethnic Groups",
    "Alzheimer's & Dementia",
    "Labor Supply & Employment",
].map((topic) => topic.replace(/'/g, "''"))

// prettier-ignore
const manualSlugMap: Record<string, string> = {
    "HIV/AIDS": "hiv-aids",
    "Suicides": "suicide",
    "Meat & Dairy Production": "meat-production",
    "Water Use & Stress": "water-use-stress",
    "Human Development Index (HDI)": "human-development-index",
    "Space Exploration & Satellites": "space-exploration-satellites",
    "Violence Against Children & Children's Rights": "violence-against-rights-for-children",
    "Education Spending": "financing-education",
    "Women's Employment": "female-labor-supply",
    "Access to Energy": "energy-access",
    "COVID-19": "coronavirus",
    "Environmental Impacts of Food Production": "environmental-impacts-of-food",
    "Clean Water & Sanitation": "clean-water-sanitation",
    "Global Health": "health-meta",
    "Loneliness & Social Connections": "social-connections-and-loneliness",
    "Mpox (monkeypox)": "monkeypox",
    "Military Personnel & Spending": "military-personnel-spending",
    // These three don't yet have published pages, but will in the next month
    "Cardiovascular Diseases": "cardiovascular-diseases",
    "Tuberculosis": "tuberculosis",
    "Pandemics": "pandemics",
}

// The result of running resolveSlugs() on 2023-12-01
// Plus manualSlugMap resolutions
// Minus topicsThatAreNoLongerTopics
// prettier-ignore
const tagNameSlugResolutions = {
   ...manualSlugMap,
  "Child & Infant Mortality": "child-and-infant-mortality",
  "Child Labor": "child-labor",
  "Women's Rights": "womens-rights",
  "Light at Night": "light-at-night",
  "Population Growth": "population-growth",
  "Fertility Rate": "fertility-rate",
  "Age Structure": "age-structure",
  "Life Expectancy": "life-expectancy",
  "Gender Ratio": "gender-ratio",
  "Eradication of Diseases": "eradication-of-diseases",
  "Malaria": "malaria",
  "Maternal Mortality": "maternal-mortality",
  "Smoking": "smoking",
  "Vaccination": "vaccination",
  "Cancer": "cancer",
  "Financing Healthcare": "financing-healthcare",
  "Causes of Death": "causes-of-death",
  "Burden of Disease": "burden-of-disease",
  "Mental Health": "mental-health",
  "Food Supply": "food-supply",
  "Hunger & Undernourishment": "hunger-and-undernourishment",
  "Famines": "famines",
  "Human Height": "human-height",
  "Employment in Agriculture": "employment-in-agriculture",
  "Fertilizers": "fertilizers",
  "Food Prices": "food-prices",
  "Agricultural Production": "agricultural-production",
  "Diet Compositions": "diet-compositions",
  "Obesity": "obesity",
  "CO2 & Greenhouse Gas Emissions": "co2-and-greenhouse-gas-emissions",
  "Energy": "energy",
  "Nuclear Energy": "nuclear-energy",
  "Renewable Energy": "renewable-energy",
  "Fossil Fuels": "fossil-fuels",
  "Forests & Deforestation": "forests-and-deforestation",
  "Indoor Air Pollution": "indoor-air-pollution",
  "Land Use": "land-use",
  "Natural Disasters": "natural-disasters",
  "Oil Spills": "oil-spills",
  "Climate Change": "climate-change",
  "Biodiversity": "biodiversity",
  "Ozone Layer": "ozone-layer",
  "Air Pollution": "air-pollution",
  "Waste Management": "waste-management",
  "Research & Development": "research-and-development",
  "Technological Change": "technological-change",
  "Economic Growth": "economic-growth",
  "Economic Inequality": "economic-inequality",
  "Economic Inequality by Gender": "economic-inequality-by-gender",
  "Happiness & Life Satisfaction": "happiness-and-life-satisfaction",
  "Working Hours": "working-hours",
  "Urbanization": "urbanization",
  "Homelessness": "homelessness",
  "Government Spending": "government-spending",
  "Trade & Globalization": "trade-and-globalization",
  "Tourism": "tourism",
  "Migration": "migration",
  "Nuclear Weapons": "nuclear-weapons",
  "Terrorism": "terrorism",
  "War & Peace": "war-and-peace",
  "Democracy": "democracy",
  "Homicides": "homicides",
  "Human Rights": "human-rights",
  "LGBT+ Rights": "lgbt-rights",
  "Animal Welfare": "animal-welfare",
  "Global Education": "global-education",
  "Tertiary Education": "tertiary-education",
  "Quality of Education": "quality-of-education",
  "Literacy": "literacy",
  "Pre-Primary Education": "pre-primary-education",
  "Books": "books",
  "Internet": "internet",
  "Trust": "trust",
  "Marriages & Divorces": "marriages-and-divorces",
  "Smallpox": "smallpox",
  "Diarrheal Diseases": "diarrheal-diseases",
  "Polio": "polio",
  "Neurodevelopmental Disorders": "neurodevelopmental-disorders",
  "Alcohol Consumption": "alcohol-consumption",
  "Pesticides": "pesticides",
  "Plastic Pollution": "plastic-pollution",
  "Sanitation": "sanitation",
  "Transport": "transport",
  "Taxation": "taxation",
  "Corruption": "corruption",
  "Poverty": "poverty",
  "Micronutrient Deficiency": "micronutrient-deficiency",
  "Tetanus": "tetanus",
  "Crop Yields": "crop-yields",
  "Fish & Overfishing": "fish-and-overfishing",
  "Lead Pollution": "lead-pollution",
  "Biological & Chemical Weapons": "biological-and-chemical-weapons",
  "Artificial Intelligence": "artificial-intelligence",
  "Farm Size": "farm-size",
  "Influenza": "influenza",
  "Electricity Mix": "electricity-mix",
  "Energy Mix": "energy-mix",
  "Outdoor Air Pollution": "outdoor-air-pollution",
  "Pneumonia": "pneumonia",
  "Primary & Secondary Education": "primary-and-secondary-education",
  "State Capacity": "state-capacity",
  "Time Use": "time-use",
  "Illicit Drug Use": "illicit-drug-use",
  "Clean Water": "clean-water"
}

export class TagTopicSlug1701450183524 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // change isTopic to FALSE for topics that are no longer topics
        await queryRunner.query(`
            UPDATE tags
            SET isTopic = FALSE
            WHERE name IN ('${topicsThatAreNoLongerTopics.join("','")}')
        `)

        await queryRunner.query(`
            ALTER TABLE tags
            ADD COLUMN slug VARCHAR(512) DEFAULT NULL UNIQUE
        `)

        for (const [tagName, slug] of Object.entries(tagNameSlugResolutions)) {
            await queryRunner.query(`
                UPDATE tags
                SET slug = '${slug}'
                WHERE name = '${tagName.replaceAll("'", "''")}'
                AND isTopic = TRUE
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // There is no need to revert isTopic changes

        queryRunner.query(`
            ALTER TABLE tags
            DROP COLUMN slug
        `)
    }
}
