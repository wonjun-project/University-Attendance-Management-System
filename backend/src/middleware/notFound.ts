import { Request, Response } from 'express';

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: `요청하신 경로 '${req.originalUrl}'을 찾을 수 없습니다.`,
      statusCode: 404,
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};