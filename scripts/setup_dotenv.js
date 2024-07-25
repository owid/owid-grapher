#!/usr/bin/env node

const fs = require("fs")
const readline = require("readline")
const { execSync } = require("child_process")

function main() {
    // Check for --help flag
    if (process.argv.includes("--help")) {
        console.log("Usage: node setup_dotenv.js")
        console.log(
            "This script helps you set up the .env file by prompting for each required environment variable."
        )
        process.exit(0)
    }

    console.log("--- Setting up .env file")
    const exampleFilePath = ".env.example-full"

    // If .env does not exist, copy .env.example-full to .env
    if (!fs.existsSync(".env")) {
        console.log("Copying .env.example-full -> .env")
        fs.copyFileSync(exampleFilePath, ".env")
    }

    const envVariables = parseEnvFile(".env")
    promptUserForEnvVariables(envVariables)
}

function parseEnvFile(filePath) {
    const envVariables = []
    const fileContents = fs.readFileSync(filePath, "utf-8")
    const lines = fileContents.split("\n")

    lines.forEach((line) => {
        const match = line.match(/^([^#=]+)=([^#]*)/)
        if (match) {
            const key = match[1].trim()
            const value = match[2].trim()
            const isOptional = line.includes("# optional")
            envVariables.push({ key, value, isOptional })
        }
    })

    return envVariables
}

const hasKeyring = () => {
    try {
        execSync("keyring --version", {
            stdio: "pipe",
        })
        return true
    } catch (error) {
        return false
    }
}

const getKeyringValue = (key) => {
    try {
        const value = execSync(`keyring get grapher-dev ${key}`, {
            stdio: "pipe",
        })
            .toString()
            .trim()
        return value
    } catch (error) {
        return null
    }
}

const setKeyringValue = (key, value) => {
    try {
        execSync(`keyring set grapher-dev ${key}`, {
            input: value,
        })
    } catch (error) {
        console.error(`Error setting keyring value for ${key}:`, error.message)
        process.exit(1)
    }
}

function promptUserForEnvVariables(envVariables) {
    console.log("Scanning for missing variables...")
    const envFilePath = ".env"
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    const keyringAvailable = hasKeyring()

    const promptNext = (index) => {
        if (index >= envVariables.length) {
            rl.close()
            return
        }

        const { key, value, isOptional } = envVariables[index]
        if (isOptional) {
            promptNext(index + 1)
            return
        }

        if (keyringAvailable) {
            const keyringValue = getKeyringValue(key)
            if (keyringValue) {
                console.log(`Using value for ${key} from keyring.`)
                fs.appendFileSync(envFilePath, `${key}=${keyringValue}\n`)
                promptNext(index + 1)
                return
            }
        }

        if (value) {
            promptNext(index + 1)
            return
        }

        defaultValue = getDefaultValue(key)
        description = getDescription(key)

        console.log(description)
        const maybeDefault = value ? ` [${defaultValue}]` : ""
        rl.question(`Enter value for ${key}${maybeDefault}: `, (input) => {
            const finalValue = input.trim() || defaultValue
            fs.appendFileSync(envFilePath, `${key}=${finalValue}\n`)

            if (keyringAvailable) {
                // Save the value to keyring so that we don't have to give it next time
                setKeyringValue(key, finalValue)
            }

            promptNext(index + 1)
        })

        rl.on("SIGINT", () => {
            console.log("Exiting...")
            process.exit(1)
        })
    }

    promptNext(0)
}

const getDefaultValue = (key) => {
    return
}

const getDescription = (key) => {
    let description = ""
    switch (key) {
        case "GDOCS_PRIVATE_KEY":
            return "The private key for the Google service account in dev. Look for 'Grapher env variables' in 1password."
    }
    return ""
}
main()
