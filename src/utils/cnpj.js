/**
 * Utilitários para validação e formatação de CNPJ.
 */

/**
 * Remove caracteres não numéricos do CNPJ.
 * @param {string} cnpj - CNPJ com ou sem formatação
 * @returns {string} Apenas os dígitos
 */
function cleanCNPJ(cnpj) {
  if (!cnpj) return '';
  return cnpj.replace(/\D/g, '');
}

/**
 * Valida um CNPJ verificando formato e dígitos verificadores.
 * @param {string} cnpj - CNPJ a validar (com ou sem formatação)
 * @returns {boolean} true se o CNPJ é válido
 */
function isValidCNPJ(cnpj) {
  const cleaned = cleanCNPJ(cnpj);

  // Deve ter exatamente 14 dígitos
  if (cleaned.length !== 14) return false;

  // Rejeita CNPJs com todos os dígitos iguais (ex: 11111111111111)
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Calcula o primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(cleaned[12]) !== digit1) return false;

  // Calcula o segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(cleaned[13]) !== digit2) return false;

  return true;
}

/**
 * Formata um CNPJ no padrão XX.XXX.XXX/XXXX-XX
 * @param {string} cnpj - CNPJ apenas dígitos
 * @returns {string} CNPJ formatado
 */
function formatCNPJ(cnpj) {
  const cleaned = cleanCNPJ(cnpj);
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

module.exports = { cleanCNPJ, isValidCNPJ, formatCNPJ };
