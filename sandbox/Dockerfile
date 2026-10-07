# Optional base image for Daytona snapshots.
# Build/push elsewhere, then set DAYTONA_SNAPSHOT to the snapshot name.
FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl jq ripgrep ca-certificates python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent@1.0.4

WORKDIR /home/daytona
RUN mkdir -p /home/daytona/workspace/project /home/daytona/.pi/agent/sessions /home/daytona/sandbox-runtime

ENV WORKSPACE_PATH=/home/daytona/workspace/project \
    PI_AGENT_DIR=/home/daytona/.pi/agent \
    RUNTIME_PORT=4096
