# ──────────────────────────────────────────────
# Runtime
# Image: ghcr.io/waghelapritesh/tac-2
# Used by: end users via docker run
# ──────────────────────────────────────────────
FROM node:24-slim AS runtime

# Git is required for TAC's git operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install TAC globally — version is controlled by the build arg
ARG TAC_VERSION=latest
RUN npm install -g tac-2@${TAC_VERSION}

# Default working directory for user projects
WORKDIR /workspace

ENTRYPOINT ["tac"]
CMD ["--help"]
