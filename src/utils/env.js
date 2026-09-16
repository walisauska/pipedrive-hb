/**
 * Carregamento de variáveis de ambiente e normalização de configuração.
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

/**
 * Carrega o arquivo .env da raiz do projeto para process.env.
 * Variáveis já definidas no ambiente têm precedência (útil no Render).
 */
function loadEnv() {
  const envPath = resolve(__dirname, '..', '..', '.env');
  if (!existsSync(envPath)) return;

  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * Extrai apenas o subdomínio da empresa a partir do valor configurado.
 * Aceita "hbpooling2", "hbpooling2.pipedrive.com" ou a URL completa.
 *
 * @returns {string} Apenas o subdomínio (ex: "hbpooling2")
 */
function getCompanyDomain() {
  const raw = (process.env.PIPEDRIVE_COMPANY_DOMAIN || '').trim();
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/\.pipedrive\.com.*$/, '')
    .replace(/\/.*$/, '');
}

module.exports = { loadEnv, getCompanyDomain };
