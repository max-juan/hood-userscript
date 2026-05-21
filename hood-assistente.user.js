// ==UserScript==
// @name         Hood Assistente de Concessao
// @namespace    https://github.com/max-juan/hood-userscript
// @version      0.4.13
// @description  Extrai dados do Retool da Mesa de Credito, calcula multiplicadores e gera parecer padronizado
// @author       Max (Robbin)
// @match        https://robbin.retool.com/*
// @include      https://robbin.retool.com/apps/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      localhost
// @connect      trycloudflare.com
// @connect      cfargotunnel.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/max-juan/hood-userscript/main/hood-assistente.user.js
// @downloadURL  https://raw.githubusercontent.com/max-juan/hood-userscript/main/hood-assistente.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ==========================================================
  // CONFIGURACAO DE BACKEND (substituido em build/commit pelo Max)
  // ==========================================================
  // BACKEND_URL = URL HTTPS publica do tunel (Cloudflare). Em dev fica __BACKEND_URL__
  // BACKEND_TOKEN = token de auth do backend. Substituido no commit publico.
  // Se algum dos dois ainda for o placeholder __XXX__, cai pra modo local (localhost:3000)
  const BACKEND_URL = 'https://houston-ten-army-anyone.trycloudflare.com';
  const BACKEND_TOKEN = '5f471a3b27c646d3d6110eebabdbe367d79e3b175cb7155e91c3d0a492f70baa';

  const TEM_PLACEHOLDER = /^__.*__$/.test(BACKEND_URL) || /^__.*__$/.test(BACKEND_TOKEN);
  const BACKEND = TEM_PLACEHOLDER ? 'http://localhost:3000' : BACKEND_URL;
  // Em modo placeholder/local, le o token do GM_getValue (configurado UMA vez pelo Max via prompt)
  const TOKEN = TEM_PLACEHOLDER ? (typeof GM_getValue === 'function' ? GM_getValue('hood_local_token', '') : '') : BACKEND_TOKEN;
  const LOG_PREFIX = '[Hood]';

  const ROBBIN_LOGO_B64 = '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';

  function log(...args) { console.log(LOG_PREFIX, ...args); }

  // ==========================================================
  // 1. EXTRACAO: le o DOM do Retool via data-testid
  // ==========================================================
  function qs(sel, root = document) { return root.querySelector(sel); }
  // textoDe: pega innerText do container e remove a primeira linha (geralmente um label tipo "ATIVIDADE PRINCIPAL")
  function textoDe(testId) {
    const el = document.querySelector(`[data-testid="ContainerWidget_${testId}--0"]`);
    if (!el) return null;
    const txt = el.innerText?.trim();
    if (!txt || txt === '-' || txt === 'Não Informado') return null;
    // Se o texto tem multiplas linhas e a primeira parece um cabecalho (TUDO MAIUSCULO curto),
    // remove a primeira linha
    const linhas = txt.split('\n').map(s => s.trim()).filter(Boolean);
    if (linhas.length > 1 && linhas[0] === linhas[0].toUpperCase() && linhas[0].length < 50) {
      return linhas.slice(1).join(' ').trim();
    }
    return txt;
  }

  // Extrai "LIVEMODE SERVICOS DIGITAIS S.A. | 29.037.988/0001-45 | Malwee"
  // do card da empresa (companyHeader)
  function extrairCabecalhoEmpresa() {
    const el = qs('[data-testid="ContainerWidget_companyHeader--0"]');
    if (!el) return {};
    const linhas = el.innerText.split('\n').map(s => s.trim()).filter(Boolean);
    const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
    let nome = null, cnpj = null, ancora = null;
    linhas.forEach(l => {
      if (cnpjRegex.test(l)) cnpj = l.match(cnpjRegex)[0];
      else if (!nome) nome = l;
      else if (!ancora) ancora = l;
    });
    return { nome, cnpj, ancora };
  }

  // Extrai o resumo do motor (resultado, cluster, limite sugerido, origem, limite potencial)
  function extrairResumoMotor() {
    const el = qs('[data-testid="ContainerWidget_resumoDecisaoMotor--0"]');
    if (!el) return {};
    const texto = el.innerText || '';
    const pegaLinha = (label) => {
      const re = new RegExp(`${label}\\s*[\\n\\s]+([^\\n]+)`, 'i');
      const m = texto.match(re);
      return m ? m[1].trim() : null;
    };
    return {
      resultado: pegaLinha('Resultado da Política'),
      cluster: pegaLinha('Cluster'),
      limiteSugerido: pegaLinha('Limite Sugerido'),
      origemLimite: pegaLinha('Origem do Limite'),
      limitePotencial: pegaLinha('Limite Potencial'),
    };
  }

  // Extrai score + apontamentos do Serasa (PJ ou Socios)
  // Layout observado:
  //   "Serasa PJ\nScore: 235\nData Base: 19/05/26\nQTD. Debitos: 1\nDebitos: R$ 67,80\nMensagem: ...\nTIPO ... DESCRICAO\n<pendencia 1>\n..."
  function parseSerasaBloco(el) {
    if (!el) return null;
    const texto = el.innerText || '';
    if (!texto.trim()) return null;
    const linhas = texto.split('\n').map(s => s.trim()).filter(Boolean);

    // pegaCampo: procura linha que COMECA com label (evita match parcial)
    const pegaCampo = (labelRegex) => {
      const re = new RegExp(`^${labelRegex}\\s*[:\\-]\\s*(.+)`, 'i');
      for (const l of linhas) {
        const m = l.match(re);
        if (m && m[1] && m[1].trim() !== '-') return m[1].trim();
      }
      return null;
    };

    const score = (() => {
      const s = pegaCampo('Score');
      if (!s) return null;
      const m = s.match(/\d+/);
      return m ? parseInt(m[0], 10) : null;
    })();
    const qtdDebitos = (() => {
      const s = pegaCampo('QTD\\.?\\s*D[eé]bitos');
      if (!s) return null;
      const m = s.match(/\d+/);
      return m ? parseInt(m[0], 10) : null;
    })();
    // "Débitos: R$ 67,80" - pegaCampo com label exato evita pegar "QTD. Debitos"
    const debitos = pegaCampo('D[eé]bitos');
    const mensagem = pegaCampo('Mensagem');

    // Apontamentos: o Retool quebra cada celula numa linha do innerText.
    // Estrutura observada:
    //   "TIPO" "DATA" "ORIGEM" "VALOR" "DESCRICAO"   <- header (5 colunas)
    //   "Pendencia Financeira" "20/06/2025" "" "67,8" "Credor SEM PARAR"  <- linha 1
    //   "N results"
    // Como celulas vazias podem ser omitidas, agrupamos heuristicamente: cada apontamento
    // comeca quando encontramos uma data dd/mm/aaaa OU um valor numerico isolado.
    const apontamentos = [];
    const idxHeaderTipo = linhas.findIndex(l => /^TIPO$/i.test(l));
    const idxFim = linhas.findIndex(l => /^\d+\s*results?$/i.test(l));

    if (idxHeaderTipo !== -1 && idxFim !== -1 && idxFim > idxHeaderTipo) {
      // Coleta nomes das colunas do header (linhas em UPPERCASE consecutivas a partir de TIPO)
      const colunas = [];
      let i = idxHeaderTipo;
      while (i < idxFim && /^[A-ZÇÃÕÁÉÍÓÚÂÊÔ\s.]+$/i.test(linhas[i]) && linhas[i] === linhas[i].toUpperCase() && linhas[i].length < 30) {
        colunas.push(linhas[i]);
        i++;
      }
      const N = colunas.length || 5;

      // Linhas restantes ate idxFim sao as celulas. qtdDebitos linhas no total.
      const dados = linhas.slice(i, idxFim);
      const total = qtdDebitos || Math.floor(dados.length / N);

      // Tenta agrupar de N em N (caso comum quando todas colunas tem valor)
      if (total > 0 && dados.length >= total * N) {
        for (let k = 0; k < total; k++) {
          const cells = dados.slice(k * N, (k + 1) * N);
          const tipo = cells[colunas.findIndex(c => /TIPO/i.test(c))] || cells[0] || '';
          const data = cells.find(c => /\d{2}\/\d{2}\/\d{4}/.test(c)) || null;
          const valorIdx = colunas.findIndex(c => /VALOR/i.test(c));
          const valor = valorIdx >= 0 ? cells[valorIdx] : null;
          const descIdx = colunas.findIndex(c => /DESCRI/i.test(c));
          const descricao = descIdx >= 0 ? cells[descIdx] : null;
          apontamentos.push({ tipo, data, valor, descricao, cells });
        }
      } else if (total > 0) {
        // Fallback: usa heuristica de "data dd/mm/aaaa marca inicio de apontamento"
        let buffer = [];
        for (const cell of dados) {
          buffer.push(cell);
          if (/\d{2}\/\d{2}\/\d{4}/.test(cell) && buffer.length >= 2) {
            // proximos campos ate proxima data ou fim
          }
        }
        apontamentos.push({ tipo: buffer[0] || '', data: buffer.find(c => /\d{2}\/\d{2}\/\d{4}/.test(c)) || null, valor: null, descricao: null, cells: buffer });
      }
    }

    return { score, qtdDebitos, debitos, mensagem, apontamentos, raw: texto };
  }

  // Extrai a tabela de Empresas Relacionadas. Layout (innerText, uma celula por linha):
  //   "Empresas Relacionadas" "Socio:" "CNPJ" "RAZAO SOCIAL" "NOME FANTASIA" "PORCENTAGEM" "STATUS"
  //   <cnpj> <razao> <nomeFantasia> <pct> <status>  ... "N results"
  // Celulas vazias (ex: porcentagem ausente) somem do innerText, entao precisamos detectar
  // o inicio de cada linha pelo padrao de CNPJ (XX.XXX.XXX/XXXX-XX)
  function extrairEmpresasRelacionadas() {
    const el = qs('[data-testid="ContainerWidget_containerRelatedCompanies--0"]');
    if (!el) return [];
    const texto = el.innerText || '';
    const linhas = texto.split('\n').map(s => s.trim()).filter(Boolean);
    const idxResults = linhas.findIndex(l => /^\d+\s*results?$/i.test(l));
    const fim = idxResults !== -1 ? idxResults : linhas.length;

    // Acha o indice da primeira linha que parece CNPJ (inicio da primeira linha de dados)
    const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
    const idxsCNPJ = [];
    for (let i = 0; i < fim; i++) {
      if (cnpjRegex.test(linhas[i])) idxsCNPJ.push(i);
    }
    if (idxsCNPJ.length === 0) return [];

    const STATUS_TOKENS = new Set(['ATIVA', 'BAIXADA', 'SUSPENSA', 'INAPTA', 'NULA']);
    const empresas = [];
    for (let i = 0; i < idxsCNPJ.length; i++) {
      const inicio = idxsCNPJ[i];
      const fimLinha = i + 1 < idxsCNPJ.length ? idxsCNPJ[i + 1] : fim;
      const celulas = linhas.slice(inicio, fimLinha);
      const cnpj = celulas[0];
      // Status: tipicamente ultima celula que esteja no set conhecido
      let status = null;
      for (let k = celulas.length - 1; k >= 1; k--) {
        if (STATUS_TOKENS.has(celulas[k].toUpperCase())) { status = celulas[k]; break; }
      }
      // Porcentagem: celula que contem '%'
      let pctStr = null, pctNum = null;
      for (const c of celulas) {
        if (/%/.test(c)) {
          pctStr = c;
          const m = c.match(/(\d+(?:[.,]\d+)?)/);
          if (m) pctNum = parseFloat(m[1].replace(',', '.'));
          break;
        }
      }
      // razaoSocial = celula 1 (apos cnpj). nomeFantasia = celula 2 se nao for status/pct.
      const razaoSocial = celulas[1] || null;
      const nomeFantasia = (celulas[2] && celulas[2] !== status && !/%/.test(celulas[2])) ? celulas[2] : null;
      empresas.push({ cnpj, razaoSocial, nomeFantasia, porcentagem: pctNum, porcentagemStr: pctStr, status });
    }
    return empresas;
  }

  // Extrai a tabela de socios (QSA). Testid: applicationsTable2--0
  // Cabecalho: CPF/CNPJ | NOME/RAZAO SOCIAL | PARTICIPACAO | IDADE | SOLICITANTE
  function extrairSocios() {
    const el = qs('[data-testid="applicationsTable2--0"]');
    if (!el) return [];
    const linhas = (el.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
    const idxResults = linhas.findIndex(l => /^\d+\s*results?$/i.test(l));
    const fim = idxResults !== -1 ? idxResults : linhas.length;

    // Header esperado nas primeiras 5 linhas
    const idxHeader = linhas.findIndex(l => /^CPF\/CNPJ$/i.test(l));
    if (idxHeader === -1) return [];

    // Coluna de cada campo (a partir do header)
    const colunas = [];
    for (let i = idxHeader; i < idxHeader + 5 && i < fim; i++) colunas.push(linhas[i]);
    const N = colunas.length;
    const inicioDados = idxHeader + N;
    const dados = linhas.slice(inicioDados, fim);
    if (dados.length === 0) return [];

    // Identifica indices das colunas
    const idxCpf = colunas.findIndex(c => /CPF/i.test(c));
    const idxNome = colunas.findIndex(c => /NOME/i.test(c));
    const idxPart = colunas.findIndex(c => /PARTICIPA/i.test(c));
    const idxIdade = colunas.findIndex(c => /IDADE/i.test(c));

    // Heuristica: cada socio tem ate N celulas, mas SOLICITANTE pode vir vazio (somido).
    // Detectamos inicio de cada socio por padrao de CPF (XXX.XXX.XXX-XX)
    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    const idxsCpf = [];
    for (let i = 0; i < dados.length; i++) if (cpfRegex.test(dados[i])) idxsCpf.push(i);

    const socios = [];
    for (let i = 0; i < idxsCpf.length; i++) {
      const ini = idxsCpf[i];
      const fimS = i + 1 < idxsCpf.length ? idxsCpf[i + 1] : dados.length;
      const cells = dados.slice(ini, fimS);
      const cpf = cells[0];
      const nome = cells[1] || null;
      let participacao = null, idade = null;
      for (const c of cells.slice(2)) {
        if (/%/.test(c)) {
          const m = c.match(/(\d+(?:[.,]\d+)?)/);
          if (m) participacao = parseFloat(m[1].replace(',', '.'));
        } else if (/^\d{1,3}$/.test(c)) {
          const n = parseInt(c, 10);
          if (n >= 0 && n <= 120) idade = n;
        }
      }
      socios.push({ cpf, nome, participacao, idade });
    }
    return socios;
  }

  function extrairSerasa() {
    const pj = qs('[data-testid="ContainerWidget_containerSerasaPJ--0"]');
    const socios = qs('[data-testid="ContainerWidget_containerSerasaSocios--0"]');
    return {
      pj: parseSerasaBloco(pj),
      socios: parseSerasaBloco(socios),
    };
  }

  function extrairDadosParceiro() {
    const el = qs('[data-testid="ContainerWidget_dadosParceiro--0"]');
    if (!el) return {};
    const texto = el.innerText || '';
    const pega = (label) => {
      const re = new RegExp(`${label}\\s*[\\n\\s]+([^\\n]+)`, 'i');
      const m = texto.match(re);
      return m && m[1].trim() !== '-' ? m[1].trim() : null;
    };
    return {
      limite: pega('Limite'),
      compraMedia: pega('Compra Média'),
      faturamentoMedio: pega('Faturamento Médio'),
      faturamentoSerasa: pega('Fatur\\. Estim\\. Serasa'),
    };
  }

  // ==========================================================
  // SCR parser
  // ==========================================================
  // Mapeia o nome bruto da modalidade -> abreviacao para o parecer
  const ABREV_MODALIDADE = {
    'AQUISIÇÃO DE BENS - VEÍCULOS OU OUTROS': 'aquisição de bens',
    'AQUISIÇÃO DE BENS': 'aquisição de bens',
    'CAPITAL DE GIRO': 'KG',
    'CARTÃO DE CRÉDITO': 'cartão',
    'CARTÃO DE CRÉDITO - ROTATIVO': 'cartão rotativo',
    'CHEQUE ESPECIAL': 'cheq',
    'CONTA GARANTIDA': 'ccg',
    'CRÉDITO PESSOAL': 'cred pess',
    'FINANCIAMENTO IMOBILIÁRIO': 'financ imob',
    'OUTROS': 'outros',
    'OUTROS LIMITES': 'outros',
  };

  function abreviarModalidade(nome) {
    return ABREV_MODALIDADE[nome] || nome.toLowerCase();
  }

  function parseMoedaBR(s) {
    if (!s) return null;
    const m = s.toString().replace(/\s/g, '').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/);
    if (!m) return null;
    return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
  }

  function parsePctBR(s) {
    if (!s) return null;
    const m = s.toString().match(/-?\d+(?:[.,]\d+)?/);
    return m ? parseFloat(m[0].replace(',', '.')) : null;
  }

  // Parseia o innerText do widget SCR (PJ ou PF) e retorna estrutura util
  function parseSCR(texto, tipo) {
    if (!texto || !texto.trim()) return { vazio: true };
    const linhas = texto.split('\n').map(s => s.trim());

    const totalMatch = texto.match(/Total SCR (?:PJ|PF)\s*R\$\s*([\d.,]+)/i);
    const total = totalMatch ? parseMoedaBR(totalMatch[1]) : 0;

    if (total === 0 || total == null) {
      return { vazio: true, total: 0 };
    }

    // Acha indice do header da tabela de modalidades (linha "TIMEFRAME")
    const idxTimeframe = linhas.findIndex(l => l === 'TIMEFRAME');
    let modalidades = [];
    let percentuais = [];
    let totalSemUso = 0;

    // Estrategia: le cabecalhos (incluindo colunas agregadas tipo LIMITE GLOBAL/AMOUNT/PERCENTUAL),
    // depois calcula concentracao = total_por_modalidade / total_geral.
    if (idxTimeframe !== -1) {
      const cabecalhos = [];
      let i = idxTimeframe + 1;
      while (i < linhas.length && linhas[i] !== 'Limite sem Uso') {
        if (linhas[i]) cabecalhos.push(linhas[i]);
        i++;
      }
      const N = cabecalhos.length;

      const COLUNAS_AGREGADAS = new Set(['AMOUNT', 'PERCENTUAL', 'LIMITE GLOBAL']);
      const idxModalidadesReais = cabecalhos
        .map((c, idx) => COLUNAS_AGREGADAS.has(c) ? -1 : idx)
        .filter(idx => idx !== -1);
      modalidades = idxModalidadesReais.map(idx => cabecalhos[idx]);

      const idxLimSemUso = linhas.findIndex((l, k) => k > idxTimeframe && l === 'Limite sem Uso');
      const idxResults = linhas.findIndex((l, k) => k > idxTimeframe && /^\d+\s+results?$/i.test(l));
      let valoresLimiteSemUso = [];
      let valoresTotais = [];

      if (idxLimSemUso !== -1 && idxResults !== -1) {
        // Le N valores apos "Limite sem Uso"
        const valsLimite = [];
        for (let k = idxLimSemUso + 1; k < idxLimSemUso + 1 + N && k < idxResults; k++) {
          const v = parseMoedaBR(linhas[k]);
          if (v !== null) valsLimite.push(v); else break;
        }
        valoresLimiteSemUso = valsLimite;

        // Pega os N ULTIMOS valores R$ antes dos %s finais = linha de totais por coluna
        const valsTotais = [];
        let achouPrimeiroR = false;
        for (let k = idxResults - 1; k >= idxLimSemUso && valsTotais.length < N; k--) {
          const l = linhas[k];
          if (!l) continue;
          if (!achouPrimeiroR) {
            if (/^R\$/.test(l)) { achouPrimeiroR = true; valsTotais.unshift(parseMoedaBR(l) || 0); }
            continue;
          }
          if (/^R\$/.test(l)) {
            valsTotais.unshift(parseMoedaBR(l) || 0);
          } else {
            break;
          }
        }
        valoresTotais = valsTotais;
      }

      // totalSemUso = soma de Limite Sem Uso APENAS das modalidades reais
      totalSemUso = idxModalidadesReais
        .map(idx => valoresLimiteSemUso[idx] || 0)
        .reduce((a, b) => a + b, 0);

      // Concentracao = total por modalidade / total geral
      if (total > 0) {
        if (valoresTotais.length === N) {
          percentuais = idxModalidadesReais.map(idx => ((valoresTotais[idx] || 0) / total) * 100);
        } else if (valoresTotais.length === modalidades.length) {
          percentuais = valoresTotais.map(v => (v / total) * 100);
        } else if (valoresTotais.length > modalidades.length) {
          const cand = valoresTotais.slice(0, modalidades.length);
          const ultimo = valoresTotais[valoresTotais.length - 1];
          if (Math.abs(ultimo - total) < total * 0.05) {
            percentuais = cand.map(v => (v / total) * 100);
          } else {
            percentuais = cand.map(v => (v / total) * 100);
          }
        }
      }
    }

    // Concentracao TOP 2
    const concentracao = modalidades.map((m, i) => ({ modalidade: m, pct: percentuais[i] || 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 2)
      .filter(c => c.pct > 0);

    // Historico mensal -> tendencia (compara mais recente vs mais antigo)
    const histRegex = /(\d{4}-\d{2})\s*\nR\$\s*([\d.,]+)/g;
    const historico = [];
    let h;
    while ((h = histRegex.exec(texto)) !== null) {
      historico.push({ periodo: h[1], risco: parseMoedaBR(h[2]) });
    }
    // historico vem ordenado do mais recente -> mais antigo na planilha
    let tendencia = null, variacaoPct = null;
    if (historico.length >= 2) {
      const recente = historico[0].risco;
      const antigo = historico[historico.length - 1].risco;
      if (antigo > 0) {
        variacaoPct = ((recente - antigo) / antigo) * 100;
        if (variacaoPct > 50) tendencia = 'alta';
        else if (variacaoPct < -50) tendencia = 'baixa';
        else tendencia = 'estável';
      }
    }

    const pctSemUso = total > 0 ? (totalSemUso / total) * 100 : 0;

    return {
      vazio: false,
      tipo,
      total,
      totalSemUso,
      pctSemUso,
      modalidades,
      percentuais,
      concentracao,
      historico,
      tendencia,
      variacaoPct,
    };
  }

  function extrairSCR() {
    const pj = qs('[data-testid="ContainerWidget_scr_pj--0"]');
    const pf = qs('[data-testid="ContainerWidget_scr_pfs--0"]');
    const pjTexto = pj?.innerText?.trim() || null;
    const pfTexto = pf?.innerText?.trim() || null;
    return {
      pj: parseSCR(pjTexto, 'PJ'),
      pf: parseSCR(pfTexto, 'PF'),
      pjTexto,
      pfTexto,
    };
  }

  function extrairTudo() {
    const header = extrairCabecalhoEmpresa();
    const motor = extrairResumoMotor();
    const parceiro = extrairDadosParceiro();
    const scr = extrairSCR();
    const serasa = extrairSerasa();
    const empresasRelacionadas = extrairEmpresasRelacionadas();
    const socios = extrairSocios();
    return {
      empresa: {
        nome: header.nome,
        cnpj: header.cnpj,
        ancora: header.ancora,
        nomeFantasia: textoDe('nomeFantasia'),
        razaoSocial: textoDe('razaoSocial'),
        endereco: textoDe('endereco'),
        dataFundacao: textoDe('dataFundacao'),
        cnae: textoDe('atividadePrincipal'),
        regimeTributario: textoDe('regimeTributario'),
        capitalSocial: textoDe('capitalSocial'),
        faturamento: textoDe('faturamento'),
      },
      motor,
      parceiro,
      scr,
      serasa,
      empresasRelacionadas,
      socios,
    };
  }

  // ==========================================================
  // 2. BACKEND: chamadas HTTP
  // ==========================================================
  function fetchBackend(path, opts = {}) {
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Type': 'application/json' };
      if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
      GM_xmlhttpRequest({
        method: opts.method || 'GET',
        url: `${BACKEND}${path}`,
        headers,
        data: opts.body ? JSON.stringify(opts.body) : undefined,
        timeout: 15000,
        onload: (r) => {
          if (r.status === 401) return reject(new Error('Token invalido. Backend rejeitou (401).'));
          if (r.status === 403) return reject(new Error('Origin nao permitido (403). Verifique CORS no backend.'));
          if (r.status === 429) return reject(new Error('Rate limit excedido (429). Aguarde alguns segundos.'));
          try { resolve(JSON.parse(r.responseText)); }
          catch { resolve({ erro: 'Resposta nao-JSON', raw: r.responseText, status: r.status }); }
        },
        onerror: () => reject(new Error(`Erro de rede - backend em ${BACKEND} esta acessivel?`)),
        ontimeout: () => reject(new Error('Timeout - backend nao respondeu em 15s')),
      });
    });
  }

  // Prompt unico para Max configurar o token local (so na primeira execucao em modo local)
  function garantirTokenLocal() {
    if (!TEM_PLACEHOLDER) return; // em producao, token vem embedded
    if (TOKEN) return; // ja configurado
    if (typeof GM_setValue !== 'function') return;
    const t = prompt('[Hood] Modo local detectado. Cole aqui o HOOD_TOKEN do seu backend (.env). Sera salvo no Tampermonkey:');
    if (t && t.trim()) {
      GM_setValue('hood_local_token', t.trim());
      alert('[Hood] Token salvo. Recarregue a pagina para aplicar.');
    }
  }

  // ==========================================================
  // 3. UI: painel lateral
  // ==========================================================
  const PANEL_ID = 'hood-panel';
  const FAB_ID = 'hood-fab';

  function injetarEstilo() {
    if (document.getElementById('hood-style')) return;
    const style = document.createElement('style');
    style.id = 'hood-style';
    style.textContent = `
      /* FAB ---------------------------------------------- */
      #${FAB_ID} {
        position: fixed !important; bottom: 30px !important; right: 80px !important;
        width: 64px; height: 64px; border-radius: 50%;
        background: #111827;
        border: none; cursor: pointer;
        z-index: 2147483647 !important;
        box-shadow: 0 4px 15px rgba(31, 41, 55, 0.4);
        display: flex; align-items: center; justify-content: center;
        transition: transform .2s, box-shadow .2s;
        font-family: 'Segoe UI', sans-serif;
        padding: 0; overflow: hidden;
        pointer-events: auto;
      }
      #${FAB_ID} img {
        width: 100%; height: 100%; object-fit: cover; display: block;
        pointer-events: none;
      }
      #${FAB_ID}:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(31,41,55,.55); }
      #${FAB_ID}:focus { outline: none; }
      #${FAB_ID}.hidden { display: none; }

      /* PANEL -------------------------------------------- */
      #${PANEL_ID} {
        position: fixed; top: 0; right: 0; width: 440px; height: 100vh;
        background: #fff; box-shadow: -4px 0 25px rgba(0,0,0,.15);
        z-index: 99998; display: flex; flex-direction: column;
        transform: translateX(100%); transition: transform .3s ease;
        font-family: 'Segoe UI', sans-serif; color: #111;
      }
      #${PANEL_ID}.open { transform: translateX(0); }
      .hood-header {
        background: linear-gradient(135deg, #1f2937, #111827); color: white;
        padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0;
      }
      .hood-header h2 { font-size: 16px; margin: 0; font-weight: 600; color: white; display: flex; align-items: center; gap: 8px; }
      .hood-close {
        background: rgba(255,255,255,.2); border: none; color: white;
        width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 16px;
      }
      .hood-close:hover { background: rgba(255,255,255,.3); }

      /* BODY --------------------------------------------- */
      .hood-body { flex: 1; overflow-y: auto; padding: 16px; font-size: 13px; }

      /* Status bar -------------------------------------- */
      .hood-status-bar {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 14px; border-radius: 8px;
        margin-bottom: 16px; font-size: 13px;
        border: 1px solid #bbf7d0; background: #f0fdf4; color: #166534;
      }
      .hood-status-bar.err { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
      .hood-status-bar.warn { background: #fffbeb; border-color: #fde68a; color: #92400e; }
      .hood-status-dot {
        width: 8px; height: 8px; border-radius: 50%; background: #22c55e;
        animation: hoodPulse 2s infinite;
      }
      .hood-status-bar.err .hood-status-dot { background: #dc2626; animation: none; }
      .hood-status-bar.warn .hood-status-dot { background: #f59e0b; animation: none; }
      @keyframes hoodPulse { 0%,100%{opacity:1} 50%{opacity:.4} }

      /* Sections / Cards -------------------------------- */
      .hood-section { margin-bottom: 16px; }
      .hood-sec-title {
        font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
        color: #9ca3af; font-weight: 600; margin-bottom: 8px;
      }
      .hood-card {
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
        padding: 12px;
      }
      .hood-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 5px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6;
      }
      .hood-row:last-child { border-bottom: none; }
      .hood-row .l { color: #6b7280; }
      .hood-row .v { color: #111; font-weight: 600; max-width: 60%; text-align: right; word-break: break-word; }
      .hood-row .v.highlight { color: #1f2937; }
      .hood-row .v.green { color: #16a34a; }
      .hood-row .v.red { color: #dc2626; }

      /* Multiplicadores grid 2x2 ------------------------ */
      .hood-mult-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      }
      .hood-mult-item {
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
        padding: 10px; text-align: center;
      }
      .hood-mult-label {
        font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: .3px;
      }
      .hood-mult-value {
        font-size: 18px; font-weight: 700; color: #111; margin: 4px 0 2px;
      }
      .hood-mult-calc { font-size: 10px; color: #6b7280; }
      .hood-mult-item.best { border-color: #1f2937; background: #f3f4f6; }
      .hood-mult-item.best .hood-mult-value { color: #1f2937; }

      /* Decisao box ------------------------------------- */
      .hood-decision {
        background: #f3f4f6; border: 1px solid #9ca3af; border-radius: 8px;
        padding: 14px; text-align: center;
      }
      .hood-decision-label { font-size: 11px; color: #4b5563; text-transform: uppercase; letter-spacing: .5px; }
      .hood-decision-value { font-size: 26px; font-weight: 700; color: #111827; margin: 4px 0; }
      .hood-decision-meta { font-size: 11px; color: #4b5563; }

      /* Parecer ------------------------------------------ */
      .hood-parecer {
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
        padding: 14px; font-size: 12px; line-height: 1.6;
        white-space: pre-wrap; color: #333; font-family: 'Consolas', monospace;
        max-height: 240px; overflow-y: auto;
      }

      /* Footer / Botoes -------------------------------- */
      .hood-footer {
        padding: 16px; border-top: 1px solid #e5e7eb;
        display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
      }
      .hood-btn {
        background: linear-gradient(135deg, #1f2937, #111827); color: white;
        border: none; padding: 12px; border-radius: 8px;
        font-size: 14px; font-weight: 600; cursor: pointer;
      }
      .hood-btn:hover { opacity: .9; }
      .hood-btn-sec {
        background: white; color: #1f2937; border: 2px solid #1f2937;
        padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
        flex: 1;
      }
      .hood-btn-sec:hover { background: #f3f4f6; }
      .hood-btn-row { display: flex; gap: 8px; }

      /* Loading / msgs --------------------------------- */
      .hood-loading {
        text-align: center; padding: 20px; color: #6b7280; font-size: 13px;
      }
      .hood-loading::before {
        content: ''; display: inline-block;
        width: 16px; height: 16px; border-radius: 50%;
        border: 2px solid #1f2937; border-top-color: transparent;
        animation: hoodSpin 0.8s linear infinite;
        vertical-align: middle; margin-right: 8px;
      }
      @keyframes hoodSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  function criarFAB() {
    if (document.getElementById(FAB_ID)) return;
    const btn = document.createElement('button');
    btn.id = FAB_ID;
    const img = document.createElement('img');
    img.src = 'data:image/jpeg;base64,' + ROBBIN_LOGO_B64;
    img.alt = 'Robbin';
    btn.appendChild(img);
    btn.title = 'Hood Assistente de Concessao';
    btn.onclick = togglePanel;
    document.body.appendChild(btn);
  }

  function criarPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="hood-header">
        <h2>Hood Credit Analyst</h2>
        <button class="hood-close" title="Fechar">✕</button>
      </div>
      <div class="hood-body" id="hood-body">
        <div class="hood-loading">Clique em "Extrair da tela" para comecar.</div>
      </div>
      <div class="hood-footer">
        <button class="hood-btn" id="hood-copy">📋 Copiar Parecer</button>
        <div class="hood-btn-row">
          <button class="hood-btn-sec" id="hood-extract">🔄 Extrair da tela</button>
          <button class="hood-btn-sec" id="hood-config">⚙️ Config</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('.hood-close').onclick = togglePanel;
    panel.querySelector('#hood-extract').onclick = onExtrair;
    panel.querySelector('#hood-copy').onclick = onCopiarParecer;
    panel.querySelector('#hood-config').onclick = onConfig;
  }

  function onConfig() {
    const msg = [
      `Backend: ${BACKEND}`,
      `Modo: ${TEM_PLACEHOLDER ? 'LOCAL (desenvolvimento)' : 'PROD (Cloudflare)'}`,
      `Token: ${TOKEN ? 'configurado' : 'AUSENTE'}`,
      `Versao do script: 0.4.0`,
      '',
      'Para reportar bugs ou sugestoes, fale com Max.',
    ].join('\n');
    alert(msg);
  }

  function togglePanel() {
    const panel = document.getElementById(PANEL_ID);
    const fab = document.getElementById(FAB_ID);
    const isOpen = panel.classList.toggle('open');
    fab.style.display = isOpen ? 'none' : 'flex';
  }

  // ==========================================================
  // 4. RENDERIZACAO
  // ==========================================================
  let ultimoParecer = '';

  function renderCard(titulo, obj) {
    const rows = Object.entries(obj)
      .filter(([_, v]) => v != null && v !== '')
      .map(([k, v]) => `<div class="hood-row"><span class="l">${k}</span><span class="v">${String(v).replace(/</g, '&lt;')}</span></div>`)
      .join('');
    if (!rows) return '';
    return `<div class="hood-sec-title">${titulo}</div><div class="hood-card">${rows}</div>`;
  }

  // Formata um bloco de SCR (PJ ou PF) com total, % sem uso, concentracao e tendencia
  function formatarSCRLinha(scr, label) {
    if (!scr || scr.vazio) return `-> ${label}: sem exposição`;
    const partes = [`R$ ${fmtK(scr.total).replace('R$ ', '')}`];
    if (scr.pctSemUso != null) partes.push(`${Math.round(scr.pctSemUso)}% sem uso`);
    if (scr.concentracao && scr.concentracao.length > 0) {
      const concStr = scr.concentracao
        .map(c => `${abreviarModalidade(c.modalidade)} (${Math.round(c.pct)}%)`)
        .join(' e ');
      partes.push(`concentração em ${concStr}`);
    }
    if (scr.tendencia) {
      const sinal = scr.variacaoPct > 0 ? '+' : '';
      partes.push(`tendência ${scr.tendencia} (${sinal}${Math.round(scr.variacaoPct)}%)`);
    }
    return `-> ${label}: ${partes.join(', ')}`;
  }

  // Calcula tempo da empresa em anos a partir da string "DD/MM/AAAA"
  function tempoEmpresaAnos(dataFundacao) {
    if (!dataFundacao) return null;
    const m = dataFundacao.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const fund = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    const hoje = new Date();
    const anos = (hoje - fund) / (365.25 * 24 * 3600 * 1000);
    return anos > 0 ? Math.floor(anos) : null;
  }

  // Heuristica simples de maturidade (acordada com Max em 2026-05-19)
  // <2 anos = nova, 2-5 = em crescimento, 5+ = consolidada
  function statusMaturidade(anos) {
    if (anos == null) return null;
    if (anos < 2) return 'empresa nova';
    if (anos < 5) return 'em crescimento';
    return 'consolidada';
  }

  // Traducao de cluster (generico - cada ancora pode ter nomenclatura propria depois)
  const CLUSTER_NOMES = {
    0: 'Excelente',
    1: 'Muito Bom',
    2: 'Bom',
    3: 'Regular',
  };
  function traduzirCluster(cluster) {
    const n = parseInt(cluster, 10);
    if (isNaN(n)) return null;
    return CLUSTER_NOMES[n] || null;
  }

  // Classifica probabilidade de inadimplencia em linguagem
  // Faixas: <2% baixo, 2-5% moderado, 5-10% elevado, >10% alto
  function classificarInadimplencia(pctStr) {
    if (!pctStr) return null;
    const m = pctStr.toString().match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const pct = parseFloat(m[1].replace(',', '.'));
    if (isNaN(pct)) return null;
    let categoria;
    if (pct < 2) categoria = 'baixo risco';
    else if (pct < 5) categoria = 'risco moderado';
    else if (pct < 10) categoria = 'risco elevado';
    else categoria = 'risco alto';
    return { pct, categoria, formatado: `${pct.toString().replace('.', ',')}% — ${categoria}` };
  }

  // Aplica redutor de 65% sobre um limite (vem na decisao final)
  function aplicarRedutor(limite, redutor = 0.65) {
    if (limite == null) return null;
    return Math.round(limite * redutor);
  }

  function gerarParecer(dados, clientePlanilha, sugestao) {
    const e = dados.empresa;
    const p = dados.parceiro;
    const s = dados.scr;
    const ancora = e.ancora || 'ANCORA';

    const lines = [];
    lines.push(`${ancora}`);

    // Bloco ancora - prefere dados da planilha
    if (clientePlanilha?.encontrado) {
      if (clientePlanilha.limiteParceiro) lines.push(`-> Limite de ${fmtK(clientePlanilha.limiteParceiro)}.`);
      if (clientePlanilha.dataPrimeiraCompra) lines.push(`-> Cliente desde ${clientePlanilha.dataPrimeiraCompra}.`);
      if (clientePlanilha.compraMediaMensal) lines.push(`-> Compra media de ${fmtK(clientePlanilha.compraMediaMensal)}.`);
    } else {
      if (p.limite) lines.push(`-> Limite de ${p.limite}.`);
      if (p.compraMedia) lines.push(`-> Compra media de ${p.compraMedia}.`);
    }

    lines.push('');
    lines.push('Empresa');
    const anos = tempoEmpresaAnos(e.dataFundacao);
    const maturidade = statusMaturidade(anos);
    if (anos != null) {
      const sufixo = maturidade ? ` (${maturidade})` : '';
      lines.push(`-> ${anos} ano${anos === 1 ? '' : 's'} de atividade${sufixo}.`);
    }
    // Sócios: cita idade + participacao. Se 1 socio, formato curto. Se varios, lista.
    const socios = dados.socios || [];
    if (socios.length === 1) {
      const s0 = socios[0];
      const partes = [];
      if (s0.nome) partes.push(s0.nome);
      if (s0.idade != null) partes.push(`${s0.idade} anos`);
      if (s0.participacao != null) partes.push(`${s0.participacao.toString().replace('.', ',')}%`);
      if (partes.length) lines.push(`-> Sócio: ${partes.join(', ')}.`);
      // Contexto socio+empresa (feedback da analista)
      if (s0.idade != null && anos != null) {
        const socioJovem = s0.idade < 35;
        const empresaNova = anos < 5;
        if (socioJovem && empresaNova) lines.push('-> Contexto: sócio jovem + empresa nova (risco elevado pela inexperiência combinada).');
        else if (!socioJovem && !empresaNova) lines.push('-> Contexto: sócio maduro + empresa consolidada (perfil estável).');
        else if (socioJovem && !empresaNova) lines.push('-> Contexto: sócio jovem em empresa consolidada (sucessão ou nova gestão).');
        else if (!socioJovem && empresaNova) lines.push('-> Contexto: sócio maduro em empresa nova (experiência traz mitigação).');
      }
    } else if (socios.length > 1) {
      for (const s of socios) {
        const partes = [s.nome || s.cpf];
        if (s.idade != null) partes.push(`${s.idade}a`);
        if (s.participacao != null) partes.push(`${s.participacao.toString().replace('.', ',')}%`);
        lines.push(`-> Sócio: ${partes.join(', ')}.`);
      }
    }
    lines.push('-> [Análise de fachada: pendente]');

    // Empresas relacionadas: so cita as que tem % preenchido (participacao ativa do socio)
    const relComPct = (dados.empresasRelacionadas || []).filter(r => r.porcentagem != null);
    if (relComPct.length > 0) {
      lines.push('');
      lines.push('Empresas relacionadas');
      for (const r of relComPct) {
        const nome = r.nomeFantasia || r.razaoSocial || '';
        const statusStr = r.status ? `, ${r.status.toLowerCase()}` : '';
        lines.push(`-> ${nome} (${r.cnpj}) - ${r.porcentagemStr}${statusStr}`);
      }
    }

    lines.push('');
    lines.push('SCR');
    lines.push(formatarSCRLinha(s.pj, 'PJ'));
    lines.push(formatarSCRLinha(s.pf, 'PF'));
    // Sinaliza comportamento PF baseado em utilizacao (100% - %SemUso)
    // <20% utilizacao = conservador; 70-90% = pressao; >90% = pressao alta
    if (s.pf && !s.pf.vazio && s.pf.pctSemUso != null) {
      const util = 100 - s.pf.pctSemUso;
      let comp = null;
      if (util < 20) comp = 'comportamento conservador';
      else if (util < 70) comp = 'utilização moderada';
      else if (util < 90) comp = 'sinaliza pressão financeira';
      else comp = 'pressão financeira alta';
      lines.push(`-> Utilização PF: ${Math.round(util)}% do limite (${comp})`);
    }

    lines.push('');
    lines.push('Serasa');
    const sePJ = dados.serasa?.pj;
    const seSocios = dados.serasa?.socios;
    if (sePJ?.score != null || seSocios?.score != null) {
      const partes = [];
      if (sePJ?.score != null) partes.push(`Score PJ ${sePJ.score}`);
      if (seSocios?.score != null) partes.push(`Score PF ${seSocios.score}`);
      lines.push(`-> ${partes.join(' e ')}.`);
    } else {
      lines.push('-> Scores não identificados.');
    }
    // Probabilidade de inadimplencia (vem em sePJ.mensagem: "PROBABILIDADE DE INADIMPLENCIA: 3,73%")
    const probMatch = sePJ?.mensagem?.match(/INADIMPL[EÊ]NCIA[:\s]*([\d.,]+%?)/i);
    if (probMatch) {
      const cl = classificarInadimplencia(probMatch[1]);
      if (cl) lines.push(`-> Inadimplência: ${cl.formatado}.`);
    }
    const fmtApontamento = (ap, totalDebitos) => {
      const tipo = ap.tipo || 'pendência';
      const valor = ap.valor ? `R$ ${ap.valor}` : (totalDebitos || '');
      const credor = ap.descricao ? ` (${ap.descricao}${ap.data ? `, ${ap.data}` : ''})` : (ap.data ? ` (${ap.data})` : '');
      return `${tipo}${valor ? ` de ${valor}` : ''}${credor}`;
    };
    // Apontamentos: PJ
    if (sePJ?.qtdDebitos > 0 && sePJ.apontamentos?.length > 0) {
      lines.push(`-> Apontamento PJ: ${fmtApontamento(sePJ.apontamentos[0], sePJ.debitos)}.`);
    } else if (sePJ?.qtdDebitos === 0) {
      lines.push('-> Sem apontamentos PJ.');
    }
    // Apontamentos: Socios
    if (seSocios?.qtdDebitos > 0 && seSocios.apontamentos?.length > 0) {
      lines.push(`-> Apontamento PF: ${fmtApontamento(seSocios.apontamentos[0], seSocios.debitos)}.`);
    } else if (seSocios?.qtdDebitos === 0) {
      lines.push('-> Sem apontamentos PF.');
    }
    if (p.faturamentoSerasa) lines.push(`-> Fat anual de ${p.faturamentoSerasa}.`);

    lines.push('');
    lines.push('Decisão:');
    if (sugestao?.limiteSugerido?.limiteFinal != null) {
      const limFinal = sugestao.limiteSugerido.limiteFinal;
      const clusterNum = dados.motor?.cluster;
      const clusterNome = traduzirCluster(clusterNum);
      const clusterStr = clusterNome ? ` Cluster ${clusterNum} (${clusterNome}).` : '';
      lines.push(`${fmtK(limFinal)}.${clusterStr} Perfil ${sugestao.perfilTomador.tipo.replace('_', ' ')}. Bloco ${sugestao.blocoUsado?.tipo}. Após redutor de ${Math.round((sugestao.redutorGlobal || 0.65)*100)}%.`);
    } else {
      lines.push('[pendente - dados insuficientes para calculo]');
    }

    return lines.join('\n');
  }

  // ==========================================================
  // HELPERS DE PARSE DE VALORES PARA O MOTOR
  // ==========================================================
  // Converte string tipo "R$ 1.234.567,89" -> 1234567.89
  function valorMonetarioParaNum(s) {
    if (s == null || s === '' || s === '-') return null;
    return parseMoedaBR(s);
  }

  // Mapeia "Malwee" / "MALWEE" / "Juntos Somos Mais" / "JS+" -> chave canonica da politica
  function normalizarAncora(ancora) {
    if (!ancora) return null;
    const u = ancora.toString().toUpperCase().trim();
    if (u.includes('CANTU')) return 'CANTU';
    if (u.includes('JS+') || u.includes('JUNTOS') || u.includes('JSM')) return 'JSM';
    if (u.includes('BALAROTI')) return 'BALAROTI';
    if (u.includes('BRINOX')) return 'BRINOX';
    if (u.includes('CHILLI')) return 'CHILLI_BEANS';
    if (u.includes('MOURA')) return 'MOURA';
    if (u.includes('TRUSS')) return 'TRUSS';
    if (u.includes('MALWEE')) return 'MALWEE';
    if (u.includes('IFOOD')) return 'IFOOD';
    return u;
  }

  function parseCluster(s) {
    if (s == null || s === '' || s === '-') return null;
    const m = s.toString().match(/[0-3]/);
    return m ? parseInt(m[0], 10) : null;
  }

  // Monta o payload para POST /parecer/sugerir a partir de dados extraidos + planilha
  function montarPayloadMotor(dados, clientePlanilha) {
    const ancora = normalizarAncora(dados.empresa.ancora);
    const cluster = parseCluster(dados.motor.cluster);
    const scrPjTotal = dados.scr?.pj?.total || 0;

    // Limite parceiro: prioriza planilha > Retool
    let limiteParceiro = null;
    if (clientePlanilha?.encontrado && clientePlanilha.limiteParceiro != null) {
      limiteParceiro = clientePlanilha.limiteParceiro;
    } else if (dados.parceiro?.limite) {
      limiteParceiro = valorMonetarioParaNum(dados.parceiro.limite);
    }

    // Compra media: prioriza planilha > Retool
    let compraMedia = null;
    if (clientePlanilha?.encontrado && clientePlanilha.compraMediaMensal != null) {
      compraMedia = clientePlanilha.compraMediaMensal;
    } else if (dados.parceiro?.compraMedia) {
      compraMedia = valorMonetarioParaNum(dados.parceiro.compraMedia);
    }

    const faturamentoEstimado = valorMonetarioParaNum(dados.parceiro?.faturamentoSerasa) ||
                                valorMonetarioParaNum(dados.parceiro?.faturamentoMedio) ||
                                valorMonetarioParaNum(dados.empresa?.faturamento);

    return {
      ancora,
      cluster,
      scrPjTotal,
      limiteParceiro: limiteParceiro || 0,
      compraMedia: compraMedia || 0,
      faturamentoEstimado: faturamentoEstimado || 0,
    };
  }

  function fmtK(v) {
    if (v == null) return '-';
    if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}mm`;
    if (v >= 1_000) return `${Math.round(v/1000)}k`;
    // Valor abaixo de 1000: formata em pt-BR com 2 casas decimais
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // ==========================================================
  // RENDER HELPERS (UI fiel ao mockup)
  // ==========================================================
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderStatusBar(tipo, msg) {
    const cls = tipo === 'ok' ? '' : (tipo === 'err' ? 'err' : 'warn');
    return `<div class="hood-status-bar ${cls}"><div class="hood-status-dot"></div>${escapeHtml(msg)}</div>`;
  }

  function renderDadosCard(dados, motor, clientePlanilha) {
    const rows = [];
    const push = (label, value, cls = '') => {
      if (value == null || value === '' || value === '-') return;
      rows.push(`<div class="hood-row"><span class="l">${escapeHtml(label)}</span><span class="v ${cls}">${escapeHtml(value)}</span></div>`);
    };
    push('Empresa', dados.empresa.nome);
    push('CNPJ', dados.empresa.cnpj);
    push('Âncora', dados.empresa.ancora, 'highlight');
    const clusterNome = traduzirCluster(motor.cluster);
    push('Cluster', clusterNome ? `${motor.cluster} - ${clusterNome}` : motor.cluster);
    const motorCls = /aprov/i.test(motor.resultado || '') ? 'green' : (/reprov/i.test(motor.resultado || '') ? 'red' : '');
    push('Motor', motor.resultado, motorCls);
    push('Capital Social', dados.empresa.capitalSocial);
    push('Regime Tributário', dados.empresa.regimeTributario);
    const anosEmp = tempoEmpresaAnos(dados.empresa.dataFundacao);
    const matEmp = statusMaturidade(anosEmp);
    if (anosEmp != null) {
      const v = `${anosEmp} ano${anosEmp === 1 ? '' : 's'}${matEmp ? ` (${matEmp})` : ''}`;
      push('Tempo de atividade', v);
    } else {
      push('Fundação', dados.empresa.dataFundacao);
    }
    push('CNAE', dados.empresa.cnae);
    if (clientePlanilha?.encontrado) {
      push('Cliente desde', clientePlanilha.dataPrimeiraCompra);
      const vol = clientePlanilha.volumeCompras12m;
      if (vol) push('Volume 12m', 'R$ ' + vol.toLocaleString('pt-BR'));
      const cm = clientePlanilha.compraMediaMensal;
      if (cm) push('Compra média/mês', 'R$ ' + cm.toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
      const lp = clientePlanilha.limiteParceiro;
      if (lp) push('Limite parceiro', 'R$ ' + lp.toLocaleString('pt-BR'));
    }
    return `
      <div class="hood-section">
        <div class="hood-sec-title">📋 Dados Extraídos da Tela</div>
        <div class="hood-card">${rows.join('')}</div>
      </div>
    `;
  }

  function renderMultiplicadores(sugestao) {
    if (!sugestao || sugestao.erro) {
      return `
        <div class="hood-section">
          <div class="hood-sec-title">📊 Multiplicadores de Limite</div>
          <div class="hood-card" style="text-align:center;color:#9ca3af;font-size:12px;padding:14px">
            ${escapeHtml(sugestao?.erro || 'Aguardando dados do motor...')}
          </div>
        </div>
      `;
    }
    const lmax = sugestao.lmax || {};
    const valores = {
      'Lmax Compras': { v: lmax.lmaxCompras, calc: 'compra média × mult' },
      'Lmax Parceiro': { v: lmax.lmaxParceiro, calc: 'limite × mult' },
      'Lmax Faturamento': { v: lmax.lmaxFaturamento, calc: 'fatur/12 × mult' },
      'Lmax BC': { v: lmax.lmaxBC, calc: 'SCR PJ × mult%' },
    };
    const maior = sugestao.limiteSugerido?.maiorLmax;
    const itens = Object.entries(valores).map(([nome, { v, calc }]) => {
      const ehBest = v != null && v > 0 && maior != null && Math.abs(v - maior) < 0.01;
      return `
        <div class="hood-mult-item ${ehBest ? 'best' : ''}">
          <div class="hood-mult-label">${escapeHtml(nome)}</div>
          <div class="hood-mult-value">${v != null ? fmtK(v) : '-'}</div>
          <div class="hood-mult-calc">${escapeHtml(calc)}</div>
        </div>
      `;
    }).join('');
    return `
      <div class="hood-section">
        <div class="hood-sec-title">📊 Multiplicadores de Limite (calculados)</div>
        <div class="hood-mult-grid">${itens}</div>
      </div>
    `;
  }

  function renderDecisao(sugestao) {
    if (!sugestao || sugestao.limiteSugerido?.limiteFinal == null) return '';
    const lf = sugestao.limiteSugerido.limiteFinal;
    const perfil = sugestao.perfilTomador?.tipo?.replace('_', ' ') || '-';
    const redutor = Math.round((sugestao.redutorGlobal || 0.65) * 100);
    return `
      <div class="hood-section">
        <div class="hood-sec-title">🎯 Decisão Sugerida</div>
        <div class="hood-decision">
          <div class="hood-decision-label">Limite final (após redutor de ${redutor}%)</div>
          <div class="hood-decision-value">${fmtK(lf)}</div>
          <div class="hood-decision-meta">Perfil: ${escapeHtml(perfil)} • Bloco: ${escapeHtml(sugestao.blocoUsado?.tipo || '-')}</div>
        </div>
      </div>
    `;
  }

  function renderParecer(parecer) {
    return `
      <div class="hood-section">
        <div class="hood-sec-title">📝 Parecer Gerado</div>
        <div class="hood-parecer">${escapeHtml(parecer)}</div>
      </div>
    `;
  }

  // ==========================================================
  // ON EXTRAIR
  // ==========================================================
  async function onExtrair() {
    const body = document.getElementById('hood-body');
    body.innerHTML = '<div class="hood-loading">Extraindo dados da tela...</div>';

    const dados = extrairTudo();
    log('Dados extraidos:', dados);

    let statusHtml = renderStatusBar('ok', `Página detectada: Mesa de Crédito v2`);

    // 1. Busca na planilha de clientes (se ancora aplicavel)
    let clientePlanilha = null;
    const ancoraUpper = (dados.empresa.ancora || '').toUpperCase();
    if (dados.empresa.cnpj && ['MALWEE','MOURA','BRINOX'].some(a => ancoraUpper.includes(a))) {
      try {
        const ancoraApi = ancoraUpper.includes('MALWEE') ? 'MALWEE' : ancoraUpper.includes('MOURA') ? 'MOURA' : 'BRINOX';
        clientePlanilha = await fetchBackend(`/sheets/clientes/${ancoraApi}/${encodeURIComponent(dados.empresa.cnpj)}`);
        if (!clientePlanilha.encontrado) {
          statusHtml = renderStatusBar('warn', `Cliente não está na planilha ${ancoraApi}: usando dados do Retool.`);
        }
      } catch (err) {
        statusHtml = renderStatusBar('err', `Backend offline: ${err.message}`);
      }
    }

    // 2. Chama o motor para calcular Lmax e limite final
    let sugestao = null;
    try {
      const payload = montarPayloadMotor(dados, clientePlanilha);
      log('Payload motor:', payload);
      if (payload.ancora && payload.cluster != null) {
        sugestao = await fetchBackend('/parecer/sugerir', { method: 'POST', body: payload });
        log('Sugestao motor:', sugestao);
      } else {
        sugestao = { erro: !payload.ancora ? 'Ancora nao identificada' : 'Cluster nao informado na tela' };
      }
    } catch (err) {
      sugestao = { erro: `Erro no motor: ${err.message}` };
    }

    // 3. Gera parecer (texto)
    const parecer = gerarParecer(dados, clientePlanilha, sugestao);
    ultimoParecer = parecer;

    // 4. Render fiel ao mockup
    body.innerHTML = [
      statusHtml,
      renderDadosCard(dados, dados.motor, clientePlanilha),
      renderMultiplicadores(sugestao),
      renderDecisao(sugestao),
      renderParecer(parecer),
    ].join('');
  }

  function onCopiarParecer() {
    if (!ultimoParecer) { alert('Extraia os dados primeiro.'); return; }
    GM_setClipboard(ultimoParecer);
    const btn = document.getElementById('hood-copy');
    const t = btn.textContent;
    btn.textContent = '✓ Copiado!';
    setTimeout(() => (btn.textContent = t), 1500);
  }

  // ==========================================================
  // 5. BOOTSTRAP
  // ==========================================================
  function estaNaTelaDeAnalise() {
    return !!document.querySelector('[data-testid="ContainerWidget_resumoDecisaoMotor--0"]');
  }

  let _bootstrapped = false;
  function bootstrap() {
    if (!estaNaTelaDeAnalise()) return;
    if (_bootstrapped) return;
    _bootstrapped = true;
    injetarEstilo();
    criarFAB();
    criarPanel();
    garantirTokenLocal();
    log(`Painel injetado. Backend=${BACKEND} | modo=${TEM_PLACEHOLDER ? 'LOCAL' : 'PROD'} | token=${TOKEN ? 'configurado' : 'AUSENTE'}`);
  }

  // Retool eh SPA, entao monitora mudancas de URL/DOM
  const observer = new MutationObserver(() => bootstrap());
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(bootstrap, 1500);
})();
