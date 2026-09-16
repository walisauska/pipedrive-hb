#!/usr/bin/env node

/**
 * Script utilitário para descobrir os hashes dos campos personalizados do Pipedrive.
 *
 * Uso: npm run setup-fields
 *
 * Este script lista todos os campos personalizados de Organizações e Negócios,
 * mostrando o nome e o hash (key) de cada um para que você possa configurar o .env.
 */

// Carrega .env
const { loadEnv, getCompanyDomain } = require('../src/utils/env');
loadEnv();

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const COMPANY_DOMAIN = getCompanyDomain();

if (!API_TOKEN || API_TOKEN === 'seu_token_aqui') {
  console.error('❌ PIPEDRIVE_API_TOKEN não configurado!');
  console.error('   Edite o arquivo .env e coloque seu token.');
  process.exit(1);
}

if (!COMPANY_DOMAIN || COMPANY_DOMAIN === 'suaempresa') {
  console.error('❌ PIPEDRIVE_COMPANY_DOMAIN não configurado!');
  console.error('   Edite o arquivo .env e coloque o domínio da sua empresa.');
  process.exit(1);
}

async function listFields(entityType) {
  const endpoint = entityType === 'organization'
    ? 'organizationFields'
    : 'dealFields';

  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/${endpoint}?api_token=${API_TOKEN}`;

  const response = await fetch(url);

  if (!response.ok) {
    console.error(`❌ Erro ao buscar campos de ${entityType}: ${response.status}`);
    const body = await response.text();
    console.error(body);
    return [];
  }

  const result = await response.json();
  return result.data || [];
}

function printFields(fields, entityLabel) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  📋 CAMPOS DE ${entityLabel.toUpperCase()}`);
  console.log(`${'═'.repeat(70)}`);

  // Separa campos padrão dos personalizados
  const customFields = fields.filter(f => f.edit_flag === true || f.is_custom_flag === true);
  const standardFields = fields.filter(f => !f.edit_flag && !f.is_custom_flag);

  if (customFields.length > 0) {
    console.log(`\n  🔧 Campos Personalizados (${customFields.length}):`);
    console.log(`  ${'─'.repeat(66)}`);
    console.log(`  ${'Nome'.padEnd(35)} ${'Hash (Key)'.padEnd(30)}`);
    console.log(`  ${'─'.repeat(66)}`);

    for (const field of customFields) {
      const name = (field.name || '').substring(0, 33);
      const key = field.key || '';
      console.log(`  ${name.padEnd(35)} ${key}`);
    }
  } else {
    console.log('\n  ℹ️  Nenhum campo personalizado encontrado.');
  }

  console.log(`\n  📌 Campos Padrão: ${standardFields.length} (não listados pois não são editáveis)`);
}

async function main() {
  console.log('🔍 Buscando campos personalizados do Pipedrive...\n');
  console.log(`   Domínio: ${COMPANY_DOMAIN}.pipedrive.com`);

  try {
    // Lista campos de Organizações
    const orgFields = await listFields('organization');
    printFields(orgFields, 'Organização');

    // Lista campos de Negócios (Deals)
    const dealFields = await listFields('deal');
    printFields(dealFields, 'Negócio (Deal)');

    console.log(`\n${'═'.repeat(70)}`);
    console.log('  📝 PRÓXIMO PASSO:');
    console.log(`${'═'.repeat(70)}`);
    console.log('  Copie os hashes acima e cole no arquivo .env.');
    console.log('  Use o prefixo ORG_ para campos de Organização e DEAL_ para Negócios');
    console.log('  (os hashes são diferentes entre as duas entidades). Exemplo:');
    console.log('    ORG_CNPJ_FIELD_KEY=abc123def456...');
    console.log('    DEAL_CNPJ_FIELD_KEY=xyz789...');
    console.log(`${'═'.repeat(70)}\n`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
