// template/js/sidebar.js
(function(global) {
  'use strict';

  function buildTOC() {
    const container = document.getElementById('article-container');
    const tocContent = document.getElementById('toc-content');
    if (!container || !tocContent) return;

    const headers = container.querySelectorAll('h2, h3, h4');
    if (headers.length === 0) {
      tocContent.innerHTML = '<p class="toc-empty">Ei väliotsikoita.</p>';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'toc-list';

    headers.forEach((header, index) => {
      if (!header.id) {
        header.id = 'sec-' + index;
      }
      const li = document.createElement('li');
      li.className = `toc-item toc-${header.tagName.toLowerCase()}`;
      
      const a = document.createElement('a');
      a.href = '#' + header.id;
      a.innerHTML = header.innerHTML; 
      a.className = 'toc-link';
      
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(header.id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Sidebar stays open – removed the line that closed it
        }
      });
      li.appendChild(a);
      ul.appendChild(li);
    });

    tocContent.appendChild(ul);
  }

  function renderBibliography(entries) {
    const bibContent = document.getElementById('bib-content');
    if (!bibContent) return;

    if (!entries || entries.length === 0) {
      bibContent.innerHTML = '<p class="toc-empty">Ei lähteitä määritelty.</p>';
      return;
    }

    function getSortKey(entry) {
      let author = entry.fields.author || '';
      let firstAuthor = author.split(/\s+(?:and|\\and)\s+/i)[0].trim();
      if (!firstAuthor) {
        return entry.key.toLowerCase();
      }
      let lastName = firstAuthor;
      if (firstAuthor.includes(',')) {
        lastName = firstAuthor.split(',')[0].trim();
      } else {
        const parts = firstAuthor.split(/\s+/);
        lastName = parts[parts.length - 1];
      }
      return lastName.toLowerCase();
    }

    const sorted = [...entries].sort((a, b) => {
      return getSortKey(a).localeCompare(getSortKey(b));
    });

    bibContent.innerHTML = '<ul class="bib-list">' +
      sorted.map(e => `<li id="bib-${e.key}">${global.formatBibEntry ? global.formatBibEntry(e) : e.key}</li>`).join('') +
      '</ul>';

    document.querySelectorAll('.cite-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const key = link.getAttribute('data-cite');
        const bibSidebar = document.getElementById('bib-sidebar');
        document.getElementById('toc-sidebar').classList.remove('open');
        bibSidebar.classList.add('open');

        if (key) {
          const target = document.getElementById(`bib-${key}`);
          if (target) {
            setTimeout(() => {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              target.classList.add('highlight-bib');
              setTimeout(() => target.classList.remove('highlight-bib'), 2000);
            }, 150);
          }
        }
      });
    });
  }

  function initSidebars() {
    const tocSidebar = document.getElementById('toc-sidebar');
    const bibSidebar = document.getElementById('bib-sidebar');
    const btnOpenToc = document.getElementById('toc-toggle-fixed');
    const btnCloseToc = document.getElementById('close-toc-btn');
    const btnCloseBib = document.getElementById('close-bib-btn');

    function closeAll() {
      if (tocSidebar) tocSidebar.classList.remove('open');
      if (bibSidebar) bibSidebar.classList.remove('open');
    }

    if (btnOpenToc) {
      btnOpenToc.addEventListener('click', () => {
        if (tocSidebar.classList.contains('open')) {
          closeAll();
        } else {
          closeAll();
          tocSidebar.classList.add('open');
        }
      });
    }

    if (btnCloseToc) btnCloseToc.addEventListener('click', closeAll);
    if (btnCloseBib) btnCloseBib.addEventListener('click', closeAll);
  }

  global.buildTOC = buildTOC;
  global.renderBibliography = renderBibliography;
  global.initSidebars = initSidebars;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebars);
  } else {
    initSidebars();
  }
})(window);
