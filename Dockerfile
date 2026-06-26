FROM node:22-alpine AS base
WORKDIR /app

FROM base AS dev
ENV NODE_ENV=development
ARG FONTAWESOME_NPM_AUTH_TOKEN
COPY package.json .npmrc ./
# No committed lockfile (native rolldown bindings differ per platform); npm install
# resolves the correct binding for this image's arch.
RUN FONTAWESOME_NPM_AUTH_TOKEN="$FONTAWESOME_NPM_AUTH_TOKEN" npm install --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
