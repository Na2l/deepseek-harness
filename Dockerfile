# syntax=docker/dockerfile:1

# ── Stage 1: pull YOUR fork and build it ─────────────────────────────────
FROM node:22-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates build-essential \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /src
# Bust the clone cache whenever the fork's master moves.
ADD "https://api.github.com/repos/Na2l/deepseek-harness/commits/master" /tmp/remote-head.json
RUN git clone --depth 1 https://github.com/Na2l/deepseek-harness.git .
RUN pnpm install --frozen-lockfile \
 && pnpm run build

# ── Stage 2: runtime (your existing setup) ───────────────────────────────
FROM node:22-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
       ca-certificates curl git openssh-client \
       build-essential python3 python3-pip python3-venv python3-dev \
       ripgrep jq unzip zip procps \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ARG DOCKER_GRP=984
RUN groupadd -g ${DOCKER_GRP} docker
RUN curl -fsSL https://get.docker.com | sh \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /src /opt/dsh
RUN ln -s /opt/dsh/apps/cli/lib/bin.js /usr/local/bin/dsh

# Chromium + system libraries for the Playwright browser plugin
# (browser-use-playwright-mcp, mounted in the base bundle).
# The browser revision must match @playwright/mcp's pinned playwright version;
# bump this version when @playwright/mcp upgrades it.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN npx --yes playwright@1.63.0-alpha-2026-08-31 install --with-deps chromium \
    && chown -R node:node /opt/playwright-browsers

# Configs and scripts (unchanged)
COPY --chown=node:node entrypoint.sh /entrypoint.sh
COPY --chown=node:node gateway.js /gateway.js
COPY --chown=node:node presets /opt/dsh-presets
RUN chmod +x /entrypoint.sh && chmod 644 /gateway.js 

RUN useradd -m -s /bin/bash node || true
RUN usermod -aG docker node
RUN mkdir -p /workspace && chown -R node:node /workspace

USER node
WORKDIR /workspace
ENV HOME=/home/node
ENV DSH_WORKSPACE=/workspace
ENV DSH_PORT=3080
VOLUME /data
EXPOSE 8080

CMD ["/entrypoint.sh"]
