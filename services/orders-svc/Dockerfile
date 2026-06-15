# Package orders-svc into a container image (same recipe as every Node service).
FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.js ./
EXPOSE 3000
CMD ["npm", "start"]
