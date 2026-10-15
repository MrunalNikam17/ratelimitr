.PHONY: help build dev test test-coverage lint format bench up down clean

help: ## Show this help message
	@echo "ratelimitr commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

build: ## Compile TypeScript to dist/
	npm run build

dev: ## Start development server with tsx watch
	npm run dev

test: ## Run Vitest test suite
	npm test

test-coverage: ## Run Vitest test suite with coverage
	npm run test:coverage

lint: ## Run ESLint across codebase
	npm run lint

format: ## Run Prettier formatting
	npm run format

bench: ## Run the benchmark suite against all 5 algorithms
	npm run benchmark

up: ## Start 3-node cluster and Redis via Docker Compose
	docker compose up --build -d

down: ## Stop Docker Compose services
	docker compose down -v

clean: ## Remove build artifacts
	rm -rf dist coverage
