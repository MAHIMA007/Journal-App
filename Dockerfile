FROM node:20-alpine AS runtime
WORKDIR /app

COPY server ./server
COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/server.js"]
