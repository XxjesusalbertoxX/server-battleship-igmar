# Usa una imagen ligera de Node.js
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor\WORKDIR /app

# Copia package.json y package-lock para instalar dependencias
COPY package*.json ./

# Instala solo deps de producción
RUN npm ci --omit=dev

# Copia el resto del código
COPY . .

# Compila el proyecto (TypeScript → JavaScript)
RUN node ace build --production

# Expone el puerto donde corre Adonis
EXPOSE 3333

# Arranca la app en modo producción
CMD ["node", "build/server.js"]
