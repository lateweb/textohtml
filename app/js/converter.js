// app/js/converter.js
(function() {
  'use strict';

  const texInput = document.getElementById('texInput');
  const bibInput = document.getElementById('bibInput');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function extractMetadataFromHtml(html) {
    const stripTags = str => str.replace(/<[^>]+>/g, '').trim();
    
    const titleMatch = html.match(/<h1 class="article-title">([\s\S]*?)<\/h1>/i);
    return titleMatch ? stripTags(titleMatch[1]) : 'document';
  }

  async function generateHtml() {
    const texSource = texInput.value;
    if (!texSource.trim()) {
      showToast('Please enter LaTeX source.');
      return null;
    }

    let bibEntries = [];
    if (bibInput.value.trim()) {
      try {
        bibEntries = window.parseBibtex(bibInput.value);
      } catch (e) {
        showToast('Failed to parse BibTeX. Check syntax.');
        return null;
      }
    }

    try {
      const articleHtml = window.latexToHTML(texSource, bibEntries);
      return await window.generateStandaloneHtml(articleHtml, bibEntries);
    } catch (error) {
      console.error(error);
      showToast('Conversion error. Check your LaTeX syntax.');
      return null;
    }
  }

  copyBtn.addEventListener('click', async () => {
    const original = copyBtn.textContent;
    copyBtn.textContent = 'Generating...';
    try {
      const html = await generateHtml();
      if (!html) {
        copyBtn.textContent = original;
        return;
      }
      await navigator.clipboard.writeText(html);
      copyBtn.textContent = 'Copied!';
    } catch (err) {
      showToast('Copy failed.');
      copyBtn.textContent = 'Failed';
    } finally {
      setTimeout(() => { copyBtn.textContent = original; }, 2000);
    }
  });

  downloadBtn.addEventListener('click', async () => {
    const original = downloadBtn.textContent;
    downloadBtn.textContent = 'Generating...';
    try {
      const html = await generateHtml();
      if (!html) {
        downloadBtn.textContent = original;
        return;
      }

      const extractedTitle = extractMetadataFromHtml(html);
      const safeTitle = extractedTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      let filename = prompt('Enter a name for the HTML file:', `${safeTitle}.html`);
      if (filename === null) {
        downloadBtn.textContent = original;
        return;
      }
      let finalName = filename.trim() || `${safeTitle}.html`;
      if (!finalName.endsWith('.html') && !finalName.endsWith('.htm')) {
        finalName += '.html';
      }

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Download started.');
    } catch(err) {
      console.error(err);
      showToast('Download failed.');
    } finally {
      downloadBtn.textContent = original;
    }
  });
})();
