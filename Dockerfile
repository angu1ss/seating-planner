FROM node:22-alpine AS base
WORKDIR /app

FROM base AS dev
ENV NODE_ENV=development
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
