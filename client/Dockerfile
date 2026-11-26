# Etapas compartidas: dependencias y build se reutilizan entre desarrollo y producción.
FROM node:26-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Desarrollo: Vite con recarga en caliente. Lo usa docker-compose.yml.
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Producción: build estático, sin Node ni Vite en la imagen final.
FROM deps AS build
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS production
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
# La imagen ya trae un usuario sin privilegios; se declara para que quede explícito.
USER 101:101
EXPOSE 8080
