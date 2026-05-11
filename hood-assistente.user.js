// ==UserScript==
// @name         Hood Assistente de Concessao
// @namespace    https://github.com/max-juan/hood-userscript
// @version      0.3.1
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
  const BACKEND_URL = 'https://ebooks-income-expects-performance.trycloudflare.com';
  const BACKEND_TOKEN = '5f471a3b27c646d3d6110eebabdbe367d79e3b175cb7155e91c3d0a492f70baa';

  const TEM_PLACEHOLDER = /^__.*__$/.test(BACKEND_URL) || /^__.*__$/.test(BACKEND_TOKEN);
  const BACKEND = TEM_PLACEHOLDER ? 'http://localhost:3000' : BACKEND_URL;
  // Em modo placeholder/local, le o token do GM_getValue (configurado UMA vez pelo Max via prompt)
  const TOKEN = TEM_PLACEHOLDER ? (typeof GM_getValue === 'function' ? GM_getValue('hood_local_token', '') : '') : BACKEND_TOKEN;
  const LOG_PREFIX = '[Hood]';

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
      #${FAB_ID} {
        position: fixed; bottom: 30px; right: 30px;
        width: 56px; height: 56px; border-radius: 50%;
        background: linear-gradient(135deg, #f97316, #ea580c); color: white;
        border: none; font-size: 22px; font-weight: 700; cursor: pointer;
        box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4); z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        transition: transform .2s, box-shadow .2s;
        font-family: 'Segoe UI', sans-serif;
      }
      #${FAB_ID}:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(249,115,22,.55); }
      #${PANEL_ID} {
        position: fixed; top: 0; right: 0; width: 440px; height: 100vh;
        background: #fff; box-shadow: -4px 0 25px rgba(0,0,0,.15);
        z-index: 99998; display: flex; flex-direction: column;
        transform: translateX(100%); transition: transform .3s ease;
        font-family: 'Segoe UI', sans-serif; color: #111;
      }
      #${PANEL_ID}.open { transform: translateX(0); }
      .hood-header {
        background: linear-gradient(135deg, #f97316, #ea580c); color: white;
        padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;
      }
      .hood-header h2 { font-size: 15px; margin: 0; font-weight: 600; }
      .hood-close {
        background: rgba(255,255,255,.2); border: none; color: white;
        width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px;
      }
      .hood-body { flex: 1; overflow-y: auto; padding: 14px; font-size: 13px; }
      .hood-footer {
        padding: 12px 14px; border-top: 1px solid #e5e7eb;
        display: flex; flex-direction: column; gap: 6px;
      }
      .hood-btn {
        background: linear-gradient(135deg, #f97316, #ea580c); color: white;
        border: none; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600;
        cursor: pointer;
      }
      .hood-btn:hover { opacity: .9; }
      .hood-btn-sec {
        background: white; color: #f97316; border: 2px solid #f97316;
        padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .hood-sec-title {
        font-size: 10px; text-transform: uppercase; letter-spacing: .5px;
        color: #9ca3af; font-weight: 700; margin: 10px 0 4px;
      }
      .hood-card {
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
        padding: 10px; margin-bottom: 10px;
      }
      .hood-row {
        display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px;
        border-bottom: 1px solid #f3f4f6;
      }
      .hood-row:last-child { border: none; }
      .hood-row .l { color: #6b7280; }
      .hood-row .v { color: #111; font-weight: 600; max-width: 60%; text-align: right; word-break: break-word; }
      .hood-parecer {
        background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
        padding: 12px; font-size: 12px; line-height: 1.55; white-space: pre-wrap;
        font-family: 'Consolas', monospace;
      }
      .hood-status { font-size: 11px; color: #6b7280; padding: 6px 0; }
      .hood-status.ok { color: #16a34a; }
      .hood-status.err { color: #dc2626; }
    `;
    document.head.appendChild(style);
  }

  function criarFAB() {
    if (document.getElementById(FAB_ID)) return;
    const btn = document.createElement('button');
    btn.id = FAB_ID;
    btn.textContent = 'R';
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
        <h2>🔥 Hood Assistente de Concessao</h2>
        <button class="hood-close" title="Fechar">✕</button>
      </div>
      <div class="hood-body" id="hood-body">
        <div class="hood-status">Clique em "Extrair da tela" para comecar.</div>
      </div>
      <div class="hood-footer">
        <button class="hood-btn" id="hood-extract">🔍 Extrair da tela</button>
        <button class="hood-btn-sec" id="hood-copy">📋 Copiar parecer</button>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('.hood-close').onclick = togglePanel;
    panel.querySelector('#hood-extract').onclick = onExtrair;
    panel.querySelector('#hood-copy').onclick = onCopiarParecer;
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

  // Aplica redutor de 65% sobre um limite (vem na decisao final)
  function aplicarRedutor(limite, redutor = 0.65) {
    if (limite == null) return null;
    return Math.round(limite * redutor);
  }

  function gerarParecer(dados, clientePlanilha, sugestao) {
    const e = dados.empresa;
    const m = dados.motor;
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
    if (e.dataFundacao) lines.push(`-> Fundada em ${e.dataFundacao}`);
    lines.push('-> [Analise de fachada: pendente]');

    lines.push('');
    lines.push('SCR');
    lines.push(formatarSCRLinha(s.pj, 'PJ'));
    lines.push(formatarSCRLinha(s.pf, 'PF'));

    lines.push('');
    lines.push('Serasa');
    lines.push('-> [scores nao extraidos ainda]');
    if (p.faturamentoSerasa) lines.push(`-> Fat anual de ${p.faturamentoSerasa}.`);

    lines.push('');
    lines.push('Decisao:');
    if (sugestao?.limiteSugerido?.limiteFinal != null) {
      const limFinal = sugestao.limiteSugerido.limiteFinal;
      const limComRedutor = aplicarRedutor(limFinal, sugestao.redutorGlobal || 0.65);
      lines.push(`${fmtK(limComRedutor)}. Perfil ${sugestao.perfilTomador.tipo.replace('_', ' ')}. Bloco ${sugestao.blocoUsado?.tipo}. Apos redutor ${Math.round((sugestao.redutorGlobal || 0.65)*100)}%.`);
    } else {
      lines.push('[pendente - dados insuficientes para calculo]');
    }

    return lines.join('\n');
  }

  function fmtK(v) {
    if (v == null) return '-';
    if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}mm`;
    if (v >= 1_000) return `${Math.round(v/1000)}k`;
    return `R$ ${v}`;
  }

  async function onExtrair() {
    const body = document.getElementById('hood-body');
    body.innerHTML = '<div class="hood-status">Extraindo dados da tela...</div>';

    const dados = extrairTudo();
    log('Dados extraidos:', dados);

    let status = '<div class="hood-status ok">✓ Dados extraidos da tela.</div>';

    // Busca na planilha se ancora for Malwee/Moura/Brinox
    let clientePlanilha = null;
    const ancoraUpper = (dados.empresa.ancora || '').toUpperCase();
    if (dados.empresa.cnpj && ['MALWEE','MOURA','BRINOX'].some(a => ancoraUpper.includes(a))) {
      try {
        const ancoraApi = ancoraUpper.includes('MALWEE') ? 'MALWEE' : ancoraUpper.includes('MOURA') ? 'MOURA' : 'BRINOX';
        clientePlanilha = await fetchBackend(`/sheets/clientes/${ancoraApi}/${encodeURIComponent(dados.empresa.cnpj)}`);
        if (clientePlanilha.encontrado) status += `<div class="hood-status ok">✓ Cliente encontrado na planilha (${clientePlanilha.aba}).</div>`;
        else status += `<div class="hood-status">• ${clientePlanilha.motivo || 'Nao encontrado na planilha'}.</div>`;
      } catch (err) {
        status += `<div class="hood-status err">✗ Backend offline: ${err.message}</div>`;
      }
    }

    // Monta UI com cards
    let html = status;
    html += renderCard('Empresa', dados.empresa);
    html += renderCard('Motor', dados.motor);
    html += renderCard('Parceiro (do Retool)', dados.parceiro);
    if (clientePlanilha?.encontrado) {
      html += renderCard('Planilha', {
        Aba: clientePlanilha.aba,
        'Data 1a compra': clientePlanilha.dataPrimeiraCompra,
        'Volume 12m': clientePlanilha.volumeCompras12m ? 'R$ ' + clientePlanilha.volumeCompras12m.toLocaleString('pt-BR') : null,
        'Compra media': clientePlanilha.compraMediaMensal ? 'R$ ' + clientePlanilha.compraMediaMensal.toLocaleString('pt-BR', {maximumFractionDigits: 0}) : null,
        'Limite parceiro': clientePlanilha.limiteParceiro ? 'R$ ' + clientePlanilha.limiteParceiro.toLocaleString('pt-BR') : null,
        'Limite desejado': clientePlanilha.limiteDesejado ? 'R$ ' + clientePlanilha.limiteDesejado.toLocaleString('pt-BR') : null,
      });
    }

    // Parecer
    const parecer = gerarParecer(dados, clientePlanilha, null);
    ultimoParecer = parecer;
    html += `<div class="hood-sec-title">Parecer gerado</div><div class="hood-parecer">${parecer.replace(/</g, '&lt;')}</div>`;

    body.innerHTML = html;
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
