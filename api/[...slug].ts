import { createApiApp } from '../src/lib/api';

const app = createApiApp();

export default function handler(req: any, res: any) {
  app(req, res);
}
