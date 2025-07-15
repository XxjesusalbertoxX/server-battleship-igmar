FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY build ./build
COPY ace.js ./

EXPOSE 3333
CMD ["node", "build/server.js"]
