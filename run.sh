#!/bin/bash

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   LinkVault - Full Stack Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}❌ Node.js is not installed. Please install Node.js v20+${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}❌ npm is not installed. Please install npm${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js and npm are installed${NC}"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}Installing Backend Dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

echo -e "${BLUE}Installing Frontend Dependencies...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Starting Servers...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Backend will run on: http://localhost:5001${NC}"
echo -e "${YELLOW}Frontend will run on: http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

if command -v tmux &>/dev/null; then
    echo -e "${GREEN}✓ tmux found — launching side-by-side panes${NC}"
    SESSION="linkvault"
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        tmux kill-session -t "$SESSION"
    fi
    tmux new-session -d -s "$SESSION" -c "$SCRIPT_DIR/backend" "npm run dev"
    tmux split-window -h -t "$SESSION" -c "$SCRIPT_DIR/frontend" "npm run dev"
    tmux select-pane -t 0

    cleanup() {
        echo -e "${YELLOW}Shutting down tmux session...${NC}"
        tmux kill-session -t "$SESSION" 2>/dev/null || true
        echo -e "${GREEN}✓ Servers stopped${NC}"
        exit 0
    }

    trap cleanup SIGINT SIGTERM
    tmux attach -t "$SESSION"
else
    echo -e "${YELLOW}tmux not found — starting processes in background${NC}"
    cd "$SCRIPT_DIR/backend"
    echo -e "${GREEN}▶ Starting Backend...${NC}"
    npm run dev &
    BACKEND_PID=$!

    sleep 2
    cd "$SCRIPT_DIR/frontend"
    echo -e "${GREEN}▶ Starting Frontend...${NC}"
    npm run dev &
    FRONTEND_PID=$!

    cleanup() {
        echo -e "${YELLOW}Shutting down servers...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        echo -e "${GREEN}✓ Servers stopped${NC}"
        exit 0
    }

    trap cleanup SIGINT SIGTERM
    wait $BACKEND_PID $FRONTEND_PID
fi
