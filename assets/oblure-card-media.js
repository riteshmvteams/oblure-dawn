/**
 * <oblure-card-media>
 *
 * Video playback for snippets/oblure-card-product.liquid (only rendered when a card has a
 * Shopify-hosted video; see snippets/oblure-card-video.liquid).
 * - A first-media video (`data-oblure-card-video="visible"`) plays while the card is on
 *   screen and pauses while the second media is shown on hover or the card scrolls away.
 * - A second-media video (`data-oblure-card-video="hover"`) restarts and plays on hover.
 * - Nothing plays for visitors who prefer reduced motion; the poster frames stay.
 * - Devices without hover never show the second media (same as the CSS).
 */
if (!customElements.get('oblure-card-media')) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover)');

  class OblureCardMedia extends HTMLElement {
    #abortController = null;
    #observer = null;
    #isVisible = false;
    #isHovered = false;

    connectedCallback() {
      this.card = this.closest('.oblure-card') ?? this;
      this.visibleVideo = this.querySelector('video[data-oblure-card-video="visible"]');
      this.hoverVideo = this.querySelector('video[data-oblure-card-video="hover"]');
      this.hasSecondary = this.card.classList.contains('oblure-card--has-secondary');

      this.#abortController = new AbortController();
      const { signal } = this.#abortController;

      if (this.visibleVideo) {
        this.#observer = new IntersectionObserver(
          ([entry]) => {
            this.#isVisible = entry.isIntersecting;
            this.#update();
          },
          { threshold: 0.25 }
        );
        this.#observer.observe(this);
      }

      if (this.hasSecondary) {
        this.card.addEventListener('pointerenter', () => this.#setHovered(true), { signal });
        this.card.addEventListener('pointerleave', () => this.#setHovered(false), { signal });
      }

      reducedMotion.addEventListener('change', () => this.#update(), { signal });
    }

    disconnectedCallback() {
      this.#abortController?.abort();
      this.#observer?.disconnect();
      this.visibleVideo?.pause();
      this.hoverVideo?.pause();
    }

    #setHovered(isHovered) {
      if (!canHover.matches) return;

      this.#isHovered = isHovered;
      // Each hover starts the second video from the beginning.
      if (isHovered && this.hoverVideo) this.hoverVideo.currentTime = 0;
      this.#update();
    }

    #update() {
      const motionAllowed = !reducedMotion.matches;
      const showingSecondary = this.#isHovered && this.hasSecondary;

      this.#setPlaying(this.visibleVideo, motionAllowed && this.#isVisible && !showingSecondary);
      this.#setPlaying(this.hoverVideo, motionAllowed && showingSecondary);
    }

    #setPlaying(video, shouldPlay) {
      if (!video) return;

      if (shouldPlay) {
        // Can be refused (e.g. data saver); the poster frame then simply stays.
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    }
  }

  customElements.define('oblure-card-media', OblureCardMedia);
}
