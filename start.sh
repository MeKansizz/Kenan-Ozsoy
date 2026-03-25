#!/bin/bash
echo "Kenan Ozsoy Finans Takip baslatiliyor..."
npm install --production 2>/dev/null
PORT=3001 node dist-server/index.js
