import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

import wardrobeRoutes from './routes/wardrobe';
import uploadRoutes from './routes/upload';
import bgRemovalRoutes from './routes/background-removal';
import scanRoutes from './routes/scan';
import batchScanRoutes from './routes/batch-scan';
import rapidScanRoutes from './routes/rapid-scan';
import outfitRoutes from './routes/outfits';
import stylistRoutes from './routes/stylist';
import marketplaceRoutes from './routes/marketplace';
import wishlistRoutes from './routes/wishlist';
import onboardingRoutes from './routes/onboarding';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Adore API',
    version: '0.1.0',
    status: 'ok',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route modules
app.route('/wardrobe', wardrobeRoutes);
app.route('/wardrobe', uploadRoutes);
app.route('/wardrobe', bgRemovalRoutes);
app.route('/wardrobe', scanRoutes);
app.route('/wardrobe', batchScanRoutes);
app.route('/wardrobe', rapidScanRoutes);
app.route('/outfits', outfitRoutes);
app.route('/stylist', stylistRoutes);
app.route('/marketplace', marketplaceRoutes);
app.route('/wishlist', wishlistRoutes);
app.route('/auth', onboardingRoutes);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};

console.log(`Adore API running on http://localhost:${port}`);
