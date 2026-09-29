/**
 * Used by sections/oblure-collection-product-grid.liquid.
 *
 * <oblure-grid-density> - the column switch. Sets `data-density` ('comfortable' | 'compact')
 *   on the grid and remembers it in localStorage; the section applies the saved value
 *   before the first paint with a small inline script.
 *
 * <oblure-load-more> - "Show more". Fetches the next page of the section (keeping the
 *   active filters and sort, which are part of the next-page URL), appends its products
 *   to #product-grid and swaps itself for the fetched count/button.
 *   Dawn's facets.js re-renders #ProductGridContainer (this element included) on filtering,
 *   so a fresh instance simply connects again.
 */
if (!customElements.get('oblure-grid-density')) {
  const STORAGE_KEY = 'oblure-grid-density';

  class OblureGridDensity extends HTMLElement {
    #abortController = null;

    connectedCallback() {
      this.grid = this.closest('[data-oblure-product-grid]');
      this.buttons = [...this.querySelectorAll('[data-density]')];
      if (!this.grid || this.buttons.length === 0) return;

      this.#abortController = new AbortController();
      this.buttons.forEach((button) => {
        button.addEventListener('click', () => this.#setDensity(button.dataset.density), {
          signal: this.#abortController.signal,
        });
      });

      this.#syncButtons();
    }

    disconnectedCallback() {
      this.#abortController?.abort();
    }

    #setDensity(density) {
      this.grid.dataset.density = density;
      try {
        localStorage.setItem(STORAGE_KEY, density);
      } catch (error) {
        // Storage can be unavailable (private mode, blocked cookies); the switch still works.
      }
      this.#syncButtons();
    }

    #syncButtons() {
      this.buttons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.density === this.grid.dataset.density));
      });
    }
  }

  customElements.define('oblure-grid-density', OblureGridDensity);
}

if (!customElements.get('oblure-load-more')) {
  class OblureLoadMore extends HTMLElement {
    #abortController = null;
    #isLoading = false;

    connectedCallback() {
      this.button = this.querySelector('[data-load-more]');
      if (!this.button) return;

      this.#abortController = new AbortController();
      this.button.addEventListener('click', () => this.#loadMore(), { signal: this.#abortController.signal });
    }

    disconnectedCallback() {
      this.#abortController?.abort();
    }

    async #loadMore() {
      const nextUrl = this.dataset.nextUrl;
      if (!nextUrl || this.#isLoading) return;

      this.#setLoading(true);

      try {
        const url = new URL(nextUrl, window.location.origin);
        url.searchParams.set('section_id', this.dataset.sectionId);

        const response = await fetch(url, { signal: this.#abortController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const newItems = [...html.querySelectorAll('#product-grid > li')];
        const list = document.getElementById('product-grid');
        if (!list || newItems.length === 0) throw new Error('No products in the next page.');

        list.append(...newItems);

        if (typeof initializeScrollAnimationTrigger === 'function') initializeScrollAnimationTrigger(list);

        // Keyboard and screen reader users continue from the first new product.
        newItems[0].querySelector('a')?.focus({ preventScroll: true });

        const nextLoadMore = html.querySelector('oblure-load-more');
        if (nextLoadMore) {
          this.replaceWith(nextLoadMore);
        } else {
          this.remove();
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('[oblure-load-more]', error);
        this.#setLoading(false);
      }
    }

    #setLoading(isLoading) {
      this.#isLoading = isLoading;
      this.button.disabled = isLoading;
      this.button.setAttribute('aria-busy', String(isLoading));
    }
  }

  customElements.define('oblure-load-more', OblureLoadMore);
}
