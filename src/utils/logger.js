/**
 * Logger simples com timestamps e níveis.
 */

const LEVELS = { ERROR: '❌ ERROR', WARN: '⚠️  WARN', INFO: 'ℹ️  INFO', DEBUG: '🔍 DEBUG' };

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, message, data = null) {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] ${LEVELS[level] || level}`;

  if (data) {
    console.log(`${prefix}: ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${prefix}: ${message}`);
  }
}

const logger = {
  error: (msg, data) => log('ERROR', msg, data),
  warn: (msg, data) => log('WARN', msg, data),
  info: (msg, data) => log('INFO', msg, data),
  debug: (msg, data) => log('DEBUG', msg, data),
};

module.exports = logger;
