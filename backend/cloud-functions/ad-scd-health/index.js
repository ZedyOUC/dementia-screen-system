function getRequestId(event) {
  return event?.headers?.['x-request-id'] || event?.requestId || 'cloud-function-request';
}

exports.main = async function main(event) {
  const method = event?.httpMethod || event?.requestContext?.http?.method || 'GET';
  const path = event?.path || event?.rawPath || '/';
  const requestId = getRequestId(event);

  if (method === 'GET' && (path === '/api/v1/health' || path === '/health')) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          status: 'healthy',
          service: 'ad-scd-health-function',
          environment: process.env.CLOUD_ENV_ID || 'not_configured',
          checkedAt: new Date().toISOString(),
        },
        requestId,
      }),
    };
  }

  return {
    statusCode: 404,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      code: 40401,
      message: 'resource not found',
      data: null,
      requestId,
    }),
  };
};
