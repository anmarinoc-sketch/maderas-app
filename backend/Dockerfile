# Imagen minima para desplegar en Cloud Run, Fly.io, Koyeb o cualquier PaaS con Docker.
FROM node:22-alpine

WORKDIR /app

# Capa de dependencias separada: solo se reconstruye si cambia el lockfile.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Cloud Run inyecta PORT; 8080 es su valor por defecto.
ENV PORT=8080
EXPOSE 8080

# Usuario sin privilegios (la imagen de node ya trae el usuario "node").
USER node

CMD ["node", "src/server.js"]
