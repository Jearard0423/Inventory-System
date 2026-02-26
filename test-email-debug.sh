#!/bin/bash

# Quick Email Debugging Test Script
# Run this to diagnose email notification issues

echo "========================================="
echo "Email Notification Debugging"
echo "========================================="

PROJECT_DIR="/workspaces/Inventory-System"
cd "$PROJECT_DIR"

echo ""
echo "1️⃣  Checking Environment Variables..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local exists"
    if grep -q "SMTP_USER" .env.local; then
        echo "✅ SMTP_USER is configured"
    else
        echo "❌ SMTP_USER not found in .env.local"
    fi
    if grep -q "SMTP_PASSWORD" .env.local; then
        echo "✅ SMTP_PASSWORD is configured"
    else
        echo "❌ SMTP_PASSWORD not found in .env.local"
    fi
else
    echo "❌ .env.local does NOT exist!"
    echo ""
    echo "To fix this:"
    echo "1. Copy your Gmail credentials"
    echo "2. Create .env.local with:"
    echo ""
    echo "    SMTP_HOST=smtp.gmail.com"
    echo "    SMTP_PORT=587"
    echo "    SMTP_USER=your-email@gmail.com"
    echo "    SMTP_PASSWORD=your-16-char-app-password"
    echo ""
fi

echo ""
echo "2️⃣  Checking API Endpoint..."
RESPONSE=$(curl -s http://localhost:3000/api/send-notification-email)
if echo "$RESPONSE" | grep -q "ok"; then
    echo "✅ API endpoint is responding"
    if echo "$RESPONSE" | grep -q '"smtpConfigured":true'; then
        echo "✅ SMTP is properly configured"
    else
        echo "❌ SMTP is NOT configured - emails will be logged only"
    fi
else
    echo "❌ API endpoint is not responding"
    echo "   Make sure dev server is running: npm run dev"
fi

echo ""
echo "========================================="
echo "Browser Console Log Instructions:"
echo "========================================="
echo ""
echo "Now open your browser (F12 → Console) and look for:"
echo "  • [email-notifications] - Shows email workflow"
echo "  • [kitchen-page] - Shows notification check timing"
echo "  • ❌ messages - Indicate problems"
echo "  • ✅ messages - Indicate success"
echo ""
echo "========================================="
echo "Common Issues to Check:"
echo "========================================="
echo ""
echo "❌ Issue: 'No recipient email provided'"
echo "   → You're not logged in as admin"
echo "   → Fix: Login first, then place order"
echo ""
echo "❌ Issue: 'Order is not for today'"
echo "   → You placed order for a future date"
echo "   → Fix: Use today's date for cooking date"
echo ""
echo "❌ Issue: 'SMTP credentials not set'"
echo "   → .env.local is missing"
echo "   → Fix: Create .env.local with SMTP config"
echo ""
echo "========================================="
