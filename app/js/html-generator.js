// app/js/html-generator.js
(function(global) {
  'use strict';

  let assetsPromise = null;

  const CSS_FILES = [
    './template/css/base.css',
    './template/css/article.css',
    './template/css/layout.css',
    './template/css/sidebar.css'
  ];

  const JS_FILES = [
    './template/js/theme.js',
    './template/js/bib-parser-minimal.js',
    './template/js/math-utils.js',
    './template/js/sidebar.js',
    './template/js/article-core.js'
  ];

  function escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function fetchAsset(url) {
    const response = await fetch(`${url}?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.statusText}`);
    }
    return response.text();
  }

  function loadAssets() {
    if (!assetsPromise) {
      const cssPromises = CSS_FILES.map(file => fetchAsset(file));
      const jsPromises = JS_FILES.map(file => fetchAsset(file));

      assetsPromise = Promise.all([Promise.all(cssPromises), Promise.all(jsPromises)])
        .then(([cssResults, jsResults]) => {
          const cssContent = cssResults.join('\n/* --- END OF CSS MODULE --- */\n');
          const jsContent = jsResults.join('\n/* --- END OF SCRIPT MODULE --- */\n');
          return [cssContent, jsContent];
        })
        .catch((err) => {
          console.error("Error loading template assets:", err);
          assetsPromise = null;
          throw err;
        });
    }
    return assetsPromise;
  }

  async function generateStandaloneHtml(articleHtml, bibEntries) {
    try {
      const [cssContent, jsContent] = await loadAssets();
      
      const bibEntriesJson = JSON.stringify(bibEntries);
      const titleMatch = articleHtml.match(/<h1 class="article-title">([^<]*)<\/h1>/);
      const pageTitle = titleMatch ? escapeHtml(titleMatch[1]) : 'Article';

      const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
      const bodyClasses = ['has-hamburger'];
      if (isDark) bodyClasses.push('dark');
      const bodyClassAttr = bodyClasses.length > 0 ? ` class="${bodyClasses.join(' ')}"` : '';

      // Highlight.js themes
      const highlightCssLight = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
      const highlightCssDark = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';

      return `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>${pageTitle}</title>

  <script>
    (function () {
      try {
        var saved = localStorage.getItem('visa-theme');
        var prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        var dark = saved === 'dark' || (saved !== 'light' && prefers);
        if (dark) {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {}
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">

  <!-- MathJax 4 Configuration -->
  <script>
    window.MathJax = {
      loader: { load: ['input/tex', 'output/chtml', 'ui/menu'] },
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
        processEscapes: true,
        packages: {'[+]': ['noerrors', 'action']}
      },
      chtml: {
        matchFontHeight: true,
        scale: 1,
        minScale: 0.5,
        linebreaks: {
          inline: true
        }
      },
      startup: {
        ready: () => {
          MathJax.startup.defaultReady();
        }
      }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@4/tex-chtml.js"></script>

  <!-- Syntax highlighting: highlight.js -->
  <link rel="stylesheet" id="hljs-theme-light" href="${highlightCssLight}" ${isDark ? 'disabled' : ''}>
  <link rel="stylesheet" id="hljs-theme-dark" href="${highlightCssDark}" ${isDark ? '' : 'disabled'}>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

  <style>
${cssContent}
  </style>
</head>
<body${bodyClassAttr}>
  <script>
    (function () {
      if (document.body) {
        document.body.classList.toggle('dark', document.documentElement.classList.contains('dark'));
      }
    })();
  </script>

  <!-- Top bar -->
  <div class="top-bar">
    <div class="top-bar-inner">
      <!-- TOC toggle -->
      <button id="toc-toggle-fixed" class="nav-toggle-btn" aria-label="Avaa/Sulje sisällysluettelo">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <!-- Theme toggle -->
      <button id="theme-toggle" class="theme-toggle-fixed" aria-label="Vaihda teemaa">
        <svg id="moon-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="display: ${isDark ? 'none' : 'inline'};"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        <svg id="sun-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="display: ${isDark ? 'inline' : 'none'};"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      </button>
    </div>
  </div>

  <!-- Left sidebar (TOC) -->
  <div id="toc-sidebar" class="sidebar left-sidebar">
    <div class="sidebar-header-row">
      <button id="close-toc-btn" class="icon-btn" aria-label="Sulje sisällysluettelo">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div id="toc-content"></div>
  </div>

  <!-- Right sidebar (Bib) -->
  <div id="bib-sidebar" class="sidebar right-sidebar">
    <div class="sidebar-header-row">
      <button id="close-bib-btn" class="icon-btn" aria-label="Sulje lähteet">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div id="bib-content"></div>
  </div>

  <div class="article-wrapper">
    <div id="article-container" class="article-content">
      ${articleHtml}
    </div>
  </div>

  <!-- Dynamic highlight theme toggle -->
  <script>
  (function() {
    const lightLink = document.getElementById('hljs-theme-light');
    const darkLink = document.getElementById('hljs-theme-dark');
    function updateHighlightTheme() {
      const isDark = document.body.classList.contains('dark');
      lightLink.disabled = isDark;
      darkLink.disabled = !isDark;
    }
    updateHighlightTheme();
    const observer = new MutationObserver(function(mutations) {
      for (let mutation of mutations) {
        if (mutation.attributeName === 'class') {
          updateHighlightTheme();
          break;
        }
      }
    });
    observer.observe(document.body, { attributes: true });
  })();
  </script>

  <script>
    var BIBLIOGRAPHY_ENTRIES = ${bibEntriesJson};
  </script>
  <script>
${jsContent}
  </script>
</body>
</html>`;
    } catch (err) {
      console.error("Failed to build HTML structure:", err);
      return null;
    }
  }

  global.generateStandaloneHtml = generateStandaloneHtml;
})(window);
