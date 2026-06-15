# ============================================================================
#  Dockerfile  —  how to package hello-svc into a container image
#  Docker reads this top-to-bottom to BUILD an image, then runs it.
# ============================================================================

# Start FROM a base image that already has Node.js installed (alpine = tiny).
FROM node:24-alpine

# All following commands run inside /app in the image.
WORKDIR /app

# Copy ONLY package.json first, then install. Docker caches this layer, so
# `npm install` re-runs only when dependencies change — not on every code edit.
COPY package.json ./
RUN npm install

# Now copy the application code.
COPY index.js ./

# Document the port the app listens on (informational; doesn't publish it).
EXPOSE 3000

# The command that runs when the container starts.
CMD ["npm", "start"]
