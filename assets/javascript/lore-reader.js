const READER_LORE_MANIFEST_PATH = 'assets/data/lore.json';
const READER_TRACK_MANIFEST_PATH = 'assets/data/tracks.json';

let readerEntries = [];
let readerTrackLookup = new Map();

initLoreReaderPage();

function initLoreReaderPage() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLoreReader, { once: true });
    return;
  }

  loadLoreReader();
}

async function loadLoreReader() {
  const requestedId = new URLSearchParams(window.location.search).get('id') || '';
  const readerLoading = document.getElementById('reader-loading');
  const readerError = document.getElementById('reader-error');
  const readerArticle = document.getElementById('reader-article');

  try {
    const loreResponse = await fetch(READER_LORE_MANIFEST_PATH);
    if (!loreResponse.ok) {
      throw new Error(`Lore manifest could not be loaded: ${loreResponse.status}`);
    }

    const loreData = await loreResponse.json();
    const chapters = Array.isArray(loreData?.chapters)
      ? loreData.chapters.map((entry) => ({ ...entry, kind: 'chapter' }))
      : [];
    const characters = Array.isArray(loreData?.characters)
      ? loreData.characters.map((entry) => ({ ...entry, kind: 'character' }))
      : [];

    readerEntries = [...chapters, ...characters];
    const entry = readerEntries.find((item) => item.id === requestedId);

    if (!entry) {
      throw new Error('Lore entry was not found');
    }

    await loadReaderTrackLookup();
    populateReader(entry);

    const detailsResponse = await fetch(entry.detailsFile || '');
    if (!detailsResponse.ok) {
      throw new Error(`Lore file could not be loaded: ${detailsResponse.status}`);
    }

    document.getElementById('reader-content').textContent = await detailsResponse.text();
    if (readerLoading) readerLoading.hidden = true;
    if (readerArticle) readerArticle.hidden = false;
  } catch (error) {
    if (readerLoading) readerLoading.hidden = true;
    if (readerError) {
      readerError.textContent = requestedId
        ? 'This lore entry could not be loaded yet.'
        : 'Choose a lore entry from the archive to begin reading.';
      readerError.hidden = false;
    }
    console.error('Error loading lore reader:', error);
  }
}

async function loadReaderTrackLookup() {
  try {
    const trackResponse = await fetch(READER_TRACK_MANIFEST_PATH);
    if (!trackResponse.ok) return;

    const trackData = await trackResponse.json();
    const tracks = Array.isArray(trackData?.tracks)
      ? trackData.tracks
      : Array.isArray(trackData) ? trackData : [];
    readerTrackLookup = new Map(tracks.filter((track) => track?.id).map((track) => [track.id, track]));
  } catch (error) {
    console.warn('Track links are using their IDs in the lore reader:', error);
  }
}

function populateReader(entry) {
  const title = entry.title || 'Untitled lore entry';
  const meta = entry.kind === 'chapter'
    ? [entry.type, entry.tag].filter(Boolean).join(' / ')
    : [entry.role, entry.tag].filter(Boolean).join(' / ');
  const readerCover = document.getElementById('reader-cover');
  const readerMeta = document.getElementById('reader-meta');
  const readerTitle = document.getElementById('reader-title');
  const readerSummary = document.getElementById('reader-summary');
  const readerAudio = document.getElementById('reader-audio');

  document.title = `${title} | Ivoleus Lore`;

  if (readerCover) {
    readerCover.src = entry.image || 'assets/images/ivoleus.png';
    readerCover.alt = entry.imageAlt || `${title} art`;
  }

  if (readerMeta) readerMeta.textContent = meta || 'Lore Entry';
  if (readerTitle) readerTitle.textContent = title;
  if (readerSummary) readerSummary.textContent = entry.summary || '';
  if (readerAudio) readerAudio.innerHTML = renderReaderAudio(entry);

  const relatedTrackIds = Array.isArray(entry.relatedTrackIds) ? entry.relatedTrackIds : [];
  const relatedLoreIds = entry.kind === 'chapter'
    ? Array.isArray(entry.relatedCharacterIds) ? entry.relatedCharacterIds : []
    : Array.isArray(entry.relatedChapterIds) ? entry.relatedChapterIds : [];
  const readerRelated = document.getElementById('reader-related');

  if (readerRelated) {
    readerRelated.innerHTML = [
      renderReaderRelatedLinks('Related Songs', relatedTrackIds, 'track'),
      renderReaderRelatedLinks(entry.kind === 'chapter' ? 'Related Characters' : 'Related Chapters', relatedLoreIds, 'lore')
    ].join('');
  }

  renderReaderNavigation(entry);
}

function renderReaderAudio(entry) {
  const stories = Array.isArray(entry.audioStories)
    ? entry.audioStories
    : entry.audioStoryUrl
      ? [{ label: 'Audio Story', url: entry.audioStoryUrl }]
      : [];

  return stories.map((story, index) => {
    const storyData = typeof story === 'string' ? { url: story } : story || {};
    const url = String(storyData.url || '').trim();
    if (!url) return '';

    const label = storyData.label || `Audio Story${stories.length > 1 ? ` ${index + 1}` : ''}`;
    const youtubeId = getReaderYoutubeVideoId(url);

    if (youtubeId) {
      return `
        <div class="lore-audio lore-youtube">
          <p class="lore-audio-label">${readerEscapeHtml(label)}</p>
          <div class="lore-youtube-frame">
            <iframe
              src="https://www.youtube-nocookie.com/embed/${readerEscapeAttribute(youtubeId)}?rel=0"
              title="${readerEscapeAttribute(label)}"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen></iframe>
          </div>
        </div>
      `;
    }

    return `
      <div class="lore-audio">
        <p class="lore-audio-label">${readerEscapeHtml(label)}</p>
        <audio controls preload="none" aria-label="${readerEscapeAttribute(label)}" src="${readerEscapeAttribute(url)}"></audio>
      </div>
    `;
  }).join('');
}

function renderReaderRelatedLinks(label, ids, kind) {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
  if (!uniqueIds.length) return '';

  const links = uniqueIds.map((id) => {
    if (kind === 'track') {
      const title = readerTrackLookup.get(id)?.title || id;
      return `<a class="lore-chip" href="${readerEscapeAttribute(`index.html#track-${readerSanitizeId(id)}`)}">${readerEscapeHtml(title)}</a>`;
    }

    return `<a class="lore-chip" href="${readerEscapeAttribute(`lore-reader.html?id=${encodeURIComponent(id)}`)}">${readerEscapeHtml(id)}</a>`;
  }).join('');

  return `
    <div class="lore-related">
      <p class="lore-related-label">${readerEscapeHtml(label)}</p>
      <div class="lore-related-links">${links}</div>
    </div>
  `;
}

function renderReaderNavigation(entry) {
  const navigation = document.getElementById('reader-navigation');
  const previousLink = document.getElementById('reader-previous');
  const nextLink = document.getElementById('reader-next');
  const sameKindEntries = readerEntries.filter((item) => item.kind === entry.kind && item.detailsFile);
  const currentIndex = sameKindEntries.findIndex((item) => item.id === entry.id);
  const previousEntry = currentIndex > 0 ? sameKindEntries[currentIndex - 1] : null;
  const nextEntry = currentIndex >= 0 && currentIndex < sameKindEntries.length - 1
    ? sameKindEntries[currentIndex + 1]
    : null;

  if (!navigation || !previousLink || !nextLink) return;

  previousLink.hidden = !previousEntry;
  nextLink.hidden = !nextEntry;
  navigation.hidden = !previousEntry && !nextEntry;

  if (previousEntry) {
    previousLink.href = `lore-reader.html?id=${encodeURIComponent(previousEntry.id)}`;
    previousLink.textContent = `Previous: ${previousEntry.title || previousEntry.id}`;
  }

  if (nextEntry) {
    nextLink.href = `lore-reader.html?id=${encodeURIComponent(nextEntry.id)}`;
    nextLink.textContent = `Next: ${nextEntry.title || nextEntry.id}`;
  }
}

function getReaderYoutubeVideoId(value) {
  try {
    const parsedUrl = new URL(value, window.location.href);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';

    if (hostname === 'youtu.be') {
      candidate = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
    } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (parsedUrl.pathname === '/watch') {
        candidate = parsedUrl.searchParams.get('v') || '';
      } else {
        const pathMatch = parsedUrl.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/);
        candidate = pathMatch ? pathMatch[1] : '';
      }
    }

    const idMatch = candidate.match(/[A-Za-z0-9_-]{11}/);
    return idMatch ? idMatch[0] : '';
  } catch (error) {
    return '';
  }
}

function readerEscapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readerEscapeAttribute(value) {
  return readerEscapeHtml(value);
}

function readerSanitizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
