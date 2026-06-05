const serviceRules = [
  { service: 'auth-service', patterns: ['/auth', '/login', '/register', '/verify'] },
  { service: 'order-service', patterns: ['/orders', '/order', '/stats'] },
  { service: 'notification-service', patterns: ['/notify', '/notifications'] },
  { service: 'file-service', patterns: ['/files', '/upload'] },
  { service: 'task-service', patterns: ['/tasks'] },
  { service: 'studio-service', patterns: ['/studios'] },
  { service: 'analytics-service', patterns: ['/analytics', '/dashboard'] },
  { service: 'api-gateway', patterns: ['/api/gateway', 'api-gateway'] },
];

function detectService(failure) {
  // Use endpoint or request name to determine service
  const requestName = failure.source?.name || '';
  const url = failure.request?.url?.path?.join('/') || ''; // Newman sometimes includes request details in error, though standard failures might not have full request.
  // Actually, typical Newman failure has: failure.error, failure.source.name
  
  const textToSearch = `${requestName} ${url}`.toLowerCase();
  
  for (const rule of serviceRules) {
    for (const pattern of rule.patterns) {
      if (textToSearch.includes(pattern)) {
        return rule.service;
      }
    }
  }

  // Fallback heuristic based on common naming "ORD-SRC-01" -> order-service
  if (textToSearch.includes('ord-')) return 'order-service';
  if (textToSearch.includes('auth-') || textToSearch.includes('tc1') || textToSearch.includes('tc2')) return 'auth-service';
  if (textToSearch.includes('noti-')) return 'notification-service';

  return 'api-gateway'; // default fallback
}

module.exports = { detectService };
