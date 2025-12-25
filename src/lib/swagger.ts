import { glob } from 'glob';
import path from 'path';

export async function generateSwaggerSpec() {
  const apiFiles = await glob('src/app/api/**/route.ts');

  const paths: Record<string, any> = {};

  apiFiles.forEach(file => {
    const routePath = file
      .replace('src/app/api', '')
      .replace('/route.ts', '')
      .replace(/\[([^\]]+)\]/g, '{$1}') || '/';

    paths[routePath] = {
      get: { summary: `GET ${routePath}`, responses: { '200': { description: 'Success' } } },
      post: { summary: `POST ${routePath}`, responses: { '200': { description: 'Success' } } },
      put: { summary: `PUT ${routePath}`, responses: { '200': { description: 'Success' } } },
      delete: { summary: `DELETE ${routePath}`, responses: { '200': { description: 'Success' } } },
      patch: { summary: `PATCH ${routePath}`, responses: { '200': { description: 'Success' } } },
    };
  });

  return {
    openapi: '3.0.0',
    info: {
      title: 'Xuanwu Factory API',
      version: '1.0.0',
      description: 'API documentation for Xuanwu Factory Platform',
    },
    servers: [{ url: '/api' }],
    paths,
  };
}
