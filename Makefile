.PHONY: help build up down restart logs shell migrate

help:
	@echo "Available commands:"
	@echo "  make build    - Build Docker images"
	@echo "  make up       - Start containers"
	@echo "  make down     - Stop containers"
	@echo "  make restart  - Restart containers"
	@echo "  make logs     - View logs"
	@echo "  make shell    - Shell into API container"
	@echo "  make migrate  - Run Prisma migrations"

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f api

shell:
	docker exec -it bonita-api sh

migrate:
	docker exec -it bonita-api npx prisma migrate dev

clean:
	docker-compose down -v