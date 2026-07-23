import serverlessHttp from 'serverless-http';
import { createApiApp } from '../../src/lib/api';

let handler: any;

export default async (event: any, context: any) => {
  if (!handler) {
    const app = createApiApp();
    handler = serverlessHttp(app);
  }
  return handler(event, context);
};
