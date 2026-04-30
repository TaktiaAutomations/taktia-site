# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

# Run stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
