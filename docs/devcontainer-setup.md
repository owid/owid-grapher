# Visual Studio Code Devcontainer setup

This page explains how to run our development environment entirely inside a VS Code devcontainer (no local Node.js/MySQL install required).

## Prerequisites

- [VS Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://code.visualstudio.com/docs/remote/containers)
- [Docker](https://www.docker.com/)

⚠️ If you are on Windows, configure git to use LF line endings before checkout. See [Set up git on windows](./before-you-start-on-windows.md).

## Open the repository in the devcontainer

Open this repository in VS Code. You should get a prompt to reopen in a devcontainer.

- Click **Reopen in Container**
- If VS Code asks you to rebuild later, accept so config changes are applied

On first run, database download + import can take ~5–20 minutes.
See [Checking the docker compose logs](#checking-the-docker-compose-logs).

## Important when switching from non-devcontainer setup

If you already have a `.env` from `make up` / `make up.full`, it may break `make up.devcontainer`.

`make up.devcontainer` only auto-copies `.env.devcontainer` when `.env` is missing.
So if `.env` already exists, update it (or replace it) before starting.

Recommended:

```bash
cp .env .env.backup
cp .env.devcontainer .env
```

At minimum, make sure these values are set for devcontainer mode:

- `GRAPHER_DB_HOST=db`
- `GRAPHER_DB_PORT=3306`
- `GRAPHER_TEST_DB_HOST=db`
- `GRAPHER_TEST_DB_PORT=3306`
- `ADMIN_SERVER_HOST=0.0.0.0`
- `VITE_HOST=0.0.0.0`
- `WRANGLER_IP=0.0.0.0`

If `GRAPHER_DB_HOST` is `localhost` / `127.0.0.1`, admin startup often gets stuck printing dots in `wait-for-mysql.sh`.

## Start the dev servers

In the VS Code terminal (inside the devcontainer), run:

```bash
make up.devcontainer
```

This starts a tmux session with panes for:

- admin server
- vite dev server
- local Cloudflare Functions (`wrangler pages dev`)
- welcome/help pane

Switch panes with `<Ctrl-b>`, then `n`.

## Access from your host browser

Use your normal host browser:

- Admin: http://localhost:3030/admin/charts
- Site (Vite): http://localhost:8090
- Cloudflare Functions: http://localhost:8788

VS Code devcontainer port forwarding handles host access.
The services are configured to bind to `0.0.0.0` so forwarding works reliably.

Default admin login:

- Email: `admin@example.com`
- Password: `admin`

## Stop the servers

In tmux, press `<Ctrl-b>`, then `Q` to kill the session.

Closing the VS Code window also shuts down the devcontainer services.

## Accessing MySQL

Depending on where you connect from, use different host/port values.

### 1) From inside the devcontainer terminal

```bash
mysql --skip-ssl -h db -u grapher -pgrapher grapher
```

`--skip-ssl` is needed to avoid the process of accepting self-sign certificates that mysql provisions in the container.

### 2) From a desktop DB app on your host (e.g. DBeaver)

| Setting       | Value                   |
| ------------- | ----------------------- |
| Database type | MySQL                   |
| Server        | localhost               |
| User          | grapher                 |
| Password      | grapher                 |
| Port          | 3307 (host-mapped port) |
| Database      | grapher                 |

## Running tests

```bash
yarn test
```

## Checking the docker compose logs

When using Dev Containers, there are two terminal contexts:

- **Inside devcontainer (VS Code terminal):** has node/yarn tools
- **Outside devcontainer (host terminal):** has docker CLI

To inspect container logs, run this in a host terminal at repo root:

```bash
docker compose -f docker-compose.devcontainer.yml logs -f
```

This shows logs for:

- `app` (devcontainer)
- `db` (MySQL)
- `db-load-data` (one-off DB loading)

On first setup, `db-load-data` downloads SQL dumps into `tmp-downloads/` and imports them.
When done, you should see:

✅ All done, grapher DB is loaded ✅
