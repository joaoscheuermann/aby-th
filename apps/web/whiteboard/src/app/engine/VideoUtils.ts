export class VideoUtils {
  /**
   * Creates a hidden video element configured for texture usage.
   * Handles autoplay policies (muted, loop, playsinline).
   */
  static createVideoElement(url: string): HTMLVideoElement {
    const video = document.createElement('video');
    
    // Cross-origin compliance for WebGL textures
    video.crossOrigin = 'anonymous';
    
    // Setup source
    video.src = url;
    
    // Autoplay policy compliance
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.autoplay = true;

    // Zero-dimention style to keep it hidden but technically "rendered" if appended
    video.style.position = 'absolute';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '0';
    video.style.height = '0';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '-1';

    // Attempt to play immediately
    // Note: In some browsers, we might need to append it to the body.
    // For now, we'll try without appending, as Pixi often handles it.
    // If issues arise, we can append it to a hidden container.
    video.play().catch((e) => {
      console.warn('Video autoplay failed (interaction might be required):', e);
    });

    return video;
  }

  /**
   * Cleanly destroys a video element.
   */
  static destroyVideoElement(video: HTMLVideoElement) {
    video.pause();
    video.src = '';
    video.load(); // Resets the media element
    video.remove(); // Removes from DOM if it was appended
  }
}
