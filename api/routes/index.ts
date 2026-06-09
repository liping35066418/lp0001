import type { Router } from 'express';
import auth from '../controllers/auth.js';
import dashboard from '../controllers/dashboard.js';
import rooms from '../controllers/rooms.js';
import reservations from '../controllers/reservations.js';
import sessions from '../controllers/sessions.js';
import boardgames from '../controllers/boardgames.js';
import rentals from '../controllers/rentals.js';
import goods from '../controllers/goods.js';
import bills from '../controllers/bills.js';
import settings from '../controllers/settings.js';
import reports from '../controllers/reports.js';
import users from '../controllers/users.js';

export function registerRoutes(app: { use: (path: string, router: Router) => void }): void {
  app.use('/api/auth', auth);
  app.use('/api/dashboard', dashboard);
  app.use('/api/rooms', rooms);
  app.use('/api/reservations', reservations);
  app.use('/api/sessions', sessions);
  app.use('/api/boardgames', boardgames);
  app.use('/api/rentals', rentals);
  app.use('/api/goods', goods);
  app.use('/api/bills', bills);
  app.use('/api/settings', settings);
  app.use('/api/reports', reports);
  app.use('/api/users', users);
}
