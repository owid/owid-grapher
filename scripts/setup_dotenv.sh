#!/bin/bash

# Function to read the .env.example-full file and parse the environment variables
parse_env_file() {
    local file_path=$1
    declare -A env_variables

    while IFS= read -r line; do
        if [[ $line =~ ^([^#=]+)=([^#]*) ]]; then
            local key=${BASH_REMATCH[1]// /}
            local value=${BASH_REMATCH[2]// /}
            local is_optional=false
            [[ $line == *"# optional"* ]] && is_optional=true
            env_variables[$key]="$value|$is_optional"
        fi
    done < "$file_path"

    echo "${env_variables[@]}"
}

# Function to prompt the user for each required environment variable and write the values to the .env file
prompt_user_for_env_variables() {
    local env_variables=("$@")
    local env_file_path=".env"

    for env_variable in "${env_variables[@]}"; do
        IFS='|' read -r key value is_optional <<< "$env_variable"
        if [[ $is_optional == true ]]; then
            continue
        fi

        case $key in
            SECRET_KEY)
                echo "This is the secret key used for encryption. You can generate a random string for this."
                ;;
            GRAPHER_DB_NAME)
                echo "This is the name of the Grapher database."
                ;;
            GRAPHER_DB_USER)
                echo "This is the username for the Grapher database."
                ;;
            GRAPHER_DB_PASS)
                echo "This is the password for the Grapher database."
                ;;
            GRAPHER_DB_HOST)
                echo "This is the host address for the Grapher database."
                ;;
            GRAPHER_DB_PORT)
                echo "This is the port number for the Grapher database."
                ;;
            GRAPHER_TEST_DB_NAME)
                echo "This is the name of the Grapher test database."
                ;;
            GRAPHER_TEST_DB_USER)
                echo "This is the username for the Grapher test database."
                ;;
            GRAPHER_TEST_DB_PASS)
                echo "This is the password for the Grapher test database."
                ;;
            GRAPHER_TEST_DB_HOST)
                echo "This is the host address for the Grapher test database."
                ;;
            GRAPHER_TEST_DB_PORT)
                echo "This is the port number for the Grapher test database."
                ;;
            GDOCS_PRIVATE_KEY)
                echo "This is the private key for Google Docs integration."
                ;;
            GDOCS_CLIENT_EMAIL)
                echo "This is the client email for Google Docs integration."
                ;;
            GDOCS_CLIENT_ID)
                echo "This is the client ID for Google Docs integration."
                ;;
            GDOCS_BASIC_ARTICLE_TEMPLATE_URL)
                echo "This is the URL for the basic article template in Google Docs."
                ;;
            GDOCS_SHARED_DRIVE_ID)
                echo "This is the ID of the shared drive in Google Docs."
                ;;
            GDOCS_DONATE_FAQS_DOCUMENT_ID)
                echo "This is the document ID for the donation FAQs in Google Docs."
                ;;
            IMAGE_HOSTING_R2_ENDPOINT)
                echo "This is the endpoint for image hosting on R2."
                ;;
            IMAGE_HOSTING_R2_CDN_URL)
                echo "This is the CDN URL for image hosting on R2."
                ;;
            IMAGE_HOSTING_R2_BUCKET_PATH)
                echo "This is the bucket path for image hosting on R2."
                ;;
            IMAGE_HOSTING_R2_ACCESS_KEY_ID)
                echo "This is the access key ID for image hosting on R2."
                ;;
            IMAGE_HOSTING_R2_SECRET_ACCESS_KEY)
                echo "This is the secret access key for image hosting on R2."
                ;;
            OPENAI_API_KEY)
                echo "This is the API key for OpenAI."
                ;;
            GRAPHER_DYNAMIC_THUMBNAIL_URL)
                echo "This is the URL for dynamic thumbnails in Grapher."
                ;;
            ALGOLIA_ID)
                echo "This is the Algolia application ID."
                ;;
            ALGOLIA_SEARCH_KEY)
                echo "This is the Algolia search-only API key."
                ;;
            ALGOLIA_INDEX_PREFIX)
                echo "This is the prefix for Algolia indices."
                ;;
            ALGOLIA_SECRET_KEY)
                echo "This is the Algolia admin API key."
                ;;
            ALGOLIA_INDEXING)
                echo "This flag enables or disables Algolia indexing."
                ;;
            DATA_API_URL)
                echo "This is the URL for the data API."
                ;;
        esac

        read -p "Enter value for $key (default: $value): " input
        value=${input:-$value}
        echo "$key=$value" >> "$env_file_path"
    done
}

# Main function to execute the script
main() {
    local example_file_path=".env.example-full"
    local env_variables
    env_variables=($(parse_env_file "$example_file_path"))
    prompt_user_for_env_variables "${env_variables[@]}"
}

# Check for --help flag
if [[ $1 == "--help" ]]; then
    echo "Usage: ./setup_dotenv.sh"
    echo "This script helps you set up the .env file by prompting for each required environment variable."
    exit 0
fi

main
