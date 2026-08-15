const LORE_MANIFEST_PATH = 'assets/data/lore.json';
const LORE_TRACK_MANIFEST_PATH = 'assets/data/tracks.json';

let loreCardCounter = 0;
let trackLookup = new Map();
let loreLookup = new Map();

initLorePage();

function initLorePage() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onLoreReady, { once: true });
    return;
  }

  onLoreReady();
}

function onLoreReady() {
  document.addEventListener('click', handleLoreDocumentClick);
  loadLoreManifest();
}

async function loadLoreManifest() {
  const chapterGrid = document.getElementById('lore-chapters-grid');
  const characterGrid = document.getElementById('lore-characters-grid');

  if (!chapterGrid || !characterGrid) return;

  try {
    const loreResponse = await fetch(LORE_MANIFEST_PATH);
    if (!loreResponse.ok) {
      throw new Error(`Lore manifest could not be loaded: ${loreResponse.status}`);
    }

    const loreData = await loreResponse.json();

    const chapters = Array.isArray(loreData?.chapters) ? loreData.chapters : [];
    const characters = Array.isArray(loreData?.characters) ? loreData.characters : [];

    loreLookup = new Map([...chapters, ...characters].filter((entry) => entry?.id).map((entry) => [entry.id, entry]));

    chapterGrid.innerHTML = chapters.length
      ? chapters.map((entry) => renderLoreCard(entry, 'chapter')).join('')
      : '<p class="vault-loading">No chapters added yet.</p>';

    characterGrid.innerHTML = characters.length
      ? characters.map((entry) => renderLoreCard(entry, 'character')).join('')
      : '<p class="vault-loading">No characters added yet.</p>';

    loadTrackLookup();
  } catch (error) {
    chapterGrid.innerHTML = '<p class="vault-loading">Unable to load chapters right now.</p>';
    characterGrid.innerHTML = '<p class="vault-loading">Unable to load characters right now.</p>';
    console.error('Error loading lore manifest:', error);
  }
}

async function loadTrackLookup() {
  try {
    const trackResponse = await fetch(LORE_TRACK_MANIFEST_PATH);
    if (!trackResponse.ok) {
      throw new Error(`Track manifest could not be loaded: ${trackResponse.status}`);
    }

    const trackData = await trackResponse.json();
    const tracks = Array.isArray(trackData?.tracks) ? trackData.tracks : Array.isArray(trackData) ? trackData : [];
    trackLookup = new Map(tracks.filter((track) => track?.id).map((track) => [track.id, track]));
  } catch (error) {
    console.error('Error loading track lookup for lore links:', error);
  }
}

function renderLoreCard(entry, kind) {
  const title = entry.title || 'Untitled lore entry';
  const summary = entry.summary || 'Open the drawer to read more.';
  const image = entry.image || 'assets/images/ivoleus.png';
  const imageAlt = entry.imageAlt || `${title} art`;
  const meta = kind === 'chapter'
    ? [entry.type, entry.tag].filter(Boolean).join(' • ')
    : [entry.role, entry.tag].filter(Boolean).join(' • ');
  const cardId = entry.id ? `lore-${sanitizeId(entry.id)}` : '';
  const drawerId = `lore-drawer-${sanitizeId(entry.id || `${kind}-${++loreCardCounter}`)}`;
  const detailsSource = entry.detailsFile || '';
  const fallbackText = summary;
  const relatedTrackIds = Array.isArray(entry.relatedTrackIds) ? entry.relatedTrackIds : [];
  const relatedChapterIds = kind === 'chapter'
    ? Array.isArray(entry.relatedCharacterIds) ? entry.relatedCharacterIds : []
    : Array.isArray(entry.relatedChapterIds) ? entry.relatedChapterIds : [];
  const audioStoryUrl = entry.audioStoryUrl || '';

  return `
    <article${cardId ? ` id="${escapeAttribute(cardId)}"` : ''} class="lore-card" data-lore-id="${escapeAttribute(entry.id || '')}">
      <div class="lore-card-media">
        <img src="${escapeAttribute(image)}" alt="${escapeAttribute(imageAlt)}" loading="lazy">
        <span class="lore-card-badge">${escapeHtml(kind === 'chapter' ? 'Chapter' : 'Character')}</span>
      </div>
      <div class="lore-card-body">
        <p class="lore-card-meta">${escapeHtml(meta || 'Lore')}</p>
        <h3>${escapeHtml(title)}</h3>
        <p class="lore-card-summary">${escapeHtml(summary)}</p>
        <button
          class="btn-lyrics lore-toggle"
          type="button"
          data-lore-target="${drawerId}"
          data-lore-src="${escapeAttribute(detailsSource)}"
          data-lore-fallback="${escapeAttribute(fallbackText)}"
          aria-expanded="false"
          aria-controls="${drawerId}">
          Open Lore
        </button>
      </div>
      <div id="${drawerId}" class="lore-drawer" hidden>
        <h4>${escapeHtml(title)}</h4>
        <pre class="lore-drawer-content">Click to load lore...</pre>
        ${audioStoryUrl ? `
          <div class="lore-audio">
            <audio controls preload="none" src="${escapeAttribute(audioStoryUrl)}"></audio>
          </div>
        ` : ''}
        ${renderRelatedLinks('Related Songs', relatedTrackIds, 'track')}
        ${renderRelatedLinks(kind === 'chapter' ? 'Related Characters' : 'Related Chapters', relatedChapterIds, kind === 'chapter' ? 'lore' : 'lore')}
      </div>
    </article>
  `;
}

function renderRelatedLinks(label, ids, kind) {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
  if (!uniqueIds.length) return '';

  const links = uniqueIds.map((id) => {
    if (kind === 'track') {
      const track = trackLookup.get(id);
      const title = track?.title || id;
      const href = `index.html#track-${sanitizeId(id)}`;
      return `<a class="lore-chip" href="${escapeAttribute(href)}">${escapeHtml(title)}</a>`;
    }

    const loreItem = loreLookup.get(id);
    const title = loreItem?.title || id;
    const href = `lore.html#lore-${sanitizeId(id)}`;
    return `<a class="lore-chip" href="${escapeAttribute(href)}">${escapeHtml(title)}</a>`;
  }).join('');

  return `
    <div class="lore-related">
      <p class="lore-related-label">${escapeHtml(label)}</p>
      <div class="lore-related-links">${links}</div>
    </div>
  `;
}

function handleLoreDocumentClick(event) {
  const toggleButton = event.target.closest('.lore-toggle');
  if (!toggleButton) return;

  const drawerId = toggleButton.dataset.loreTarget;
  if (!drawerId) return;

  toggleLoreDrawer(toggleButton, drawerId);
}

async function toggleLoreDrawer(button, drawerId) {
  const targetDrawer = document.getElementById(drawerId);
  if (!targetDrawer) return;

  const preContainer = targetDrawer.querySelector('.lore-drawer-content');
  if (!preContainer) return;

  const isOpen = !targetDrawer.hidden;

  document.querySelectorAll('.lore-drawer').forEach((drawer) => {
    drawer.hidden = true;
  });
  document.querySelectorAll('.lore-toggle').forEach((otherButton) => {
    otherButton.setAttribute('aria-expanded', 'false');
  });

  if (isOpen) {
    return;
  }

  if (!targetDrawer.dataset.loaded) {
    preContainer.textContent = 'Loading lore...';

    const sourcePath = button.dataset.loreSrc;
    const fallbackText = button.dataset.loreFallback || 'Add the deeper lore here.';

    if (!sourcePath) {
      preContainer.textContent = fallbackText;
      targetDrawer.dataset.loaded = 'true';
    } else {
      try {
        const response = await fetch(sourcePath);
        if (!response.ok) {
          throw new Error(`Lore file could not be loaded: ${response.status}`);
        }

        const text = await response.text();
        preContainer.textContent = text;
        targetDrawer.dataset.loaded = 'true';
      } catch (error) {
        preContainer.textContent = fallbackText;
        console.error('Error fetching lore text:', error);
      }
    }
  }

  targetDrawer.hidden = false;
  button.setAttribute('aria-expanded', 'true');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function sanitizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
