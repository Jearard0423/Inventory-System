#!/bin/bash

# Setup script for Yellow Roast Co. Inventory System
# This script creates .env.local with the SMTP configuration

cat > .env.local << 'EOF'
# Email Configuration for Yellow Roast Co. Inventory System
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yellowroastco2024@gmail.com
SMTP_PASSWORD=nvvgyhpmjjfdivgn

# Firebase Configuration (if needed)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
EOF

echo "✅ .env.local has been created with SMTP credentials"
echo "📧 Email notifications are now configured!"
echo ""
echo "If .env.local disappears again, run: bash setup-env.sh"
