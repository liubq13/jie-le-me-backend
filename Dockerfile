FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
RUN node src/seed.js
CMD ["node", "src/server.js"]
