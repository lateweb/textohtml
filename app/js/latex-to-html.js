// app/js/latex-to-html.js
(function(global) {
  'use strict';

  function extractTexMacro(src, macroName) {
    const regex = new RegExp('\\\\' + macroName + '\\s*\\{');
    const match = src.match(regex);
    if (!match) return '';
    let start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    return src.substring(start, i - 1).trim();
  }

  function cleanMetadata(text) {
    let clean = text.replace(/\\(?:textbf|textit|emph|underline)\{([^}]+)\}/g, '$1');
    let prev;
    do {
      prev = clean;
      clean = clean.replace(/\\[a-zA-Z]+\*?(?:\s*\[[^\]]*\])*(?:\s*\{[^{}]*\})*/g, '');
    } while (clean !== prev);
    clean = clean.replace(/\\([^a-zA-Z0-9])/g, '$1');
    return clean.trim();
  }

  function applyTypography(text) {
    if (!text) return '';
    return text.replace(/---/g, '—').replace(/--/g, '–').replace(/``/g, '“').replace(/''/g, '”');
  }

  // --- Helper: parse authors ---
  function parseAuthors(authorStr) {
    if (!authorStr) return [];
    const parts = authorStr.split(/\s+(?:and|\\and)\s+/i);
    return parts.map(a => a.trim()).filter(a => a.length > 0).map(a => {
      let cleaned = a.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      const tokens = cleaned.split(/\s+/);
      if (tokens.length === 0) return { last: '', first: '' };
      const last = tokens.pop();
      const first = tokens.map(t => t.charAt(0).toUpperCase() + '.').join(' ');
      return { last, first };
    });
  }

  function formatCitationAuthors(authorStr) {
    const authors = parseAuthors(authorStr);
    if (authors.length === 0) return '';
    if (authors.length === 1) {
      return authors[0].last;
    } else if (authors.length === 2) {
      return authors[0].last + ' & ' + authors[1].last;
    } else {
      return authors[0].last + ' et al.';
    }
  }

  // --- Exact Table Parser ---
  function parseTableContent(content, colSpec) {
    const colStyles = [];
    let currentBorderLeft = false;
    let cleanSpec = (colSpec || '').replace(/\s+/g, '');

    let i = 0;
    while (i < cleanSpec.length) {
      let char = cleanSpec[i];
      if (char === '|') {
        if (colStyles.length === 0) {
          currentBorderLeft = true;
        } else {
          colStyles[colStyles.length - 1].borderRight = true;
        }
      } else if (char === 'c' || char === 'l' || char === 'r') {
        colStyles.push({
          align: char === 'c' ? 'center' : (char === 'r' ? 'right' : 'left'),
          borderLeft: currentBorderLeft,
          borderRight: false
        });
        currentBorderLeft = false;
      } else if (char === 'p' || char === 'm' || char === 'b' || char === 'X') {
        colStyles.push({ align: 'left', borderLeft: currentBorderLeft, borderRight: false });
        currentBorderLeft = false;
        let depth = 0;
        i++;
        if (cleanSpec[i] === '{') {
          depth++; i++;
          while (i < cleanSpec.length && depth > 0) {
            if (cleanSpec[i] === '{') depth++;
            if (cleanSpec[i] === '}') depth--;
            i++;
          }
          i--;
        }
      }
      i++;
    }

    let rawRows = content.split(/\\\\/);
    let htmlRows = [];
    let isFirstRow = true;

    for (let r = 0; r < rawRows.length; r++) {
      let rowStr = rawRows[r].trim();
      if (!rowStr && r === rawRows.length - 1) continue; 

      let borderTop = false;
      let borderBottom = false;

      if (rowStr.includes('\\hline') || rowStr.includes('\\toprule') || rowStr.includes('\\midrule')) {
        borderTop = true;
        rowStr = rowStr.replace(/\\hline/g, '').replace(/\\toprule/g, '').replace(/\\midrule/g, '');
      }
      if (rowStr.includes('\\bottomrule')) {
        borderBottom = true;
        rowStr = rowStr.replace(/\\bottomrule/g, '');
      }

      if (!rowStr.trim() && htmlRows.length > 0 && borderTop) {
         htmlRows[htmlRows.length - 1].borderBottom = true;
         continue;
      }
      if (!rowStr.trim() && htmlRows.length > 0 && borderBottom) {
         htmlRows[htmlRows.length - 1].borderBottom = true;
         continue;
      }
      if (!rowStr.trim() && borderTop) {
          // standalone line
          continue; 
      }
      if (!rowStr.trim()) continue;

      const cells = rowStr.split('&').map(c => c.trim());

      htmlRows.push({
        cells,
        borderTop,
        borderBottom,
        isHeader: isFirstRow
      });
      isFirstRow = false;
    }

    let html = '';
    for (let r = 0; r < htmlRows.length; r++) {
      let rowData = htmlRows[r];
      let trStyle = '';
      
      // We rely on CSS variable --text-color defined globally in base.css
      if (rowData.borderTop) trStyle += 'border-top: 1px solid var(--text-color); ';
      if (rowData.borderBottom) trStyle += 'border-bottom: 1px solid var(--text-color); ';

      html += `<tr style="${trStyle}">`;
      for (let c = 0; c < rowData.cells.length; c++) {
        let cell = rowData.cells[c] || '';
        let tag = rowData.isHeader ? 'th' : 'td';
        let styleSpec = colStyles[c] || {};

        let cStyle = '';
        if (styleSpec.align) cStyle += `text-align: ${styleSpec.align}; `;
        if (styleSpec.borderLeft) cStyle += `border-left: 1px solid var(--text-color); `;
        if (styleSpec.borderRight) cStyle += `border-right: 1px solid var(--text-color); `;

        cell = cell.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
        cell = cell.replace(/\\newline/g, '<br>');
        cell = cell.replace(/\\([^a-zA-Z])/g, '$1');

        html += `<${tag} style="${cStyle}">${cell}</${tag}>`;
      }
      html += `</tr>`;
    }
    return html;
  }

  function processTableEnvironment(inner, colSpec) {
    let caption = '';
    let content = inner;
    
    const capMatch = content.match(/\\caption\{([^}]*)\}/);
    if (capMatch) {
      caption = capMatch[1];
      content = content.replace(/\\caption\{[^}]*\}/, '');
    }
    
    let tableContent = '';
    let spec = colSpec;
    let tabMatch = content.match(/\\begin\{tabularx\}[^{]*\{[^}]*\}\s*\{([^}]*)\}([\s\S]*?)\\end\{tabularx\}/);
    
    if (tabMatch) {
      spec = tabMatch[1];
      tableContent = tabMatch[2];
    } else {
      tabMatch = content.match(/\\begin\{tabular\}\s*\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/);
      if (tabMatch) {
        spec = tabMatch[1];
        tableContent = tabMatch[2];
      }
    }
    
    if (!tableContent) {
      return `<div class="table-wrap"><p>${content.trim()}</p></div>`;
    }
    
    const rows = parseTableContent(tableContent, spec);
    
    let tableHtml = '<table class="latex-table">';
    if (caption) {
      tableHtml += `<caption>${caption}</caption>`;
    }
    tableHtml += rows;
    tableHtml += '</table>';
    
    return `<div class="table-wrap">${tableHtml}</div>`;
  }

  function latexToHTML(source, bibEntries) {
    let tempSrc = source.replace(/\\%/g, '___PCT___').replace(/%.*/g, '').replace(/___PCT___/g, '\\%');
    let title = cleanMetadata(extractTexMacro(tempSrc, 'title'));
    let author = cleanMetadata(extractTexMacro(tempSrc, 'author'));
    let date = cleanMetadata(extractTexMacro(tempSrc, 'date'));

    title = applyTypography(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    author = applyTypography(author).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    date = applyTypography(date).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let html = source;

    // 1. MASK TABLE ENVIRONMENTS
    const tableStash = [];
    const tableRegex = /(?<!\\\\)\\begin\{table\*?\}([\s\S]*?)(?<!\\\\)\\end\{table\*?\}/g;
    html = html.replace(tableRegex, (match, inner) => {
      const token = `@@TABLE_${tableStash.length}@@`;
      const wrapped = processTableEnvironment(inner, '');
      tableStash.push({ token, content: wrapped });
      return `\n\n${token}\n\n`;
    });

    const tabularxRegex = /(?<!\\\\)\\begin\{tabularx\}[^{]*\{[^}]*\}\s*\{([^}]*)\}([\s\S]*?)(?<!\\\\)\\end\{tabularx\}/g;
    html = html.replace(tabularxRegex, (match, colSpec, inner) => {
      const token = `@@TABLE_${tableStash.length}@@`;
      const wrapped = processTableEnvironment(`\\begin{tabularx}{\\linewidth}{${colSpec}}${inner}\\end{tabularx}`, colSpec);
      tableStash.push({ token, content: wrapped });
      return `\n\n${token}\n\n`;
    });

    const tabularRegex = /(?<!\\\\)\\begin\{tabular\}\s*\{([^}]*)\}([\s\S]*?)(?<!\\\\)\\end\{tabular\}/g;
    html = html.replace(tabularRegex, (match, colSpec, inner) => {
      const token = `@@TABLE_${tableStash.length}@@`;
      const wrapped = processTableEnvironment(`\\begin{tabular}{${colSpec}}${inner}\\end{tabular}`, colSpec);
      tableStash.push({ token, content: wrapped });
      return `\n\n${token}\n\n`;
    });

    // 2. MASK MATH
    const mathStash = [];
    const mathEnvs = ['equation', 'equation\\*', 'align', 'align\\*', 'gather', 'gather\\*', 'eqnarray', 'eqnarray\\*', 'multline', 'multline\\*', 'split'];
    const envRegex = new RegExp(`(?<!\\\\)\\\\begin\\{(${mathEnvs.join('|')})\\}([\\s\\S]*?)(?<!\\\\)\\\\end\\{\\1\\}`, 'g');
    html = html.replace(envRegex, (match, env, inner) => {
      const token = `@@MATH_D_${mathStash.length}@@`;
      const safeMath = inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      mathStash.push({ token, content: `<div class="math-scroll">\\begin{${env}}${safeMath}\\end{${env}}</div>` });
      return `\n\n${token}\n\n`;
    });

    html = html.replace(/(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g, (match, inner) => {
      const token = `@@MATH_D_${mathStash.length}@@`;
      const safeMath = inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      mathStash.push({ token, content: `<div class="math-scroll">\\[${safeMath}\\]</div>` });
      return `\n\n${token}\n\n`;
    });

    html = html.replace(/(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/g, (match, inner) => {
      const token = `@@MATH_D_${mathStash.length}@@`;
      const safeMath = inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      mathStash.push({ token, content: `<div class="math-scroll">$$${safeMath}$$</div>` });
      return `\n\n${token}\n\n`;
    });

    html = html.replace(/(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)/g, (match, inner) => {
      const token = `@@MATH_I_${mathStash.length}@@`;
      const safeMath = inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      mathStash.push({ token, content: `<span class="math-inline">\\(${safeMath}\\)</span>` });
      return token;
    });

    html = html.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (match, inner) => {
      const token = `@@MATH_I_${mathStash.length}@@`;
      const safeMath = inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      mathStash.push({ token, content: `<span class="math-inline">$${safeMath}$</span>` });
      return token;
    });

    // 3. Protect special chars
    html = html.replace(/\\&/g, '___ESC_AMP___');
    html = html.replace(/\\%/g, '___ESC_PCT___');
    html = html.replace(/\\\$/g, '___ESC_DOLLAR___');
    html = html.replace(/\\_/g, '___ESC_UNDERSCORE___');
    html = html.replace(/\\#/g, '___ESC_HASH___');
    html = html.replace(/\\\{/g, '___ESC_LBRACE___');
    html = html.replace(/\\\}/g, '___ESC_RBRACE___');

    // 4. Remove comments
    html = html.replace(/%.*/g, '');

    // 5. HTML escape
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 6. Typography
    html = applyTypography(html);

    // 7. Strip preamble
    const beginDoc = html.indexOf('\\begin{document}');
    const endDoc = html.indexOf('\\end{document}');
    if (beginDoc !== -1 && endDoc !== -1 && endDoc > beginDoc) {
      html = html.substring(beginDoc + '\\begin{document}'.length, endDoc);
    }

    // 8. LaTeX structures
    html = html.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, (_, content) => {
      return `\n\n<div class="abstract">\n\n${content.trim()}\n\n</div>\n\n`;
    });

    const blocks = ['theorem', 'lemma', 'proposition', 'corollary', 'definition', 'remark', 'example', 'proof'];
    blocks.forEach(env => {
      const regex = new RegExp(`\\\\begin\\{${env}\\}([\\s\\S]*?)\\\\end\\{${env}\\}`, 'gi');
      html = html.replace(regex, (_, content) => {
        const Title = env.charAt(0).toUpperCase() + env.slice(1);
        const label = env === 'proof' ? `<em>${Title}.</em>` : `<strong>${Title}.</strong>`;
        return `\n\n<div class="article-block">\n\n${label} ${content.trim()}\n\n</div>\n\n`;
      });
    });

    html = html.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, (_, content) => {
      return `\n\n<div class="material-box clean">\n<figure>\n<blockquote>${content.trim()}</blockquote>\n</figure>\n</div>\n\n`;
    });

    html = html.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, (_, content) => {
      return `\n\n<div class="material-box code-box">\n<div class="code-header">\n<span class="code-lang">text</span>\n<button class="copy-code-btn" aria-label="Copy code" title="Copy code">\n<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>\n</button>\n</div>\n<pre><code>${content}</code></pre>\n</div>\n\n`;
    });

    html = html.replace(/\\begin\{lstlisting\}(?:\[language=([^\]]+)\])?([\s\S]*?)\\end\{lstlisting\}/g, (_, lang, content) => {
      const l = lang ? lang.trim() : 'text';
      return `\n\n<div class="material-box code-box">\n<div class="code-header">\n<span class="code-lang">${l}</span>\n<button class="copy-code-btn" aria-label="Copy code" title="Copy code">\n<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>\n</button>\n</div>\n<pre><code class="language-${l}">${content}</code></pre>\n</div>\n\n`;
    });

    let chapNum = 0, secNum = 0, subsecNum = 0, subsubsecNum = 0;
    html = html.replace(/\\(chapter|section|subsection|subsubsection)(\*?)\{([^}]+)\}/g, (match, level, star, titleContent) => {
      let numStr = "";
      let tag;
      if (level === 'chapter') {
        if (!star) { chapNum++; secNum = 0; subsecNum = 0; subsubsecNum = 0; numStr = `${chapNum}. `; }
        tag = 'h2';
      } else if (level === 'section') {
        if (!star) { secNum++; subsecNum = 0; subsubsecNum = 0; numStr = (chapNum > 0) ? `${chapNum}.${secNum}. ` : `${secNum}. `; }
        tag = 'h2';
      } else if (level === 'subsection') {
        if (!star) { subsecNum++; subsubsecNum = 0; numStr = (chapNum > 0) ? `${chapNum}.${secNum}.${subsecNum}. ` : `${secNum}.${subsecNum}. `; }
        tag = 'h3';
      } else if (level === 'subsubsection') {
        if (!star) { subsubsecNum++; numStr = (chapNum > 0) ? `${chapNum}.${secNum}.${subsecNum}.${subsubsecNum}. ` : `${secNum}.${subsecNum}.${subsubsecNum}. `; }
        tag = 'h4';
      }
      return `\n\n<${tag}>${numStr}${titleContent}</${tag}>\n\n`;
    });

    html = html.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
    html = html.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
    html = html.replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>');
    html = html.replace(/\\texttt\{([^}]+)\}/g, '<code class="backtick">$1</code>');
    html = html.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');
    html = html.replace(/\\url\{([^}]+)\}/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, '<a href="$1" target="_blank" rel="noopener">$2</a>');

    html = html.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, content) => {
      const items = content.replace(/\\item(?:\[[^\]]*\])?\s*/g, '</li><li>');
      return `\n\n<ul><li>${items}</li></ul>\n\n`;
    });
    html = html.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, content) => {
      const items = content.replace(/\\item(?:\[[^\]]*\])?\s*/g, '</li><li>');
      return `\n\n<ol><li>${items}</li></ol>\n\n`;
    });
    html = html.replace(/<li>\s*<\/li>/g, '');
    html = html.replace(/<(ul|ol)><li>/g, '<$1><li>');

    html = html.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g, '<img src="$1" alt="Kuva">');
    html = html.replace(/\\begin\{figure\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g, '\n\n<div class="figure">$1</div>\n\n');
    html = html.replace(/\\caption\{([^}]+)\}/g, '<div class="caption"><em>$1</em></div>');
    html = html.replace(/\\centering/g, '');

    // --- CITATION LOGIC (APA Style Authoryear) ---
    function getCitationAuthorsAndYear(key) {
      const entry = bibEntries.find(e => e.key === key);
      if (!entry) {
        return { author: key, year: '' };
      }
      let authorField = entry.fields.author || '';
      let year = entry.fields.year || '';
      
      let author = formatCitationAuthors(authorField);
      if (!author) author = key;
      
      return { author, year };
    }

    function makeCite(keys, type) {
      const keyArray = keys.split(',').map(k => k.trim());
      
      if (type === 'paren') {
        const inner = keyArray.map(key => {
          const { author, year } = getCitationAuthorsAndYear(key);
          const text = year ? `${author}, ${year}` : author;
          return `<a href="#bib-${key}" class="cite-link" data-cite="${key}">${text}</a>`;
        }).join('; ');
        return `(${inner})`;
      } else if (type === 'text') {
        return keyArray.map(key => {
          const { author, year } = getCitationAuthorsAndYear(key);
          if (year) {
            return `${author} (<a href="#bib-${key}" class="cite-link" data-cite="${key}">${year}</a>)`;
          }
          return `<a href="#bib-${key}" class="cite-link" data-cite="${key}">${author}</a>`;
        }).join(' and ');
      }
      return `[${keys}]`;
    }

    html = html.replace(/\\(?:pcite|parencite)\{([^}]+)\}/g, (_, keys) => makeCite(keys, 'paren'));
    html = html.replace(/\\(?:tcite|textcite)\{([^}]+)\}/g, (_, keys) => makeCite(keys, 'text'));
    html = html.replace(/\\cite\{([^}]+)\}/g, (_, keys) => makeCite(keys, 'paren'));

    // Remove unknown commands
    html = html.replace(/\\\\/g, '<br>');
    let prevHtml;
    do {
      prevHtml = html;
      html = html.replace(/\\[a-zA-Z]+\*?(?:\s*\[[^\]]*\])*(?:\s*\{[^{}]*\})*/g, '');
    } while (html !== prevHtml);
    html = html.replace(/\\([^a-zA-Z0-9])/g, '$1');

    // Paragraph wrapping
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs.map(para => {
      let trimmed = para.trim();
      if (!trimmed) return '';
      if (/^<\/?(h[1-6]|ul|ol|table|div|img|figure|pre|blockquote|table-wrap)/i.test(trimmed) || /^@@(TABLE|MATH)_/.test(trimmed)) {
        return trimmed;
      }
      trimmed = trimmed.replace(/\n/g, ' ');
      return `<p>${trimmed}</p>`;
    }).join('\n');

    // UNMASK TABLE and MATH
    tableStash.forEach(m => {
      html = html.split(m.token).join(m.content);
    });
    mathStash.forEach(m => {
      html = html.split(m.token).join(m.content);
    });

    // Restore special characters
    html = html.replace(/___ESC_AMP___/g, '&amp;');
    html = html.replace(/___ESC_PCT___/g, '%');
    html = html.replace(/___ESC_DOLLAR___/g, '$');
    html = html.replace(/___ESC_UNDERSCORE___/g, '_');
    html = html.replace(/___ESC_HASH___/g, '#');
    html = html.replace(/___ESC_LBRACE___/g, '{');
    html = html.replace(/___ESC_RBRACE___/g, '}');

    // Article header
    let headerHTML = '';
    if (title || author || date) {
      headerHTML += '<div class="article-header">';
      if (title) headerHTML += `<h1 class="article-title">${title}</h1>`;
      if (author) headerHTML += `<div class="article-author">${author}</div>`;
      if (date) headerHTML += `<div class="article-date">${date}</div>`;
      headerHTML += '</div>';
    }
    return headerHTML + html;
  }

  global.latexToHTML = latexToHTML;
})(window);
