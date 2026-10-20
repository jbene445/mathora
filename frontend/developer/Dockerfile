FROM node:24-slim AS build
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY api.conf /etc/nginx/api.conf
EXPOSE 80
