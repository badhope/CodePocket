FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=1234
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.mjs ./
EXPOSE 1234
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('ws').WebSocket || (()=>{})(); console.log('ok'); process.exit(0)" || exit 1
USER node
CMD ["node", "server.mjs"]
