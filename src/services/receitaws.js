/**
 * Serviço de consulta CNPJ na ReceitaWS com fallback para BrasilAPI.
 */

const logger = require('../utils/logger');

const RECEITAWS_URL = 'https://receitaws.com.br/v1/cnpj';
const BRASILAPI_URL = 'https://brasilapi.com.br/api/cnpj/v1';

/**
 * Aguarda N milissegundos.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Consulta CNPJ na ReceitaWS.
 * @param {string} cnpj - CNPJ somente dígitos
 * @returns {object|null} Dados da empresa ou null se falhar
 */
async function consultarReceitaWS(cnpj) {
  try {
    logger.info(`Consultando ReceitaWS para CNPJ: ${cnpj}`);

    const response = await fetch(`${RECEITAWS_URL}/${cnpj}`, {
      headers: { 'Accept': 'application/json' },
    });

    // Rate limit — espera e tenta novamente
    if (response.status === 429) {
      logger.warn('Rate limit ReceitaWS atingido, aguardando 20s...');
      await sleep(20000);
      const retryResponse = await fetch(`${RECEITAWS_URL}/${cnpj}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!retryResponse.ok) return null;
      const data = await retryResponse.json();
      if (data.status === 'ERROR') return null;
      return data;
    }

    if (!response.ok) {
      logger.error(`ReceitaWS retornou status ${response.status}`);
      return null;
    }

    const data = await response.json();

    // ReceitaWS retorna status ERROR quando CNPJ não está no cache
    if (data.status === 'ERROR') {
      logger.warn(`ReceitaWS: ${data.message || 'CNPJ não encontrado no cache'}`);
      return null;
    }

    logger.info(`ReceitaWS: dados encontrados para ${data.nome || cnpj}`);
    return data;
  } catch (error) {
    logger.error('Erro ao consultar ReceitaWS:', error.message);
    return null;
  }
}

/**
 * Consulta CNPJ na BrasilAPI (fallback).
 * @param {string} cnpj - CNPJ somente dígitos
 * @returns {object|null} Dados da empresa ou null se falhar
 */
async function consultarBrasilAPI(cnpj) {
  try {
    logger.info(`Consultando BrasilAPI (fallback) para CNPJ: ${cnpj}`);

    const response = await fetch(`${BRASILAPI_URL}/${cnpj}`);

    if (!response.ok) {
      logger.error(`BrasilAPI retornou status ${response.status}`);
      return null;
    }

    const data = await response.json();
    logger.info(`BrasilAPI: dados encontrados para ${data.razao_social || cnpj}`);
    return data;
  } catch (error) {
    logger.error('Erro ao consultar BrasilAPI:', error.message);
    return null;
  }
}

/**
 * Normaliza a resposta da ReceitaWS para um formato padrão.
 * @param {object} data - Resposta da ReceitaWS
 * @returns {object} Dados normalizados
 */
function normalizarReceitaWS(data) {
  return {
    razao_social: data.nome || '',
    nome_fantasia: data.fantasia || '',
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    cidade: data.municipio || '',
    uf: data.uf || '',
    cep: data.cep ? data.cep.replace(/[.\-]/g, '') : '',
    telefone: data.telefone || '',
    email: data.email || '',
    natureza_juridica: data.natureza_juridica || '',
    capital_social: data.capital_social ? String(data.capital_social) : '',
  };
}

/**
 * Normaliza a resposta da BrasilAPI para o mesmo formato padrão.
 * @param {object} data - Resposta da BrasilAPI
 * @returns {object} Dados normalizados
 */
function normalizarBrasilAPI(data) {
  return {
    razao_social: data.razao_social || '',
    nome_fantasia: data.nome_fantasia || '',
    logradouro: data.descricao_tipo_de_logradouro
      ? `${data.descricao_tipo_de_logradouro} ${data.logradouro || ''}`
      : (data.logradouro || ''),
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    cidade: data.municipio || '',
    uf: data.uf || '',
    cep: data.cep ? String(data.cep).replace(/[.\-]/g, '') : '',
    telefone: data.ddd_telefone_1 || '',
    email: data.email || '',
    natureza_juridica: data.natureza_juridica || '',
    capital_social: data.capital_social ? String(data.capital_social) : '',
  };
}

/**
 * Consulta CNPJ com fallback automático.
 * Tenta ReceitaWS primeiro, se falhar tenta BrasilAPI.
 *
 * @param {string} cnpj - CNPJ somente dígitos
 * @returns {object|null} Dados normalizados da empresa ou null
 */
async function consultarCNPJ(cnpj) {
  // Tenta ReceitaWS primeiro
  const receitaData = await consultarReceitaWS(cnpj);
  if (receitaData) {
    return normalizarReceitaWS(receitaData);
  }

  // Fallback para BrasilAPI
  logger.info('ReceitaWS falhou, tentando BrasilAPI...');
  const brasilData = await consultarBrasilAPI(cnpj);
  if (brasilData) {
    return normalizarBrasilAPI(brasilData);
  }

  logger.error(`Não foi possível consultar dados para o CNPJ: ${cnpj}`);
  return null;
}

module.exports = { consultarCNPJ };
