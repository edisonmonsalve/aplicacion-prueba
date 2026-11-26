# Dependencias compartidas por desarrollo y producción.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Desarrollo: conserva devDependencies para `tsx`, seeds y recarga en caliente.
# Lo usa docker-compose.yml.
FROM deps AS dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && npm run dev"]

# Producción: compila y poda devDependencies antes de la imagen final.
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS production
# El kit Docker define las variables reales; NODE_ENV habilita HSTS y el modo producción.
ENV NODE_ENV=production
WORKDIR /app

# Copia con propietario `node` para poder ejecutar la API sin privilegios.
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/migrations ./migrations

USER node
EXPOSE 3000

# Las migraciones ya compiladas se aplican al arrancar.
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/server.js"]
