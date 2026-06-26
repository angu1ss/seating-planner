FROM node:22-alpine AS base
WORKDIR /app

FROM base AS dev
ENV NODE_ENV=development
# Font Awesome Pro token (build-time only, not baked into the image env).
ARG FONTAWESOME_NPM_AUTH_TOKEN=
COPY package.json package-lock.json .npmrc ./
RUN FONTAWESOME_NPM_AUTH_TOKEN="$FONTAWESOME_NPM_AUTH_TOKEN" npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
