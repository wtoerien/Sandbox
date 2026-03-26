FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx

COPY . .

RUN mkdir -p data

EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]
