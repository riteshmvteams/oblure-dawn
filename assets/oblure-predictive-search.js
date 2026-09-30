/**
 * <oblure-predictive-search>
 *
 * Search field with a live product dropdown (used in snippets/oblure-full-page-menu.liquid).
 * Results come from Shopify's predictive search, rendered by sections/oblure-predictive-search.liquid
 * and fetched with the Section Rendering API, so prices and images match the theme.
 *
 * - Searches ~250ms after typing stops; earlier requests are cancelled, answers are cached.
 * - Combobox keyboard support: ArrowUp/ArrowDown move through the results, Enter opens the
 *   highlighted one (otherwise the form submits to the search page), Escape closes the
 *   dropdown first (and only then lets the full page menu close).
 * - Clicking outside closes the dropdown.
 */
if (!customElements.get('oblure-predictive-search')) {
  const SECTION_ID = 'oblure-predictive-search';
  const DEBOUNCE_MS = 250;

  class OblurePredictiveSearch extends HTMLElement {
    #abortController = null;
    #requestController = null;
    #debounceTimer = null;
    #cache = new Map();
    #activeIndex = -1;

    connectedCallback() {
      this.form = this.querySelector('form');
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('[data-oblure-search-results]');
      this.status = this.querySelector('[data-oblure-search-status-live]');
      if (!this.input || !this.results) return;

      this.#abortController = new AbortController();
      const { signal } = this.#abortController;

      this.input.addEventListener('input', () => this.#onInput(), { signal });
      this.input.addEventListener('keydown', (event) => this.#onKeydown(event), { signal });
      this.input.addEventListener(
        'focus',
        () => {
          if (this.input.value.trim() && this.results.innerHTML.trim()) this.#open();
        },
        { signal }
      );
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (!this.contains(event.target)) this.#close();
        },
        { signal }
      );
    }

    disconnectedCallback() {
      this.#abortController?.abort();
      this.#requestController?.abort();
      clearTimeout(this.#debounceTimer);
    }

    get #isOpen() {
      return !this.results.hidden;
    }

    get #options() {
      return [...this.results.querySelectorAll('[role="option"]')];
    }

    #onInput() {
      clearTimeout(this.#debounceTimer);
      const term = this.input.value.trim();

      if (!term) {
        this.#requestController?.abort();
        this.#close();
        this.results.innerHTML = '';
        return;
      }

      this.#debounceTimer = setTimeout(() => this.#search(term), DEBOUNCE_MS);
    }

    async #search(term) {
      if (this.#cache.has(term)) {
        this.#render(this.#cache.get(term));
        return;
      }

      this.#requestController?.abort();
      this.#requestController = new AbortController();
      this.classList.add('is-loading');

      try {
        const params = new URLSearchParams({
          q: term,
          'resources[type]': 'product',
          'resources[limit]': '6',
          'resources[options][unavailable_products]': 'last',
          section_id: SECTION_ID,
        });
        const baseUrl = window.routes?.predictive_search_url ?? '/search/suggest';
        const response = await fetch(`${baseUrl}?${params}`, { signal: this.#requestController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = new DOMParser()
          .parseFromString(await response.text(), 'text/html')
          .getElementById(`shopify-section-${SECTION_ID}`)?.innerHTML ?? '';

        this.#cache.set(term, html);
        // Ignore answers for a term the visitor has already changed.
        if (this.input.value.trim() === term) this.#render(html);
      } catch (error) {
        if (error.name !== 'AbortError') console.error('[oblure-predictive-search]', error);
      } finally {
        this.classList.remove('is-loading');
      }
    }

    #render(html) {
      this.results.innerHTML = html;
      this.#setActive(-1);

      if (this.status) {
        this.status.textContent = this.results.querySelector('[data-oblure-search-status]')?.textContent.trim() ?? '';
      }

      if (html.trim()) {
        this.#open();
      } else {
        this.#close();
      }
    }

    #onKeydown(event) {
      if (!this.#isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.#move(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.#move(-1);
          break;
        case 'Enter': {
          const link = this.#options[this.#activeIndex]?.querySelector('a');
          if (!link) return;
          event.preventDefault();
          window.location.href = link.href;
          break;
        }
        case 'Escape':
          // Close the dropdown only; the full page menu stays open.
          event.preventDefault();
          event.stopPropagation();
          this.#close();
          break;
      }
    }

    #move(step) {
      const count = this.#options.length;
      if (count === 0) return;

      const next = this.#activeIndex + step;
      this.#setActive(next < 0 ? count - 1 : next % count);
    }

    #setActive(index) {
      this.#activeIndex = index;
      this.#options.forEach((option, optionIndex) => {
        option.setAttribute('aria-selected', String(optionIndex === index));
      });

      const active = this.#options[index];
      if (active) {
        this.input.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView({ block: 'nearest' });
      } else {
        this.input.removeAttribute('aria-activedescendant');
      }
    }

    #open() {
      this.results.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
    }

    #close() {
      this.results.hidden = true;
      this.input.setAttribute('aria-expanded', 'false');
      this.#setActive(-1);
    }
  }

  customElements.define('oblure-predictive-search', OblurePredictiveSearch);
}
