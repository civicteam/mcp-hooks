#!/bin/bash

# Setup script for MCP passthrough integration tests

set -e

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Change to project root (two levels up from test/integration)
cd "$SCRIPT_DIR/../.."

echo "Setting up MCP Passthrough Integration Test Environment"
echo "======================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required ports are available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}Error: Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

echo "Checking port availability..."
for port in 33000 33007 33008 33100 34000 34008 34100 34200; do
    if ! check_port $port; then
        echo "Please free up port $port before running tests"
        exit 1
    fi
done

echo -e "${GREEN}All required ports are available${NC}"

# Create PIDs file to track processes
PIDS_FILE="/tmp/mcp-test-servers.pids"
> $PIDS_FILE

# Function to start a server and save its PID
start_server() {
    local name=$1
    local command=$2
    
    echo -e "${YELLOW}Starting $name...${NC}"
    # Start the command and get its PID
    eval "$command" &
    local pid=$!
    echo "$pid" >> $PIDS_FILE
    
    # Give server time to start
    sleep 2
    
    if ps -p $pid > /dev/null; then
        echo -e "${GREEN}✓ $name started (PID: $pid)${NC}"
    else
        echo -e "${RED}✗ Failed to start $name${NC}"
        cleanup
        exit 1
    fi
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down test servers...${NC}"
    if [ -f $PIDS_FILE ]; then
        while read pid; do
            if ps -p $pid > /dev/null 2>&1; then
                # Use pkill to kill the process and all its children
                pkill -P $pid 2>/dev/null || true
                kill $pid 2>/dev/null || true
                echo "Stopped process $pid and its children"
            fi
        done < $PIDS_FILE
        rm $PIDS_FILE
    fi
}

# Set up cleanup on exit
trap cleanup EXIT INT TERM

# Start target servers
echo -e "\n${YELLOW}Starting target MCP servers...${NC}"

# Non-authenticated target server (using fetch-docs server)
start_server "Non-auth target server (port 33000)" \
    "cd packages/fetch-docs && PORT=33000 npx tsx src/index.ts"

# Authenticated target server (using whoami-server which has auth built-in)
start_server "Auth target server (port 33008)" \
    "cd packages/whoami-server && TEST_MODE=true PORT=33008 npx tsx src/index.ts"

# Echo test server for streaming and ping testing
start_server "Echo test server (port 33100)" \
    "cd test/integration/servers/echo && PORT=33100 npx tsx src/index.ts"

# Simple Log hook server
start_server "Simple Log hook server (port 33006)" \
    "cd packages/simple-log-hook && PORT=33006 npx tsx src/index.ts"

# Explain hook server
start_server "Explain hook server (port 33007)" \
    "cd packages/explain-hook && PORT=33007 npx tsx src/index.ts"

# Start passthrough servers
echo -e "\n${YELLOW}Starting passthrough servers...${NC}"

# Passthrough to non-auth target
start_server "Passthrough to non-auth (port 34000)" \
    "cd packages/passthrough-mcp-server && TARGET_SERVER_URL=http://localhost:33000 TARGET_SERVER_MCP_PATH=/stream PORT=34000 npx tsx src/cli.ts"

# Passthrough to auth target  
start_server "Passthrough to auth (port 34008)" \
    "cd packages/passthrough-mcp-server && TARGET_SERVER_URL=http://localhost:33008 PORT=34008 npx tsx src/cli.ts"

# Passthrough to echo server
start_server "Passthrough to echo (port 34100)" \
    "cd packages/passthrough-mcp-server && TARGET_SERVER_URL=http://localhost:33100 PORT=34100 npx tsx src/cli.ts"

# Passthrough to fetchDocs with explain hook
start_server "Passthrough with hooks to fetchDocs (port 34200)" \
    "cd packages/passthrough-mcp-server && TARGET_SERVER_URL=http://localhost:33000 TARGET_SERVER_MCP_PATH=/stream HOOKS=http://localhost:33007 PORT=34200 npx tsx src/cli.ts"

echo -e "\n${GREEN}All servers started successfully!${NC}"

# Check if running in CI mode
if [ "$CI" = "true" ] || [ "$1" = "--ci" ]; then
    echo -e "CI mode: Servers running in background, script exiting"
    echo -e "PIDs saved to: $PIDS_FILE"
    # Let script end naturally - trap won't fire on normal exit
else
    # Interactive mode - wait for interrupt
    echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
    echo -e "\nYou can now run the integration tests in another terminal:"
    echo -e "${GREEN}cd test/integration && pnpm test:integration${NC}"
    
    # Wait for interrupt
    while true; do
        sleep 1
    done
fi