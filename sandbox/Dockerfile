# Optional base image for Daytona snapshots.
# Build/push elsewhere, then set DAYTONA_SNAPSHOT to the snapshot name.
FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl jq ripgrep ca-certificates python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/daytona
RUN mkdir -p /home/daytona/workspace/project

ENV WORKSPACE_PATH=/home/daytona/workspace/project
