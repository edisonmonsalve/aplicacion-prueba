FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

# Las migraciones se aplican al arrancar: el healthcheck de MariaDB garantiza
# que la base ya acepta conexiones antes de ejecutarlas.
CMD ["sh", "-c", "npm run migrate && npm start"]
