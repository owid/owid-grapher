import json
import os

import requests

organization_slug = "our-world-in-data"
pipeline_slug = "grapher-destroy-staging-environment"
api_access_token = os.environ["BUILDKITE_API_ACCESS_TOKEN"]

url = f"https://api.buildkite.com/v2/organizations/{organization_slug}/pipelines/{pipeline_slug}/builds"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_access_token}",
}

payload = {
    "commit": "HEAD",
    "branch": "master",
    "message": "Triggered build via Github action in owid-grapher repository",
    "env": {
        "BRANCH": os.environ["BRANCH"],
    },
}

response = requests.post(url, headers=headers, data=json.dumps(payload))

if response.status_code == 201:
    print("Build successfully triggered!")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"Error: {response.status_code}")
    print(response.text)
