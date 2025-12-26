# Build stage
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Template generation stage ----
FROM node:20-bookworm-slim AS templates

## Tools needed only to generate templates
RUN apt-get update && apt-get install -y --no-install-recommends \
    cargo \
 && rm -rf /var/lib/apt/lists/*

## Root for all templates
WORKDIR /opt/lsp-templates

## Rust template
RUN mkdir rust \
 && cd rust \
 && cargo init --bin --name solution

## Python template
RUN mkdir python \
 && touch python/solution.py


# Runtime stage
FROM node:20-bookworm-slim
WORKDIR /app

## System deps (no Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

## Rust toolchain (runtime)
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

RUN rustup toolchain install stable --no-self-update \
 && rustup default stable \
 && rustup component add rust-src rust-analyzer

RUN rm -rf \
    /root/.cargo/registry \
    /root/.cargo/git \
    /root/.rustup/tmp \
    /root/.rustup/toolchains/*/share/doc

## pyright
RUN npm install -g pyright \
 && npm cache clean --force

## App deps
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

COPY --from=templates /opt/lsp-templates /opt/lsp-templates
ENV LSP_TEMPLATES_DIR=/opt/lsp-templates

CMD ["node", "dist/index.js"]
