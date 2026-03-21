import { Hono } from 'hono';

const app = new Hono();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Adore API',
    version: '0.1.0',
    status: 'ok',
  });
});

// TODO: Route modules
// app.route('/auth', authRoutes);
// app.route('/wardrobe', wardrobeRoutes);
// app.route('/outfits', outfitRoutes);
// app.route('/agent', agentRoutes);
// app.route('/wishlist', wishlistRoutes);
// app.route('/budget', budgetRoutes);
// app.route('/analytics', analyticsRoutes);

export default {
  port: Number(process.env.PORT) || 3000,
  fetch: app.fetch,
};

console.log(`Adore API running on port ${Number(process.env.PORT) || 3000}`);
