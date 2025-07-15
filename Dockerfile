FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN node ace build

# Segunda etapa solo con el runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/build ./build
COPY package*.json ./
RUN npm ci --omit=dev
EXPOSE 3333
CMD ["node", "ace", "serve", "--hmr"]
