# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/public ./public
EXPOSE 8080
CMD [ "npm", "start" ]