import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 路由注册
// ...existing code...

app.get('/api/health', (req: express.Request, res: express.Response) => {
    res.json({ code: 0, message: 'success', data: { status: 'ok' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[FitMirror] 后端服务已启动，端口: ${PORT}`);
});
