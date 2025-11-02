#!/bin/bash

# Kill existing backend process
echo "Stopping existing backend..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || echo "No process on port 8080"

# Build the backend
echo "Building backend..."
./gradlew clean build -x test

# Start the backend
echo "Starting backend on port 8080..."
./gradlew bootRun

