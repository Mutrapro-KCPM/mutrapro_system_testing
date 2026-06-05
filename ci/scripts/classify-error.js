function classifyError(failure) {
  const errorMsg = failure.error?.message || '';
  const requestName = failure.source?.name || '';
  const text = `${errorMsg} ${requestName}`.toLowerCase();

  if (text.includes('401') || text.includes('unauthorized') || text.includes('token')) return 'Authentication';
  if (text.includes('403') || text.includes('forbidden') || text.includes('role')) return 'Authorization';
  if (text.includes('400') || text.includes('validation') || text.includes('invalid')) return 'Validation';
  if (text.includes('404') || text.includes('not found')) return 'Routing';
  if (text.includes('500') || text.includes('internal')) return 'API Response';
  if (text.includes('timeout')) return 'Timeout';
  if (text.includes('econnrefused') || text.includes('database') || text.includes('sql')) return 'Database';
  if (text.includes('notification') || text.includes('rabbitmq') || text.includes('queue')) return 'Integration';

  return 'Unknown';
}

function determinePriority(service, errorType, errorMsg) {
  if (errorType === 'Database') return 'Critical';
  if (service === 'api-gateway') return 'Critical';
  if (service === 'auth-service' && ['Authentication', 'API Response'].includes(errorType)) return 'Critical';
  if (service === 'order-service') return 'High';
  if (errorMsg && errorMsg.includes('500')) return 'High';
  if (['Authentication', 'Authorization', 'Routing'].includes(errorType)) return 'Medium';
  return 'Low';
}

module.exports = { classifyError, determinePriority };
