.PHONY: up down stop logs build rebuild dev-db dev-up dev-down ps help

up:
	docker compose up -d

down:
	docker compose down

stop:
	docker compose stop

logs:
	docker compose logs -f

logs-app:
	docker compose logs -f mokas-app

logs-db:
	docker compose logs -f mokas-db

build:
	docker compose build

rebuild:
	docker compose build --no-cache

dev-db:
	docker compose -f docker-compose.dev.yml up -d

dev-db-down:
	docker compose -f docker-compose.dev.yml down

ps:
	docker compose ps

help:
	@echo "Available commands:"
	@echo "  up          - Start all services (app, db, qdrant)"
	@echo "  down        - Stop and remove all services"
	@echo "  stop        - Stop all services without removing"
	@echo "  logs        - Follow all service logs"
	@echo "  logs-app    - Follow app container logs"
	@echo "  logs-db     - Follow database logs"
	@echo "  build       - Build all images"
	@echo "  rebuild     - Build without cache"
	@echo "  dev-db      - Start development database only"
	@echo "  dev-db-down - Stop development database"
	@echo "  ps          - List running containers"
	@echo "  help        - Show this help message"
