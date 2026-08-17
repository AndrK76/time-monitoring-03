FROM node:20-alpine AS build
WORKDIR /app


# 1. Копируем только package.json для кеширования зависимостей
COPY ../../front/package*.json ./
RUN npm install

# 2. Копируем workspace конфиги
COPY ../../front/angular.json .
COPY ../../front/tsconfig*.json .


# 3. Копируем библиотеку shared и приложение admin-test
COPY ../../front/projects/shared-test ./projects/shared-test
COPY ../../front/projects/admin-test ./projects/admin-test

# 4. Собираем shared и admin-test
RUN npx ng build shared-test
RUN npx ng build admin-test --configuration production


FROM nginx:alpine

RUN echo "Build date: $(date)" > /tmp/build-date.txt

# Копируем собранное приложение
COPY --from=build /app/dist/admin-test/browser/. /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
#CMD ["sh", "-c", "echo 'Ready for inspect' && tail -f /dev/null"]
