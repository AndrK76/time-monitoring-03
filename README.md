# Monitoring3

Многомодульный проект системы мониторинга с аутентификацией через OAuth2 и Telegram.

## Структура проекта
monitoring3/
├── back/ # Backend модули (Spring Boot)
├── front/ # Frontend модули (Angular)
├── docker/ # Docker конфигурации
├── release/ # Собранные JAR файлы
└── README.md

## Технологии

- **Backend**: Java 21, Spring Boot 3.4.0, Spring Security, OAuth2, JWT
- **Frontend**: Angular 17-21 (в разработке)
- **Database**: PostgreSQL, Flyway
- **Cache**: Redis
- **Messaging**: Telegram Bot API
- **Container**: Docker, Docker Compose

## Быстрый старт

### Сборка

```bash
cd back
mvn clean package
```

### Запуск через Docker
```bash
cd docker
docker-compose up -d
```

### Модули
#### Core модули
core-common - Общие утилиты и DTO
core-persistence - Сущности и репозитории
core-security - Аутентификация и авторизация
core-telegram - Интеграция с Telegram
core-web - Web слой и контроллеры

#### Сервисы
service-monitoring - Основной сервис мониторинга
service-admin - Сервис администрирования
api-gateway - API Gateway (Spring Cloud Gateway)
