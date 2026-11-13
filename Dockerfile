FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:26-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:26-alpine
RUN apk add --no-cache tzdata
ENV TZ=Europe/Warsaw \
    NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data && chown app:app /data
USER app
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "dist/index.js"]
