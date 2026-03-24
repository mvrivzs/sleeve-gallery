// Shared utilities — placeholder generation, artwork fetching

// Generate a vinyl-record placeholder image via canvas (shown while real art loads)
export function generatePlaceholder(cover) {
  const canvas = document.createElement('canvas');
  const size = 600;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 10;

  // Background — dark sleeve
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, size, size);

  // Vinyl disc body
  const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
  discGrad.addColorStop(0, '#444');
  discGrad.addColorStop(0.15, '#333');
  discGrad.addColorStop(0.5, '#3a3a3a');
  discGrad.addColorStop(0.85, '#2e2e2e');
  discGrad.addColorStop(1, '#252525');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = discGrad;
  ctx.fill();

  // Vinyl grooves — concentric rings with subtle sheen
  ctx.globalAlpha = 0.08;
  for (let r = 60; r < outerR - 10; r += 4) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 8 === 0 ? '#555' : '#333';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Center label — white
  ctx.globalAlpha = 0.45;
  const labelR = 55;
  const labelGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, labelR);
  labelGrad.addColorStop(0, '#ffffff');
  labelGrad.addColorStop(1, '#e0e0e0');
  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  ctx.fillStyle = labelGrad;
  ctx.fill();

  // Spindle hole
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();

  return canvas.toDataURL('image/jpeg', 0.85);
}

// coverImages holds the current best URL for each cover (placeholder → real)
export const coverImages = {};

// Initialize placeholders for all covers
export function initPlaceholders(covers) {
  covers.forEach(c => { coverImages[c.id] = generatePlaceholder(c); });
}

// Fetch real artwork from Spotify oEmbed API, progressively upgrade images
export async function fetchRealArtwork(covers) {
  const BATCH_SIZE = 5;
  const DELAY_BETWEEN = 300;
  const DELAY_BETWEEN_BATCHES = 1500;

  for (let i = 0; i < covers.length; i += BATCH_SIZE) {
    const batch = covers.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (cover) => {
      if (!cover.spotifyId) return;
      try {
        const url = `https://open.spotify.com/oembed?url=https://open.spotify.com/album/${cover.spotifyId}`;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();

        if (data.thumbnail_url) {
          const artUrl = data.thumbnail_url.replace('ab67616d00001e02', 'ab67616d0000b273');
          coverImages[cover.id] = artUrl;
          updateVisibleImages(cover.id, artUrl);
        }
      } catch (e) {
        console.warn(`Spotify artwork fetch failed for "${cover.title}":`, e.message);
      }
    }));
    // Pause between batches to avoid rate limiting
    if (i + BATCH_SIZE < covers.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
    }
  }
}

// Swap in real artwork for all visible <img> elements showing a given cover
export function updateVisibleImages(coverId, newUrl) {
  document.querySelectorAll(`img[data-cover-id="${coverId}"]`).forEach(img => {
    const newImg = new Image();
    newImg.onload = () => {
      img.src = newUrl;
      img.classList.remove('img-loading');
    };
    newImg.src = newUrl;
  });
}

// Extract Spotify album ID from URL or raw ID
export function extractSpotifyId(input) {
  if (!input) return null;
  input = input.trim();
  const match = input.match(/album[/:]([a-zA-Z0-9]{22})/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9]{22}$/.test(input)) return input;
  return null;
}

// Fetch album info from Spotify oEmbed
export async function fetchSpotifyAlbum(spotifyId) {
  const url = `https://open.spotify.com/oembed?url=https://open.spotify.com/album/${spotifyId}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Album not found');
  const data = await resp.json();
  return {
    title: data.title || '',
    thumbnailUrl: data.thumbnail_url ? data.thumbnail_url.replace('ab67616d00001e02', 'ab67616d0000b273') : ''
  };
}
