import serverlessHttp from 'serverless-http';
import { createApp } from '../../server';

let handler: any;

export default async (event: any, context: any) => {
  if (!handler) {
    const { app } = await createApp();
    handler = serverlessHttp(app);
  }
  return handler(event, context);
};
