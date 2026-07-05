FROM node:22-slim

WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
CMD ["npm", "start"]
