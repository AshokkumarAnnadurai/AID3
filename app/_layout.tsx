import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from '../src/store/index.ts';
import { SQLiteService } from '../src/services/database/sqliteService.ts';

export default function RootLayout({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    // Initialize SQLite database and versioned schema migrations
    const initDb = async () => {
      try {
        const db = SQLiteService.getInstance();
        await db.initialize();
      } catch (err) {
        console.error('Failed to initialize SQLite on startup:', err);
      }
    };
    initDb();
  }, []);

  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
}
