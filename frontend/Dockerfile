# ============================================================================
#  Dockerfile  —  Next.js frontend
#  We BUILD the app at image-build time, then run `next start` as a small
#  Node server on port 3000. nginx proxies "/" to this server.
# ============================================================================

# node:22 is a rock-solid match for Next 14. (Backend services use 24; the
# frontend just needs a proven Node + Next combo.)
FROM node:22-alpine

# Next.js on Alpine occasionally needs this compatibility shim for its native
# SWC compiler. Adding it up front avoids a confusing build error.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install deps first (cached unless package.json changes).
COPY package.json ./
RUN npm install

# Copy source and build the production bundle.
COPY . ./
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
