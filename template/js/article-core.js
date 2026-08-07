// template/js/article-core.js
document.addEventListener('DOMContentLoaded', function() {
  // 1. Build TOC and Bibliography
  if (typeof window.buildTOC === 'function') window.buildTOC();
  if (typeof window.renderBibliography === 'function') {
    window.renderBibliography(typeof BIBLIOGRAPHY_ENTRIES !== 'undefined' ? BIBLIOGRAPHY_ENTRIES : []);
  }

  // 2. Typeset MathJax
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise().catch(function (err) {
      console.error("MathJax error:", err.message);
    });
  }

  // 3. Highlight Code Syntax (Visa style)
  if (typeof hljs !== 'undefined') {
    try { hljs.highlightAll(); } catch(e) {}
  }

  // 4. Setup copy code buttons
  function setupCodeCopy() {
    document.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const codeEl = btn.closest('.code-box').querySelector('code');
        if (codeEl) {
          try {
            await navigator.clipboard.writeText(codeEl.textContent);
            const origHTML = btn.innerHTML;
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            setTimeout(() => { btn.innerHTML = origHTML; }, 2000);
          } catch (err) {
            console.error('Failed to copy', err);
          }
        }
      });
    });
  }
  setupCodeCopy();

  // 5. Automatic, completely private bookmarking
  (function() {
    // We create a unique key based on the document's title and file path.
    // This ensures that different documents have their own unique saved positions.
    const uniqueString = (document.title + window.location.pathname).replace(/[^a-zA-Z0-9]/g, '');
    const BOOKMARK_KEY = 'textohtml-bookmark-' + uniqueString;

    function getCurrentSectionId() {
      const headings = document.querySelectorAll('h2, h3, h4');
      let current = null;
      for (const h of headings) {
        const rect = h.getBoundingClientRect();
        // If the heading is near the top of the viewport
        if (rect.top <= 150) { 
          current = h.id;
        } else if (rect.top > 150) {
          break;
        }
      }
      return current;
    }

    function saveBookmark() {
      const scrollY = window.scrollY;
      
      // If we are at the very top of the page, don't bother saving.
      if (scrollY < 50) return;
      
      const sectionId = getCurrentSectionId();
      const bookmark = { scrollY, sectionId };
      
      try {
        // [DATA SAFETY NOTE]: localStorage is a sandboxed vault inside YOUR browser.
        // It never communicates with any server. Your reading position is mathematically
        // incapable of being leaked to us or anyone else. It is 100% private.
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
      } catch (e) {
        // Silently ignore errors (e.g., if the user is in strict Incognito mode)
      }
    }

    function restoreBookmark() {
      try {
        const data = localStorage.getItem(BOOKMARK_KEY);
        if (!data) return;
        
        const bookmark = JSON.parse(data);
        if (typeof bookmark.scrollY === 'number' && bookmark.scrollY > 0) {
          window.scrollTo({ top: bookmark.scrollY, behavior: 'smooth' });
          
          // Briefly highlight the section the user was reading
          if (bookmark.sectionId) {
            const el = document.getElementById(bookmark.sectionId);
            if (el) {
              el.style.transition = 'background-color 0.8s';
              el.style.backgroundColor = 'var(--border-color)';
              setTimeout(() => el.style.backgroundColor = '', 1500);
            }
          }
        }
      } catch (e) {
        // Silently fail if data is corrupted
      }
    }

    // Instead of a button, we silently save the user's position shortly after they stop scrolling.
    let scrollTimeout;
    window.addEventListener('scroll', function() {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveBookmark, 300); // Saves 300ms after scrolling stops
    }, { passive: true });

    // Wait briefly for MathJax to finish typesetting and expanding the page height before jumping.
    setTimeout(restoreBookmark, 800);
  })();
});
