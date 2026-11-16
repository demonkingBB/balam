const BUY_TRACKS_PATH = 'assets/data/tracks.json';
const BUY_ARTISTS_PATH = 'assets/data/artists.json';
const PURCHASE_PAGE_SIZE = 15;
const selectedPurchaseGenres = new Set();
let purchaseTracks = [];
let purchaseArtists = [];
let selectedPurchaseArtistId = '';
let purchaseCurrentPage = 1;

document.addEventListener('DOMContentLoaded', loadPurchaseCatalog, { once: true });

async function loadPurchaseCatalog() {
  const list = document.getElementById('purchase-track-list');
  const count = document.getElementById('purchase-count');
  if (!list) return;

  try {
    const [tracksResponse, artistsResponse] = await Promise.all([
      fetch(BUY_TRACKS_PATH),
      fetch(BUY_ARTISTS_PATH)
    ]);
    if (!tracksResponse.ok || !artistsResponse.ok) throw new Error('Catalog data could not be loaded.');

    const tracksData = await tracksResponse.json();
    const artistsData = await artistsResponse.json();
    const allTracks = Array.isArray(tracksData) ? tracksData : tracksData.tracks;
    const artists = Array.isArray(artistsData) ? artistsData : artistsData.artists;
    purchaseArtists = [...artists].sort((left, right) => Number(Boolean(right.isPrimary)) - Number(Boolean(left.isPrimary)));
    selectedPurchaseArtistId = purchaseArtists.find((artist) => artist.isPrimary)?.id || purchaseArtists[0]?.id || '';

    const today = new Date();
    purchaseTracks = allTracks
      .filter((track) => {
        if (track.status === 'locked') return false;
        if (track.releaseDate && new Date(`${track.releaseDate}T00:00:00`) > today) return false;
        return isAppleTrackUrl(track.itunesPurchaseUrl)
          || isAmazonPurchaseUrl(track.amazonPurchaseUrl)
          || isAppleTrackUrl(track.appleMusicUrl);
      })
      .sort((left, right) => (right.releaseDate || '').localeCompare(left.releaseDate || ''));

    setupPurchaseControls();
    renderPurchaseTracks();
  } catch (error) {
    list.innerHTML = '<p class="vault-loading">Music could not be loaded right now.</p>';
    if (count) count.textContent = 'Unable to load releases.';
    console.error('Error loading purchase catalog:', error);
  }
}

function setupPurchaseControls() {
  const search = document.getElementById('purchase-search');
  const artistSelect = document.getElementById('purchase-artist-filter');
  const clearButton = document.getElementById('purchase-clear-filters');
  const genreContainer = document.getElementById('purchase-genres');
  const previousButton = document.getElementById('purchase-previous-page');
  const nextButton = document.getElementById('purchase-next-page');

  artistSelect.innerHTML = purchaseArtists.map((artist) => `
    <option value="${escapePurchaseAttribute(artist.id)}">${escapePurchaseHtml(artist.name)}</option>
  `).join('');
  artistSelect.value = selectedPurchaseArtistId;
  artistSelect.addEventListener('change', () => {
    selectedPurchaseArtistId = artistSelect.value;
    selectedPurchaseGenres.clear();
    purchaseCurrentPage = 1;
    renderPurchaseGenreFilters();
    renderPurchaseTracks();
  });

  search.addEventListener('input', () => {
    purchaseCurrentPage = 1;
    renderPurchaseTracks();
  });

  clearButton.addEventListener('click', () => {
    selectedPurchaseGenres.clear();
    search.value = '';
    purchaseCurrentPage = 1;
    renderPurchaseGenreFilters();
    renderPurchaseTracks();
  });

  genreContainer.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-genre]');
    if (!chip) return;
    const genre = chip.dataset.genre;
    if (selectedPurchaseGenres.has(genre)) selectedPurchaseGenres.delete(genre);
    else selectedPurchaseGenres.add(genre);
    purchaseCurrentPage = 1;
    renderPurchaseGenreFilters();
    renderPurchaseTracks();
  });

  previousButton.addEventListener('click', () => {
    if (purchaseCurrentPage > 1) {
      purchaseCurrentPage -= 1;
      renderPurchaseTracks();
    }
  });

  nextButton.addEventListener('click', () => {
    purchaseCurrentPage += 1;
    renderPurchaseTracks();
  });

  renderPurchaseGenreFilters();
}

function renderPurchaseGenreFilters() {
  const genreContainer = document.getElementById('purchase-genres');
  const artistTracks = purchaseTracks.filter((track) => track.artistId === selectedPurchaseArtistId);
  const genres = [...new Set(artistTracks.flatMap(getPurchaseTrackGenres))]
    .sort((left, right) => left.localeCompare(right));

  genreContainer.innerHTML = genres.map((genre) => {
    const isActive = selectedPurchaseGenres.has(genre);
    return `
      <button type="button" class="purchase-genre-chip${isActive ? ' is-active' : ''}" data-genre="${escapePurchaseAttribute(genre)}" aria-pressed="${isActive}">${escapePurchaseHtml(genre)}</button>
    `;
  }).join('');
}

function renderPurchaseTracks() {
  const list = document.getElementById('purchase-track-list');
  const count = document.getElementById('purchase-count');
  const clearButton = document.getElementById('purchase-clear-filters');
  const pagination = document.getElementById('purchase-pagination');
  const previousButton = document.getElementById('purchase-previous-page');
  const nextButton = document.getElementById('purchase-next-page');
  const pageStatus = document.getElementById('purchase-page-status');
  const query = (document.getElementById('purchase-search')?.value || '').trim().toLowerCase();
  const hasFilters = Boolean(query || selectedPurchaseGenres.size);
  const visibleTracks = purchaseTracks.filter((track) => {
    if (track.artistId !== selectedPurchaseArtistId) return false;
    const genres = getPurchaseTrackGenres(track);
    const searchable = [track.title, track.genre, ...genres].join(' ').toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesGenres = !selectedPurchaseGenres.size || [...selectedPurchaseGenres].some((genre) => genres.includes(genre));
    return matchesSearch && matchesGenres;
  });

  const pageCount = Math.max(1, Math.ceil(visibleTracks.length / PURCHASE_PAGE_SIZE));
  purchaseCurrentPage = Math.min(Math.max(1, purchaseCurrentPage), pageCount);
  const firstTrackIndex = (purchaseCurrentPage - 1) * PURCHASE_PAGE_SIZE;
  const pageTracks = visibleTracks.slice(firstTrackIndex, firstTrackIndex + PURCHASE_PAGE_SIZE);

  count.textContent = `${visibleTracks.length} ${visibleTracks.length === 1 ? 'release' : 'releases'}`;
  clearButton.hidden = !hasFilters;
  pagination.hidden = visibleTracks.length <= PURCHASE_PAGE_SIZE;
  pageStatus.textContent = `Page ${purchaseCurrentPage} of ${pageCount}`;
  previousButton.disabled = purchaseCurrentPage === 1;
  nextButton.disabled = purchaseCurrentPage === pageCount;

  if (!pageTracks.length) {
    list.innerHTML = selectedPurchaseGenres.size || query
      ? '<p class="vault-loading">No releases match those filters.</p>'
      : '<p class="vault-loading">No purchase links have been added for this artist yet.</p>';
    return;
  }

  list.innerHTML = pageTracks.map(renderPurchaseTrack).join('');
}

function renderPurchaseTrack(track) {
  const artist = purchaseArtists.find((candidate) => candidate.id === track.artistId)?.name || 'Ivoleus Balam';
  const genres = getPurchaseTrackGenres(track);
  const releaseDate = track.releaseDate ? new Date(`${track.releaseDate}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : '';
  const appleUrl = isAppleTrackUrl(track.itunesPurchaseUrl)
    ? track.itunesPurchaseUrl
    : (isAppleTrackUrl(track.appleMusicUrl) ? track.appleMusicUrl : '');
  const amazonUrl = isAmazonPurchaseUrl(track.amazonPurchaseUrl) ? track.amazonPurchaseUrl : '';

  return `
    <article class="purchase-track-row">
      <div class="purchase-track-main">
        <span class="purchase-track-title">${escapePurchaseHtml(track.title || 'Untitled release')}</span>
        <span class="purchase-track-artist">${escapePurchaseHtml(artist)}</span>
      </div>
      <time class="purchase-release-date"${releaseDate ? ` datetime="${escapePurchaseAttribute(track.releaseDate)}"` : ''}>${releaseDate || 'Date unavailable'}</time>
      <div class="purchase-track-genres" aria-label="Genres">${genres.map((genre) => `<span>${escapePurchaseHtml(genre)}</span>`).join('')}</div>
      <div class="purchase-track-actions" aria-label="Purchase options">
        ${appleUrl ? `<a class="purchase-store-link" href="${escapePurchaseAttribute(appleUrl)}" target="_blank" rel="noopener noreferrer">Buy on Apple / iTunes</a>` : ''}
        ${amazonUrl ? `<a class="purchase-store-link" href="${escapePurchaseAttribute(amazonUrl)}" target="_blank" rel="noopener noreferrer">Buy MP3 on Amazon</a>` : ''}
      </div>
    </article>
  `;
}

function getPurchaseTrackGenres(track) {
  const genres = Array.isArray(track.genres) && track.genres.length ? track.genres : [track.genre];
  return [...new Set(genres.map((genre) => String(genre || '').trim()).filter(Boolean))];
}

function isAppleTrackUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname === 'music.apple.com' && /\/(song|album)\//.test(url.pathname);
  } catch {
    return false;
  }
}

function isAmazonPurchaseUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /(^|\.)amazon\.com$/i.test(url.hostname) && url.protocol === 'https:';
  } catch {
    return false;
  }
}

function escapePurchaseHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function escapePurchaseAttribute(value) {
  return escapePurchaseHtml(value);
}
