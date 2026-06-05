const serviceRules = [
  { service: 'auth-service', patterns: ['/auth', '/login', '/register', '/verify', 'auth-', 'au-'] },
  { service: 'order-service', patterns: ['/orders', '/order', '/stats', 'ord-'] },
  { service: 'notification-service', patterns: ['/notify', '/notifications', 'noti-'] },
  { service: 'file-service', patterns: ['/files', '/upload', 'file-'] },
  { service: 'task-service', patterns: ['/tasks', 'task-'] },
  { service: 'studio-service', patterns: ['/studios', 'studio-'] },
  { service: 'analytics-service', patterns: ['/analytics', '/dashboard', 'ana-'] },
  { service: 'api-gateway', patterns: ['/api/gateway', 'api-gateway'] },
];

function detectService(failure) {
  // Use endpoint or request name to determine service
  const requestName = failure.source?.name || '';
  const url = failure.request?.url?.path?.join('/') || '';
  
  const textToSearch = `${requestName} ${url}`.toLowerCase();
  
  for (const rule of serviceRules) {
    for (const pattern of rule.patterns) {
      if (textToSearch.includes(pattern)) {
        return rule.service;
      }
    }
  }

  return 'api-gateway'; // default fallback
}

module.exports = { detectService };
