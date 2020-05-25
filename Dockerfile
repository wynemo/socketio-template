FROM wynemo/node-slim-with-python:latest as builder
WORKDIR /app
COPY . /app
RUN npm i
CMD ["node", "server.js"]
