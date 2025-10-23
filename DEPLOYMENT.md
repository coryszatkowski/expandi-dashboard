# Deployment Guide

## Railway Deployment

### Prerequisites
1. Railway account
2. GitHub repository
3. Domain name (optional)

### Backend Deployment

1. Create new Railway project
2. Add PostgreSQL database service
3. Connect GitHub repository (backend folder)
4. Set environment variables:
   - `NODE_ENV=production`
   - `PORT=3001`
   - `FRONTEND_URL=https://yourdomain.com`
   - `DATABASE_URL` (auto-populated by Railway)

### Frontend Deployment

1. Add new service to same Railway project
2. Connect GitHub repository (frontend folder)
3. Set environment variables:
   - `VITE_API_URL=https://your-backend-url.railway.app`
4. Build command: `npm run build`
5. Start command: `npx vite preview --host 0.0.0.0 --port $PORT`

### Post-Deployment

1. Run database initialization (one-time):
   - SSH into backend container
   - Run: `npm run init-db`

2. Create first admin user:
   ```bash
   curl -X POST https://your-backend-url.railway.app/api/auth/add-admin \
     -H "Content-Type: application/json" \
     -d '{"username":"admin@yourdomain.com","password":"CHANGE_THIS"}'
   ```

3. Test webhook endpoint:
   ```bash
   curl https://your-backend-url.railway.app/api/webhooks/test
   ```

### Domain Setup

1. In Railway, go to your frontend service
2. Click "Settings" > "Networking" > "Custom Domain"
3. Add your domain
4. Update DNS records as instructed
5. Update `FRONTEND_URL` in backend environment variables
