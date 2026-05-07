FROM node:20-alpine AS build
WORKDIR /app
# Пусто = в бандле относительные /api/* (тот же origin, что и страница — как edem.press за nginx).
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
# Путь за reverse-proxy, напр. /stg/ для https://edem.press/stg/
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
# staging → плашка в UI (см. EnvRibbon.tsx)
ARG VITE_APP_ENV=
ENV VITE_APP_ENV=$VITE_APP_ENV
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
