#!/usr/bin/env bash
# Cloudflare Tunnel & EC2 Setup Script

echo "🌐 Setting up Cloudflare on AWS EC2 for Jennifer Furniture WebMCP..."

# 1. Update and install Node.js & Docker
sudo apt-get update -y
sudo apt-get install -y curl wget git nginx docker.io docker-compose

# 2. Start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# 3. Download and install Cloudflare Tunnel (cloudflared)
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing Cloudflare Tunnel daemon (cloudflared)..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

echo "✅ Setup dependencies installed."
echo "👉 To bind your Cloudflare domain, run:"
echo "   cloudflared tunnel login"
echo "   cloudflared tunnel create webmcp-tunnel"
echo "   cloudflared tunnel route dns webmcp-tunnel your-domain.com"
echo "   cloudflared tunnel run webmcp-tunnel"
