import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { env, validateRequiredEnv } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { authRouter } from './modules/auth/auth.router';
import { plansRouter } from './modules/plans/plans.router';
import { sendSuccess } from './utils/response';

dotenv.config();
validateRequiredEnv();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/plans', plansRouter);

app.get('/api/health', (_req: express.Request, res: express.Response) => {
  sendSuccess(res, { status: 'ok' });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log('[FitMirror] backend started on port: ' + env.port);
});
