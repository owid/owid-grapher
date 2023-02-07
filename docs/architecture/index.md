# Overall architecture

## Overview

Our World In Data is a statically rendered ("JAMstack") publication with no public facing backend. It has two primary codebases:

- [owid-grapher](https://github.com/owid/owid-grapher): a Typescript project used to build the overall publication and its admin tools
- [etl](https://github.com/owid/etl): a Python data-pipeline used to build the datasets that power our site

There four different types of users of our infrastructure: _readers_, _authors_, _data scientists_ and _engineers_.

```mermaid
graph TB

reader(["👤 reader"]) -->|reads| owid[Our World In Data site]
author(["👤 author"]) -->|writes articles| owid
data(["👤 data scientist"]) -->|manages data| owid
engineer(["👤 engineer"]) -->|deploys changes| owid
```

If we break it down one layer further, we can see two main workspaces for staff:

- An [internal admin site](admin.md) for managing the site and its data, used by _authors_ and _data managers_
- A [data pipeline](data-pipeline.md) used by _data managers_ to import and transform datasets

The output of these two workspaces is our [live site](live-site.md) that _readers_ access. 

### Authors

### Data scientists

- Data scientists are responsible for finding and importing data from upstream providers, and putting it through our editorial process
- They may use the grapher admin for small datasets, or our ETL for larger datasets
- Our ETL is a custom Python project designed to be executable by the public
- It defines the following stages of data processing:
    - `upstream`: the original data with the provider
    - `snapshot`: a copy of the original data, for reproducibility
    - `meadow`: the data reformatted to a standard format
    - `garden`: the data harmonized to use reference names for countries and regions
    - `mysql`: the data transformed for our charting tool Grapher
- A common challenge is updating existing charts to use newer available data
    - The grapher admin supports a chart revision tool that helps with this process

```mermaid
graph TB

subgraph etl["ETL"]
    direction LR
    upstream -.->|save| snapshot
    snapshot -->|reformat| meadow -->|harmonize| garden
end

grapher[grapher admin]
grapher --> mysql

dm(["👤 data scientist"]) -->|manage large datasets| etl
dm -->|manage charts & small data| grapher
etl --> mysql
```

Documentation on our data pipeine is available [here](https://docs.owid.io/projects/etl/en/latest/).

### Engineers

- Engineers are responsible for deploying changes to the site
- They tend to work either in the Typescript [owid-grapher](https://github.com/owid/owid-grapher) codebase or the Python [etl](https://github.com/owid/etl) codebase
    - Each of these repos describes its own dev setup
- Developers have access to staging environments
- Operationally, internal tools run off a number of small hand-managed servers in DigitalOcean, and off a high-capacity Hetzner dedicated server called `foundation`
    - `foundation` is used as a host for LXC containers
- Most development is done on local machines, using Docker for supporting services
- We track our work using Github issues and Github Projects
- We are increasingly using Buildkite for CI, and LXC containers for new services we need

A map of our infrastructure is as follows:

```mermaid
graph TB

subgraph Hetzner
    subgraph FSN1[FSN1 region]
        subgraph foundation[foundation LXC host]
            subgraph covid-cron
                covid-19
            end
            subgraph etl-build
                buildkite-agent
            end
            subgraph etl-prod
                etl
            end
        end
    end
end

subgraph digitalocean[Digital Ocean]
    subgraph LON1[LON1 region]
        subgraph owid-live
            grapher-admin
            wordpress-admin
            baker
        end
        subgraph owid-live-db
            mysql
        end
        grapher-admin --> mysql
        wordpress-admin --> mysql
        baker --> mysql
    end


    subgraph NYC1[NYC1 region]
        subgraph s3
            covid-19-data
            data-catalog
        end
    end
end

subgraph github
    covid-19-repo
    etl-repo
end

etl --> data-catalog
etl --> mysql
covid-19 --> mysql
covid-19 --> covid-19-data
covid-19 --> covid-19-repo
buildkite-agent --> etl-repo
buildkite-agent --> data-catalog
```

## Transitions underway

### Google Docs and ArchieML

- We are currently moving away from Wordpress and towards Google Docs with [ArchieML](http://archieml.org/) markup for authoring
    - This balances ease of authoring and ease of review in the editorial process
- Our goal in 2023 is to completely move off of Wordpress and convert all existing content to Google Docs

## New fast track for small data

- Part of the `grapher-admin` is dedicated to importing small datasets
  - We nickname it the "fast track"
- We are building a new fast track on top of the ETL, using Google Sheets as the authoring tool
- This will make the ETL authoritative for data values, but non-authoritative for metadata
  - Data curation tools on top of MySQL may layer metadata edits on top, making MySQL authoritative for metadata
