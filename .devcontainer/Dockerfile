ARG VARIANT=16
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:dev-${VARIANT}

RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends default-mysql-client tmux bc \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*
