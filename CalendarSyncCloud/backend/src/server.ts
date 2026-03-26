import 'dotenv/config';
import cron from 'node-cron';
import app from './app.js';
import { syncAll } from './services/sync-engine.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`Calendar Sync API running on http://localhost:${PORT}`);
});

// Background sync cron job
const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '15', 10);
if (intervalMinutes > 0) {
  const cronExpression = `*/${intervalMinutes} * * * *`;
  cron.schedule(cronExpression, async () => {
    console.log('[Cron] Running background sync...');
    try {
      const results = await syncAll();
      const total = results.reduce((acc, r) => acc + r.eventsAdded + r.eventsUpdated, 0);
      console.log(`[Cron] Sync complete. ${results.length} rules, ${total} events synced.`);
    } catch (err) {
      console.error('[Cron] Sync failed:', err);
    }
  });
  console.log(`Background sync scheduled every ${intervalMinutes} minutes.`);
}
