FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "src/index.ts"]
