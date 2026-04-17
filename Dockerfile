FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run prisma:generate
RUN npm run build

COPY docker-entrypoint-api.sh /app/docker-entrypoint-api.sh
RUN chmod +x /app/docker-entrypoint-api.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint-api.sh"]
CMD ["npm", "run", "start:vprok"]
