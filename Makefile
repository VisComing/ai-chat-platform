.PHONY: dev start stop restart health

# Start both frontend and backend
dev:
	@echo "Starting services..."
	@cd backend && find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null; \
		fuser -k 8000/tcp 2>/dev/null || true; \
		fuser -k 3000/tcp 2>/dev/null || true; \
		sleep 1; \
		uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
	@cd frontend && npm run dev > /tmp/next.log 2>&1 &
	@echo "Waiting for services to be ready..."
	@sleep 8
	@curl -s http://localhost:8000/health || (echo "Backend failed to start, check /tmp/uvicorn.log"; tail -20 /tmp/uvicorn.log)
	@echo ""
	@echo "Services started:"
	@echo "  Backend: http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"

# Start backend only
backend:
	@cd backend && find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null; \
		fuser -k 8000/tcp 2>/dev/null || true; \
		sleep 1; \
		uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
	@echo "Backend starting on http://localhost:8000..."

# Start frontend only
frontend:
	@fuser -k 3000/tcp 2>/dev/null || true; \
		sleep 1; \
		cd frontend && npm run dev > /tmp/next.log 2>&1 &
	@echo "Frontend starting on http://localhost:3000..."

# Stop all services
stop:
	@fuser -k 8000/tcp 2>/dev/null || true
	@fuser -k 3000/tcp 2>/dev/null || true
	@echo "Services stopped"

# Restart all services
restart: stop dev

# Check health
health:
	@echo "Backend: $$(curl -s http://localhost:8000/health)"
	@echo "Frontend: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "not ready")"
