# 🔄 Automação Pipedrive — Consulta CNPJ

Automação que recebe webhooks do Pipedrive quando o campo **CNPJ** é preenchido em uma **Organização** ou **Negócio**, consulta os dados da empresa na **ReceitaWS** (com fallback para **BrasilAPI**) e preenche automaticamente os demais campos cadastrais.

## 📋 Campos Preenchidos Automaticamente

| Campo | Fonte |
|---|---|
| Razão Social | ReceitaWS / BrasilAPI |
| Nome Fantasia | ReceitaWS / BrasilAPI |
| Logradouro | ReceitaWS / BrasilAPI |
| Número | ReceitaWS / BrasilAPI |
| Complemento | ReceitaWS / BrasilAPI |
| Bairro | ReceitaWS / BrasilAPI |
| Cidade | ReceitaWS / BrasilAPI |
| UF | ReceitaWS / BrasilAPI |
| CEP | ReceitaWS / BrasilAPI |
| Telefone | ReceitaWS / BrasilAPI |
| E-mail | ReceitaWS / BrasilAPI |
| Natureza Jurídica | ReceitaWS / BrasilAPI |
| Capital Social | ReceitaWS / BrasilAPI |

---

## 🚀 Setup Rápido

### 1. Pré-requisitos

- **Node.js 18+** instalado ([download](https://nodejs.org/))
- Conta no **Pipedrive** com acesso à API
- (Opcional para testes) **ngrok** instalado ([download](https://ngrok.com/))

### 2. Instalar dependências

```bash
cd automação_cnpj
npm install
```

### 3. Configurar variáveis de ambiente

```bash
# Copie o template
copy .env.example .env

# Edite o .env com seu editor favorito
notepad .env
```

Preencha pelo menos:
- `PIPEDRIVE_API_TOKEN` — seu token da API
- `PIPEDRIVE_COMPANY_DOMAIN` — **apenas o subdomínio**, sem `https://` e sem `.pipedrive.com`.
  Se a sua URL é `https://suaempresa.pipedrive.com`, use só `suaempresa`.

### 4. Descobrir os hashes dos campos

Antes de mais nada, crie os campos personalizados no Pipedrive:
- Vá em **Configurações > Campos de dados > Organização** (e/ou Negócio)
- Crie cada campo listado na tabela acima como **campo de texto**

Depois, execute o script para descobrir os hashes:

```bash
npm run setup-fields
```

O script vai listar todos os campos personalizados com seus hashes. Copie e cole no `.env`.

> ⚠️ **Organização e Negócio têm hashes diferentes para o mesmo campo.** Por isso o `.env`
> usa dois conjuntos de variáveis: prefixo `ORG_` para Organizações e `DEAL_` para Negócios
> (ex: `ORG_CNPJ_FIELD_KEY` e `DEAL_CNPJ_FIELD_KEY`). Configure apenas a entidade que você
> usa — as variáveis em branco são simplesmente ignoradas.

### 5. Rodar localmente

```bash
npm run dev
```

O servidor vai iniciar na porta 3000 (ou a porta definida no `.env`).

### 6. Expor com ngrok (para testes)

Em outro terminal:

```bash
ngrok http 3000
```

Copie a URL HTTPS gerada (ex: `https://abc123.ngrok.io`).

### 7. Configurar webhook no Pipedrive

1. Vá no Pipedrive → **Ferramentas e apps → Webhooks**
2. Clique em **Criar novo webhook**
3. Configure:
   - **URL do endpoint**: `https://sua-url.ngrok.io/webhook` (ou a URL do seu servidor)
   - **Evento**: `*` (todos) ou especificamente `updated.organization` e `updated.deal`
4. Salve

### 8. Testar!

1. Abra uma Organização ou Negócio no Pipedrive
2. Preencha o campo **CNPJ** com um CNPJ válido (ex: `11222333000181`)
3. Salve
4. Os campos devem ser preenchidos automaticamente em poucos segundos!

---

## ☁️ Deploy no Render.com (Gratuito)

### 1. Crie uma conta no [Render](https://render.com)

### 2. Conecte seu repositório Git

- Faça push do código para um repositório GitHub/GitLab
- No Render, crie um **Web Service** conectado ao repositório

### 3. Configure no Render

| Configuração | Valor |
|---|---|
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Environment** | Node |

### 4. Adicione as variáveis de ambiente

No painel do Render, vá em **Environment** e adicione todas as variáveis do `.env`.

### 5. Atualize o webhook no Pipedrive

Troque a URL do webhook para a URL do Render (ex: `https://seu-app.onrender.com/webhook`).

### 6. (Opcional) Manter ativo com UptimeRobot

Para evitar que o servidor "durma" no plano gratuito:
1. Crie uma conta no [UptimeRobot](https://uptimerobot.com)
2. Adicione um monitor HTTP(s) apontando para `https://seu-app.onrender.com/health`
3. Intervalo: a cada 5 minutos

---

## 🔧 Estrutura do Projeto

```
automação_cnpj/
├── .env.example          # Template de variáveis de ambiente
├── .gitignore
├── package.json
├── README.md
├── src/
│   ├── server.js         # Servidor Express (entry point)
│   ├── routes/
│   │   └── webhook.js    # Rota POST /webhook
│   ├── services/
│   │   ├── receitaws.js  # Consulta ReceitaWS + fallback BrasilAPI
│   │   └── pipedrive.js  # Integração com API Pipedrive
│   ├── utils/
│   │   ├── cnpj.js       # Validação e formatação de CNPJ
│   │   ├── env.js        # Carrega .env e normaliza o domínio Pipedrive
│   │   └── logger.js     # Logging estruturado
│   └── config/
│       └── fields.js     # Mapeamento de campos por entidade (ORG_ / DEAL_)
└── scripts/
    └── setup-fields.js   # Descobrir hashes dos campos
```

## ⚠️ Limitações

- **ReceitaWS Free**: 3 consultas por minuto, funciona por cache
- **BrasilAPI**: Sem limite documentado, mas pode ter instabilidades
- **Render Free**: Servidor "dorme" após 15 min de inatividade (use UptimeRobot)
