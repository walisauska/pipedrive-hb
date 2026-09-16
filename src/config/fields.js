/**
 * Mapeamento dos campos personalizados do Pipedrive.
 *
 * Organizações e Negócios têm hashes DIFERENTES para o mesmo campo semântico,
 * por isso cada entidade tem o seu próprio mapeamento.
 *
 * Para descobrir os hashes, execute: npm run setup-fields
 */

// Campos semânticos preenchidos a partir da consulta de CNPJ, na ordem de exibição.
const DATA_FIELDS = [
  'razao_social',
  'nome_fantasia',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
  'cep',
  'telefone',
  'email',
  'natureza_juridica',
  'capital_social',
];

/**
 * Monta o mapeamento de uma entidade lendo as variáveis de ambiente
 * com o prefixo correspondente (ORG_ ou DEAL_).
 *
 * Lido a cada chamada para que o .env carregado no boot seja sempre respeitado.
 *
 * @param {'organization'|'deal'} entityType
 * @returns {{cnpj: string, fields: Record<string, string>}}
 */
function getFieldMapping(entityType) {
  const prefix = entityType === 'organization' ? 'ORG_' : 'DEAL_';

  const fields = {};
  for (const name of DATA_FIELDS) {
    fields[name] = process.env[`${prefix}${name.toUpperCase()}_FIELD_KEY`] || '';
  }

  return {
    cnpj: process.env[`${prefix}CNPJ_FIELD_KEY`] || '',
    fields,
  };
}

/**
 * Mapeia os dados normalizados da consulta de CNPJ para o formato
 * custom_fields do Pipedrive, usando os hashes da entidade informada.
 *
 * Só inclui campos que possuem hash configurado e valor não vazio.
 *
 * @param {object} dadosReceita - Dados normalizados da consulta CNPJ
 * @param {'organization'|'deal'} entityType - Entidade de destino
 * @returns {object} Objeto hash → valor pronto para o update do Pipedrive
 */
function mapReceitaToPipedrive(dadosReceita, entityType) {
  const { fields } = getFieldMapping(entityType);
  const customFields = {};

  for (const name of DATA_FIELDS) {
    const hash = fields[name];
    // Só inclui se o hash está configurado e o valor existe
    if (hash && dadosReceita[name]) {
      customFields[hash] = dadosReceita[name];
    }
  }

  return customFields;
}

module.exports = { DATA_FIELDS, getFieldMapping, mapReceitaToPipedrive };
