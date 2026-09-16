/**
 * Servidor Express — Automação CNPJ Pipedrive
 *
 * Recebe webhooks do Pipedrive, consulta ReceitaWS e preenche campos automaticamente.
 */

// Carrega variáveis de ambiente do .env (sem dependência externa)
require('./utils/env').loadEnv();

const express = require('express');
const logger = require('./utils/logger');
const webhookRoutes = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Log de todas as requisições
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ── Rotas ──────────────────────────────────────────────────

// Health check (usado para manter o servidor ativo no Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Rota principal
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Pipedrive CNPJ Automation',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      webhook: 'POST /webhook',
      health: 'GET /health',
    },
  });
});

// Webhook do Pipedrive
app.use('/', webhookRoutes);

// ── Tratamento de erros ────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('Erro não tratado:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ── Inicia o servidor ──────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Servidor rodando na porta ${PORT}`);
  logger.info(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  logger.info(`❤️  Health check: http://localhost:${PORT}/health`);

  // Validação de configuração
  if (!process.env.PIPEDRIVE_API_TOKEN || process.env.PIPEDRIVE_API_TOKEN === 'seu_token_aqui') {
    logger.warn('⚠️  PIPEDRIVE_API_TOKEN não configurado! Edite o arquivo .env');
  }
  if (!process.env.ORG_CNPJ_FIELD_KEY && !process.env.DEAL_CNPJ_FIELD_KEY) {
    logger.warn('⚠️  Nenhum campo CNPJ configurado! Execute: npm run setup-fields');
  }
});

module.exports = app;
