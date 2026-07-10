# Claude Code on the web (claude.ai/code)

How to set up a cloud environment so Claude Code sessions can run the full
grapher dev stack (MySQL + admin server + vite) inside the sandbox, with the
production metadata database pre-imported.

## Create the environment

At <https://claude.ai/code>, open the environment selector → **Add environment**:

- **Name**: `owid-grapher`
- **Network access**: Full
- **Environment variables** — these are the same public, search-only Algolia
  credentials our site ships in its JS bundle; copy the values from your local
  `.env`. They make local site search work in the sandbox. (Environment
  variables are visible to anyone who can edit the environment — never put
  real secrets here.)

    ```
    ALGOLIA_ID=...
    ALGOLIA_SEARCH_KEY=...
    ```

- **Setup script**: paste the script below.

The first session triggers the setup script (~10 minutes: installs MySQL,
imports the metadata dump). The resulting filesystem is snapshotted, so later
sessions skip it entirely and `make up.headless` brings the site up in a few
minutes. The snapshot rebuilds when you edit the environment settings and
automatically after ~7 days, which also refreshes the database.

## Setup script

```bash
#!/bin/bash
set -euo pipefail
trap 'rc=$?; echo "SETUP FAILED at line $LINENO: $BASH_COMMAND (exit $rc)"' ERR

echo "== stage: clone repo =="
# the setup script runs before the session's repo is cloned, in an empty
# directory — shallow-clone the repo ourselves to drive the bootstrap
git clone --depth 1 https://github.com/owid/owid-grapher /opt/owid-grapher-setup
cd /opt/owid-grapher-setup

echo "== stage: node =="
NODE_VERSION=$(cat .nvmrc)
case "$(uname -m)" in aarch64|arm64) ARCH=arm64 ;; *) ARCH=x64 ;; esac
curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1
corepack enable
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack prepare --activate || true
echo "node: $(node -v)"

echo "== stage: mysql install =="
# native MySQL, no docker: the imported data in /var/lib/mysql survives the
# snapshot (which stores files, not processes), so sessions only restart mysqld
printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod +x /usr/sbin/policy-rc.d
apt-get update -q --allow-releaseinfo-change
DEBIAN_FRONTEND=noninteractive apt-get install -yq mysql-server
# 3307 so the repo's default .env works unchanged; the rest speeds up the import
printf '[mysqld]\nport=3307\nskip-log-bin\ninnodb_flush_log_at_trx_commit=0\n' > /etc/mysql/mysql.conf.d/zz-owid.cnf
rm -f /usr/sbin/policy-rc.d

echo "== stage: mysql start + user =="
service mysql start
mysql -uroot -e "CREATE USER IF NOT EXISTS 'grapher'@'%' IDENTIFIED BY 'grapher'; GRANT ALL PRIVILEGES ON *.* TO 'grapher'@'%';"

echo "== stage: download dump =="
./devTools/docker/download-grapher-metadata-mysql.sh

echo "== stage: import dump (silent, takes a few minutes) =="
cp .env.example-grapher .env
DATA_FOLDER=tmp-downloads ./devTools/docker/refresh-grapher-data.sh

echo "== stage: verify =="
mysql -ugrapher -pgrapher -h127.0.0.1 -P3307 grapher -e "SELECT count(*) AS charts FROM charts;"
echo "SETUP OK"
```

In sessions, `make up.headless` probes for the MySQL this script installed
(reachable at `127.0.0.1:3307`, matching the default `.env`), starts it if
needed, and only falls back to docker compose when nothing answers.

## What sessions can and can't do

The in-session details (starting the dev environment, thumbnails, taking
screenshots, applying migrations) live in the "Cloud sandbox sessions" section
of [CLAUDE.md](../CLAUDE.md) — sessions read that themselves. For humans, the
key limitations: staging servers are on Tailscale and unreachable from the
sandbox, and local ports can't be exposed, so verification happens through
screenshots and tests in-session, and on the branch's staging server after
pushing.

## Try it

A smoke test that exercises the whole stack:

> Start the grapher dev environment and send me a screenshot of
> http://localhost:3030/search?q=malaria&resultType=all

A small end-to-end feature demo:

> On the site search page (/search), the result-type toggle (All / Research &
> Writing / Charts / Data) doesn't show how many results each type has. Add
> the counts to the toggle labels, take a screenshot of
> /search?q=malaria&resultType=all to show me, then push the branch and give
> me the staging link.
