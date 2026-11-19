import type { NextFunction, Request, Response } from 'express';
import Database from '@/service/database/index.js';
import type { DatabaseClient } from '@/service/database/index.js';
import { isStaffRole } from '@/constants/user-role.js';

async function setActivityContext(db: DatabaseClient, req: Request) {
  const role = req.user?.role;
  if (req.user?.id && role && isStaffRole(role)) {
    await db.query('SELECT set_config($1, $2, false)', ['app.current_user_id', req.user.id]);
    await db.query('SELECT set_config($1, $2, false)', ['app.actor_user_id', req.user.id]);
  }

  const ipAddress = req.ip || req.socket?.remoteAddress;
  if (ipAddress) {
    await db.query('SELECT set_config($1, $2, false)', ['app.ip_address', ipAddress]);
  }
}

async function clearActivityContext(db: DatabaseClient) {
  await db.query('SELECT set_config($1, $2, false)', ['app.current_user_id', '']);
  await db.query('SELECT set_config($1, $2, false)', ['app.actor_user_id', '']);
  await db.query('SELECT set_config($1, $2, false)', ['app.ip_address', '']);
}

function WithDatabase(controller: (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const db = await Database.getConnection();
    try {
      await setActivityContext(db, req);
      await controller(req, res, next, db);
    } catch (error) {
      next(error);
    } finally {
      try {
        await clearActivityContext(db);
      } catch {
        // ignore cleanup errors while releasing connection
      }
      db.release();
    }
  };
}

export default WithDatabase;
