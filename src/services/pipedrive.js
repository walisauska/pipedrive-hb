/**
 * Serviço de integração com a API do Pipedrive v2.
 */

const logger = require('../utils/logger');
const { getCompanyDomain } = require('../utils/env');

const API_TOKEN = () => process.env.PIPEDRIVE_API_TOKEN;
const BASE_URL = () => `https://${getCompanyDomain()}.pipedrive.com/api/v2`;

// Fallback para API v1 (caso v2 não funcione para algum endpoint)
const BASE_URL_V1 = () => `https://${getCompanyDomain()}.pipedrive.com/api/v1`;

/**
 * Faz uma requisição autenticada para a API do Pipedrive v2.
 */
async function pipedriveRequest(method, endpoint, body = null, useV1 = false) {
  const baseUrl = useV1 ? BASE_URL_V1() : BASE_URL();
  const url = `${baseUrl}${endpoint}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      // API token pessoal autentica pelo header x-api-token na v2.
      // "Authorization: Bearer" é exclusivo de access tokens OAuth e retorna 401 aqui.
      'x-api-token': API_TOKEN(),
    },
  };

  // Na v1, o token vai na query string em vez do header
  const finalUrl = useV1
    ? `${url}${url.includes('?') ? '&' : '?'}api_token=${API_TOKEN()}`
    : url;

  if (useV1) {
    delete options.headers['x-api-token'];
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  // Mascara o token na query string para não vazar nos logs
  logger.debug(`Pipedrive ${method} ${finalUrl.replace(/api_token=[^&]*/, 'api_token=***')}`);

  const response = await fetch(finalUrl, options);
  const data = await response.json();

  if (!response.ok) {
    logger.error(`Pipedrive API erro (${response.status}):`, data);
    throw new Error(`Pipedrive API erro: ${response.status} - ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Atualiza uma Organização no Pipedrive.
 *
 * @param {number} orgId - ID da organização
 * @param {object} customFields - Objeto com hash → valor dos campos personalizados
 */
async function updateOrganization(orgId, customFields) {
  logger.info(`Atualizando Organização #${orgId} com ${Object.keys(customFields).length} campos`);

  // Tenta v2 primeiro
  try {
    const result = await pipedriveRequest('PATCH', `/organizations/${orgId}`, {
      custom_fields: customFields,
    });
    logger.info(`Organização #${orgId} atualizada com sucesso (v2)`);
    return result;
  } catch (error) {
    logger.warn(`Falha na v2, tentando v1: ${error.message}`);
  }

  // Fallback para v1
  const result = await pipedriveRequest('PUT', `/organizations/${orgId}`, customFields, true);
  logger.info(`Organização #${orgId} atualizada com sucesso (v1)`);
  return result;
}

/**
 * Atualiza um Negócio (Deal) no Pipedrive.
 *
 * @param {number} dealId - ID do negócio
 * @param {object} customFields - Objeto com hash → valor dos campos personalizados
 */
async function updateDeal(dealId, customFields) {
  logger.info(`Atualizando Negócio #${dealId} com ${Object.keys(customFields).length} campos`);

  // Tenta v2 primeiro
  try {
    const result = await pipedriveRequest('PATCH', `/deals/${dealId}`, {
      custom_fields: customFields,
    });
    logger.info(`Negócio #${dealId} atualizado com sucesso (v2)`);
    return result;
  } catch (error) {
    logger.warn(`Falha na v2, tentando v1: ${error.message}`);
  }

  // Fallback para v1
  const result = await pipedriveRequest('PUT', `/deals/${dealId}`, customFields, true);
  logger.info(`Negócio #${dealId} atualizado com sucesso (v1)`);
  return result;
}

/**
 * Lista todos os campos personalizados de uma entidade.
 * Útil para descobrir os hashes.
 *
 * @param {'organization'|'deal'} entityType - Tipo da entidade
 * @returns {Array} Lista de campos
 */
async function listFields(entityType) {
  const endpoint = entityType === 'organization'
    ? '/organizationFields'
    : '/dealFields';

  // Este endpoint funciona melhor na v1
  const result = await pipedriveRequest('GET', endpoint, null, true);
  return result.data || [];
}

module.exports = { updateOrganization, updateDeal, listFields };
