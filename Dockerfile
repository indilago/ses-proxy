FROM node:lts-alpine

COPY . /src
WORKDIR /src
RUN npm install && npm run build
CMD ["npm", "start"]
