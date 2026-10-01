/**
 * <oblure-card-swatches>
 *
 * Color swatches of the Oblure product card (snippets/oblure-card-product.liquid).
 * One color is always selected; the first one starts selected, and its price and link are
 * rendered by Liquid. Selecting another color shows its variant's image and price and
 * points the card link to that variant.
 *
 * Data per color comes from the card's `script[data-oblure-card-variants]`:
 *   { "<color>": { url, priceHtml, image: { src, srcset, alt } | null } }
 * The variant image is layered over the main image (so the "light off" hover image
 * still lies on top of it) and fades in once it has loaded.
 */
if (!customElements.get('oblure-card-swatches')) {
  class OblureCardSwatches extends HTMLElement {
    static VARIANT_IMAGE_CLASS = 'oblure-card__image--variant';

    #abortController = null;
    #variantImage = null;
    #imageRequest = 0;

    connectedCallback() {
      this.card = this.closest('.oblure-card');
      this.buttons = [...this.querySelectorAll('button[data-value]')];
      if (!this.card || this.buttons.length === 0) return;

      try {
        this.variants = JSON.parse(this.querySelector('script[data-oblure-card-variants]')?.textContent || '{}');
      } catch (error) {
        console.error('[oblure-card-swatches] Invalid variant data.', error);
        return;
      }

      this.price = this.card.querySelector('[data-oblure-card-price]');
      this.link = this.card.querySelector('.oblure-card__link');
      this.primaryMedia = this.card.querySelector('.oblure-card__image--primary');

      this.#abortController = new AbortController();
      this.buttons.forEach((button) => {
        button.addEventListener('click', () => this.#select(button), { signal: this.#abortController.signal });
      });

      // Price and link of the preselected color come from Liquid; only its image may differ.
      const selected = this.buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
      if (selected) this.#showImage(this.variants[selected.dataset.value]?.image ?? null);
    }

    disconnectedCallback() {
      this.#abortController?.abort();
    }

    #select(button) {
      if (button.getAttribute('aria-pressed') === 'true') return;

      const variant = this.variants[button.dataset.value];
      if (!variant) return;

      this.buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));

      if (this.price) this.price.innerHTML = variant.priceHtml;
      if (this.link) this.link.setAttribute('href', variant.url);
      this.#showImage(variant.image);
    }

    async #showImage(image) {
      // Only the latest selection may reveal its image, even if an earlier one loads later.
      const request = ++this.#imageRequest;

      if (!image) {
        this.#variantImage?.classList.remove('is-visible');
        return;
      }

      if (!this.#variantImage) {
        this.#variantImage = document.createElement('img');
        this.#variantImage.className = `oblure-card__image ${OblureCardSwatches.VARIANT_IMAGE_CLASS}`;
        this.#variantImage.sizes = this.primaryMedia?.getAttribute('sizes') || '(min-width: 750px) 50vw, 100vw';
        this.#variantImage.decoding = 'async';
        // Above the main image, below the hover ("light off") media.
        this.primaryMedia?.after(this.#variantImage);
      }

      const img = this.#variantImage;
      img.classList.remove('is-visible');
      img.alt = image.alt ?? '';
      img.srcset = image.srcset;
      img.src = image.src;

      try {
        await img.decode();
      } catch (error) {
        // Fails when the source changes mid-load (another color picked); handled below.
      }

      if (request === this.#imageRequest) img.classList.add('is-visible');
    }
  }

  customElements.define('oblure-card-swatches', OblureCardSwatches);
}
