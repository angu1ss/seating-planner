FROM node:22-alpine AS base
WORKDIR /app

FROM base AS dev
ARG FONTAWESOME_NPM_AUTH_TOKEN
ENV NODE_ENV=development
ENV FONTAWESOME_NPM_AUTH_TOKEN="$FONTAWESOME_NPM_AUTH_TOKEN"
COPY package.json .npmrc ./
RUN npm install --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
