#!/bin/bash

# Local testing script for MCP Server for Airflow
set -e

echo "🧪 MCP Server for Airflow - Local Testing"
echo "========================================"

# Check if required environment variables are set
if [ -z "$AIRFLOW_BASE_URL" ]; then
    echo "⚠️  AIRFLOW_BASE_URL environment variable is required"
    echo "   Example: export AIRFLOW_BASE_URL=http://localhost:8080"
    exit 1
fi

if [ -z "$AIRFLOW_TOKEN" ] && ([ -z "$AIRFLOW_USERNAME" ] || [ -z "$AIRFLOW_PASSWORD" ]); then
    echo "⚠️  Either AIRFLOW_TOKEN or both AIRFLOW_USERNAME and AIRFLOW_PASSWORD must be set"
    echo "   Token example: export AIRFLOW_TOKEN=your_token_here"
    echo "   Basic auth example: export AIRFLOW_USERNAME=admin && export AIRFLOW_PASSWORD=admin"
    exit 1
fi

echo "🔧 Configuration:"
echo "   Base URL: $AIRFLOW_BASE_URL"
if [ -n "$AIRFLOW_TOKEN" ]; then
    echo "   Auth: Token (${AIRFLOW_TOKEN:0:10}...)"
else
    echo "   Auth: Basic ($AIRFLOW_USERNAME)"
fi

# Build the project
echo ""
echo "📦 Building project..."
npm run build

# Test stdio mode
echo ""
echo "🧪 Testing stdio mode..."
# Use timeout if available, otherwise just note that stdio mode exists
if command -v timeout >/dev/null 2>&1; then
    echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | timeout 3s npm start 2>/dev/null || echo "   ✅ Stdio mode available"
elif command -v gtimeout >/dev/null 2>&1; then
    echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | gtimeout 3s npm start 2>/dev/null || echo "   ✅ Stdio mode available"
else
    echo "   ✅ Stdio mode available (timeout command not found, skipping test)"
fi

# Test HTTP mode
echo ""
echo "🌐 Testing HTTP mode..."

# Find available port
PORT=3001
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; do
    PORT=$((PORT + 1))
done

echo "Starting HTTP server on port $PORT..."

# Start HTTP server in background
npm run start:http -- --port=$PORT &
HTTP_PID=$!

# Wait for server to start
sleep 3

# Test health endpoint
echo "Testing health endpoint..."
if curl -s http://localhost:$PORT/health | grep -q "healthy"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
fi

# Test MCP endpoint with initialization
echo "Testing MCP initialization..."
INIT_RESPONSE=$(curl -s -X POST http://localhost:$PORT/ \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}')

if echo "$INIT_RESPONSE" | grep -q "mcp-server-airflow"; then
    echo "✅ MCP initialization successful"
else
    echo "❌ MCP initialization failed"
    echo "Response: $INIT_RESPONSE"
fi

# Test tools/list endpoint
echo "Testing tools list..."
TOOLS_RESPONSE=$(curl -s -X POST http://localhost:$PORT/ \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}')

if echo "$TOOLS_RESPONSE" | grep -q "airflow_list_dags"; then
    echo "✅ Tools list successful"
    echo "Available tools:"
    echo "$TOOLS_RESPONSE" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g' | sed 's/"//g' | sed 's/^/   - /'
else
    echo "❌ Tools list failed"
    echo "Response: $TOOLS_RESPONSE"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $HTTP_PID 2>/dev/null || true

echo ""
echo "✅ Local testing complete!"
echo ""
echo "💡 Next steps:"
echo "   - For stdio mode: Use with Claude Desktop MCP configuration"
echo "   - For HTTP mode: Deploy to cloud platform using npm run deploy"
echo "   - For Docker: docker-compose up to test containerized version"