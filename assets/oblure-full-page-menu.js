/**
 * <oblure-full-page-menu>
 *
 * Used by snippets/oblure-full-page-menu.liquid.
 * - Opens/closes the panel (Escape closes, focus stays inside while open, page scroll is locked).
 * - Toggles the accordions of top-level links that have children.
 * - Sets `--oblure-fpm-background` to the hovered/focused item's `data-hover-background`,
 *   and back to the default (the page's color theme or the header color scheme) otherwise.
 */
if (!customElements.get('oblure-full-page-menu')) {
  class OblureFullPageMenu extends HTMLElement {
    static OPEN_CLASS = 'oblure-fpm-open';
    static FOCUSABLE =
      'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), [tabindex]:not([tabindex="-1"])';

    #abortController = null;

    connectedCallback() {
      this.toggle = this.querySelector('[data-oblure-fpm-toggle]');
      this.panel = this.querySelector('[data-oblure-fpm-panel]');
      this.nav = this.querySelector('[data-oblure-fpm-nav]');
      this.sectionHeader = this.closest('.section-header');
      if (!this.toggle || !this.panel) return;

      this.#abortController = new AbortController();
      const { signal } = this.#abortController;

      this.toggle.addEventListener('click', () => (this.isOpen ? this.close() : this.open()), { signal });
      this.addEventListener('keydown', (event) => this.#onKeydown(event), { signal });

      this.querySelectorAll('[data-oblure-fpm-accordion]').forEach((button) => {
        button.addEventListener('click', () => this.#toggleAccordion(button), { signal });
      });

      if (this.nav) {
        this.nav.addEventListener('pointerover', (event) => this.#previewItem(event.target), { signal });
        this.nav.addEventListener('focusin', (event) => this.#previewItem(event.target), { signal });
        this.nav.addEventListener('pointerleave', () => this.#resetBackground(), { signal });
        this.nav.addEventListener(
          'focusout',
          (event) => {
            if (!this.nav.contains(event.relatedTarget)) this.#resetBackground();
          },
          { signal }
        );
      }
    }

    disconnectedCallback() {
      this.#abortController?.abort();
      if (this.isOpen) this.close({ restoreFocus: false });
    }

    get isOpen() {
      return this.hasAttribute('open');
    }

    open() {
      this.#updateOffset();
      this.panel.inert = false;
      this.setAttribute('open', '');
      this.toggle.setAttribute('aria-expanded', 'true');
      this.sectionHeader?.classList.add(OblureFullPageMenu.OPEN_CLASS);
      document.body.classList.add('overflow-hidden');
    }

    close({ restoreFocus = true } = {}) {
      this.removeAttribute('open');
      this.panel.inert = true;
      this.toggle.setAttribute('aria-expanded', 'false');
      this.sectionHeader?.classList.remove(OblureFullPageMenu.OPEN_CLASS);
      document.body.classList.remove('overflow-hidden');
      this.#resetBackground();
      if (restoreFocus) this.toggle.focus();
    }

    /* The panel starts right below the header, wherever the header currently sits. */
    #updateOffset() {
      const headerBottom = this.sectionHeader?.getBoundingClientRect().bottom ?? 0;
      this.style.setProperty('--oblure-fpm-offset', `${Math.max(0, Math.round(headerBottom))}px`);
    }

    #onKeydown(event) {
      if (!this.isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      } else if (event.key === 'Tab') {
        this.#trapFocus(event);
      }
    }

    /* Keeps Tab cycling between the toggle and the visible panel controls. */
    #trapFocus(event) {
      const focusable = [this.toggle, ...this.panel.querySelectorAll(OblureFullPageMenu.FOCUSABLE)].filter(
        (element) => element.getClientRects().length > 0
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    #toggleAccordion(button) {
      const sublist = document.getElementById(button.getAttribute('aria-controls'));
      if (!sublist) return;

      const expand = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expand));
      sublist.hidden = !expand;
    }

    #previewItem(target) {
      const item = target instanceof Element ? target.closest('.oblure-fpm__item') : null;
      if (!item) return;

      // Sub-links without a theme of their own keep their parent's color.
      const color = item.closest('[data-hover-background]')?.dataset.hoverBackground;
      if (color) {
        this.style.setProperty('--oblure-fpm-background', color);
      } else {
        this.#resetBackground();
      }
    }

    #resetBackground() {
      this.style.removeProperty('--oblure-fpm-background');
    }
  }

  customElements.define('oblure-full-page-menu', OblureFullPageMenu);
}