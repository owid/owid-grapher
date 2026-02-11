ARG VARIANT=22
FROM mcr.microsoft.com/devcontainers/javascript-node:${VARIANT}

COPY .tmux.conf /home/node/.tmux.conf

RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends default-mysql-client finger tmux bc ca-certificates jq \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g wrangler \
    && corepack enable
