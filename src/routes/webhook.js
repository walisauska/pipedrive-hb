/**
 * Rota de webhook para receber eventos do Pipedrive.
 */

const express = require('express');
const router = express.Router();

const { cleanCNPJ, isValidCNPJ } = require('../utils/cnpj');
const logger = require('../utils/logger');
const { consultarCNPJ } = require('../services/receitaws');
const { updateOrganization, updateDeal } = require('../services/pipedrive');
const { getFieldMapping, mapReceitaToPipedrive } = require('../config/fields');

/**
 * POST /webhook
 *
 * Recebe eventos do Pipedrive quando uma Organização ou Negócio é atualizado.
 * Verifica se o campo CNPJ mudou e, se sim, consulta os dados e atualiza os campos.
 */
router.post('/webhook', async (req, res) => {
  // Responde 200 imediatamente para evitar retries do Pipedrive
  res.status(200).json({ status: 'received' });

  try {
    const { event, data, previous } = req.body;

    // Verifica se é um evento de atualização
    if (!event) {
      logger.debug('Webhook recebido sem evento, ignorando');
      return;
    }

    logger.info(`Evento recebido: ${event}`);

    // Determina o tipo de entidade
    let entityType = null;
    if (event === 'updated.organization') {
      entityType = 'organization';
    } else if (event === 'updated.deal') {
      entityType = 'deal';
    } else {
      logger.debug(`Evento "${event}" não é relevante, ignorando`);
      return;
    }

    // Verifica se temos o hash do campo CNPJ configurado para esta entidade
    const prefixo = entityType === 'organization' ? 'ORG' : 'DEAL';
    const { cnpj: cnpjFieldKey } = getFieldMapping(entityType);
    if (!cnpjFieldKey) {
      logger.error(`${prefixo}_CNPJ_FIELD_KEY não configurado! Execute "npm run setup-fields" para descobrir o hash.`);
      return;
    }

    // Obtém o valor atual e anterior do CNPJ
    const currentCNPJ = data ? data[cnpjFieldKey] : null;
    const previousCNPJ = previous ? previous[cnpjFieldKey] : null;

    // Verifica se o campo CNPJ mudou
    if (!currentCNPJ || currentCNPJ === previousCNPJ) {
      logger.debug('Campo CNPJ não mudou ou está vazio, ignorando');
      return;
    }

    // Limpa e valida o CNPJ
    const cleanedCNPJ = cleanCNPJ(currentCNPJ);

    if (!isValidCNPJ(cleanedCNPJ)) {
      logger.warn(`CNPJ inválido recebido: "${currentCNPJ}" (limpo: "${cleanedCNPJ}")`);
      return;
    }

    logger.info(`CNPJ válido detectado: ${cleanedCNPJ} (entidade: ${entityType}, ID: ${data.id})`);

    // Consulta dados na ReceitaWS (com fallback BrasilAPI)
    const dadosEmpresa = await consultarCNPJ(cleanedCNPJ);

    if (!dadosEmpresa) {
      logger.error(`Não foi possível obter dados para o CNPJ: ${cleanedCNPJ}`);
      return;
    }

    // Mapeia os dados para os campos do Pipedrive desta entidade
    const customFields = mapReceitaToPipedrive(dadosEmpresa, entityType);

    if (Object.keys(customFields).length === 0) {
      logger.warn(`Nenhum campo ${prefixo}_* configurado para atualizar. Verifique o .env`);
      return;
    }

    logger.info(`Atualizando ${Object.keys(customFields).length} campos no Pipedrive...`);

    // Atualiza a entidade no Pipedrive
    if (entityType === 'organization') {
      await updateOrganization(data.id, customFields);
    } else {
      await updateDeal(data.id, customFields);
    }

    logger.info(`✅ Campos atualizados com sucesso para CNPJ ${cleanedCNPJ}!`);

  } catch (error) {
    logger.error('Erro ao processar webhook:', error.message);
  }
});

module.exports = router;
