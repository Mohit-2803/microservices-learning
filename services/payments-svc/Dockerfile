# Package payments-svc into a container image.
FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
# Copy both source files now (index.js uses charge.js). The test file isn't
# needed at runtime, so we don't copy it into the image.
COPY index.js charge.js ./
EXPOSE 3000
CMD ["npm", "start"]
