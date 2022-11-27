FROM node:16 as build
WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm install
COPY . .
RUN npx -y prisma generate
RUN npm run build
CMD node build/main.js