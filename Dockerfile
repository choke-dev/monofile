FROM node:21-alpine AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /tmp/dev
COPY package.json package-lock.json /tmp/dev/
RUN cd /tmp/dev && npm install

RUN mkdir -p /tmp/prod
COPY package.json package-lock.json /tmp/prod/
RUN cd /tmp/prod && npm install --omit=dev

FROM base AS build
COPY --from=install /tmp/dev/node_modules node_modules
COPY . .

RUN npm run build

FROM base AS app
COPY --from=install /tmp/prod/node_modules node_modules
COPY --from=build out ./
COPY package.json .

EXPOSE 3000
ENTRYPOINT [ "node", "./index.js" ]