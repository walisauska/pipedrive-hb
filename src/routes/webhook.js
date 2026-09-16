/**
 * Rota de webhook para receber eventos do Pipedrive (API de Webhooks v2).
 *
 * Formato real de um evento v2:
 *   {
 *     meta: { action: 'create'|'change'|'delete'|..., entity: 'organization'|'deal', entity_id: '12', ... },
 *     data: { id, ..., custom_fields: { '<hash>': { type, value } | null, ... } } | null,
 *     previous: { ...apenas os campos que mudaram... } | null,
 *   }
 *
 * `data` é o estado ATUAL, sempre com o objeto de custom_fields completo.
 * `previous` só existe em 'change' e só traz as chaves que de fato mudaram —
 * é isso que usamos para saber se foi o CNPJ que mudou, e não outro campo
 * (inclusive as próprias gravações que esta automação faz).
 */

const express = require('express');
const router = express.Router();

const { cleanCNPJ, isValidCNPJ, formatCNPJ } = require('../utils/cnpj');
const logger = require('../utils/logger');
const { getCompanyDomain } = require('../utils/env');
const { consultarCNPJ } = require('../services/receitaws');
const { updateOrganization, updateDeal, findDuplicateByField, getEntityLabel, addNote } = require('../services/pipedrive');
const { getFieldMapping, mapReceitaToPipedrive } = require('../config/fields');

/**
 * Extrai o valor de um campo personalizado do objeto custom_fields do Pipedrive v2.
 * @param {object|null} customFields
 * @param {string} hash
 * @returns {string|null}
 */
function getCustomFieldValue(customFields, hash) {
  const field = customFields ? customFields[hash] : null;
  return field ? field.value : null;
}

/**
 * POST /webhook
 *
 * Recebe eventos do Pipedrive quando uma Organização ou Negócio é criado/atualizado.
 * Só processa quando o campo CNPJ especificamente mudou (evita reprocessar em loop
 * quando esta própria automação grava os demais campos, o que também dispara um evento).
 */
router.post('/webhook', async (req, res) => {
  // Responde 200 imediatamente para evitar retries do Pipedrive
  res.status(200).json({ status: 'received' });

  try {
    const { meta, data, previous } = req.body;

    if (!meta) {
      logger.debug('Webhook recebido sem meta, ignorando');
      return;
    }

    const { action, entity, entity_id: entityId } = meta;
    logger.info(`Evento recebido: ${action}.${entity} (ID: ${entityId})`);

    // Só nos interessam criação e alteração de Organização ou Negócio
    if (action !== 'create' && action !== 'change') {
      logger.debug(`Ação "${action}" não é relevante, ignorando`);
      return;
    }
    if (entity !== 'organization' && entity !== 'deal') {
      logger.debug(`Entidade "${entity}" não é relevante, ignorando`);
      return;
    }
    if (!data) {
      logger.debug('Evento sem "data" (provável delete), ignorando');
      return;
    }

    const entityType = entity;
    const prefixo = entityType === 'organization' ? 'ORG' : 'DEAL';

    // Verifica se temos o hash do campo CNPJ configurado para esta entidade
    const { cnpj: cnpjFieldKey } = getFieldMapping(entityType);
    if (!cnpjFieldKey) {
      logger.error(`${prefixo}_CNPJ_FIELD_KEY não configurado! Execute "npm run setup-fields" para descobrir o hash.`);
      return;
    }

    // Em 'change', "previous.custom_fields" só lista as chaves que mudaram de fato.
    // Se o CNPJ não estiver lá, foi outro campo que mudou (inclusive nossa própria
    // gravação dos demais campos) — ignoramos para não reprocessar em loop.
    if (action === 'change') {
      const previousFields = previous ? previous.custom_fields : null;
      const cnpjMudou = !!previousFields && Object.prototype.hasOwnProperty.call(previousFields, cnpjFieldKey);
      if (!cnpjMudou) {
        logger.debug('Campo CNPJ não foi o que mudou neste evento, ignorando');
        return;
      }
    }

    const currentCNPJ = getCustomFieldValue(data.custom_fields, cnpjFieldKey);
    if (!currentCNPJ) {
      logger.debug('Campo CNPJ está vazio, ignorando');
      return;
    }

    // Limpa e valida o CNPJ
    const cleanedCNPJ = cleanCNPJ(currentCNPJ);

    if (!isValidCNPJ(cleanedCNPJ)) {
      logger.warn(`CNPJ inválido recebido: "${currentCNPJ}" (limpo: "${cleanedCNPJ}")`);
      return;
    }

    logger.info(`CNPJ válido detectado: ${cleanedCNPJ} (entidade: ${entityType}, ID: ${entityId})`);

    // Verifica se este CNPJ já está cadastrado em outra Organização/Negócio do
    // mesmo tipo. Se sim, bloqueia o preenchimento automático e avisa via nota,
    // em vez de criar um registro duplicado.
    const duplicadoId = await findDuplicateByField(entityType, cnpjFieldKey, cleanedCNPJ, entityId);
    if (duplicadoId) {
      logger.warn(`CNPJ ${cleanedCNPJ} já cadastrado em outra entidade (${entityType} #${duplicadoId}), bloqueando preenchimento`);

      const rotuloEntidade = entityType === 'organization' ? 'Organização' : 'Negócio';
      const nomeDuplicado = await getEntityLabel(entityType, duplicadoId).catch(() => `#${duplicadoId}`);
      const urlDuplicado = `https://${getCompanyDomain()}.pipedrive.com/${entityType}/${duplicadoId}`;

      await addNote(
        entityType,
        entityId,
        `⚠️ <b>CNPJ duplicado detectado</b><br>` +
        `O CNPJ ${formatCNPJ(cleanedCNPJ)} já está cadastrado em outra(o) ${rotuloEntidade}: ` +
        `<a href="${urlDuplicado}">${nomeDuplicado}</a> (#${duplicadoId}).<br>` +
        `Os dados cadastrais não foram preenchidos automaticamente aqui para evitar duplicidade. ` +
        `Verifique se este não é um registro repetido antes de continuar.`
      ).catch(err => logger.error('Falha ao adicionar nota de aviso de duplicidade:', err.message));

      return;
    }

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
      await updateOrganization(entityId, customFields);
    } else {
      await updateDeal(entityId, customFields);
    }

    logger.info(`✅ Campos atualizados com sucesso para CNPJ ${cleanedCNPJ}!`);

  } catch (error) {
    logger.error('Erro ao processar webhook:', error.message);
  }
});

module.exports = router;
