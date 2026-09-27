const TRACK_MANIFEST_PATH = 'assets/data/tracks.json';
const ARTIST_MANIFEST_PATH = 'assets/data/artists.json';
const DEFAULT_ARTIST_ID = 'ivoleus-balam';
const PRIMARY_CATEGORIES = [
  { id: 'urban', label: 'Urban' },
  { id: 'latin', label: 'Latin' },
  { id: 'roots', label: 'Roots' },
  { id: 'acoustic', label: 'Acoustic' },
  { id: 'nerdcore', label: 'Nerdcore' },
  { id: 'pop', label: 'Pop' },
  { id: 'culture', label: 'Culture' }
];
const DEFAULT_ARTIST = {
  id: DEFAULT_ARTIST_ID,
  name: 'Ivoleus Balam',
  cover: 'assets/images/ivoleus.png',
  coverAlt: 'Ivoleus Balam artist artwork',
  description: 'Pop fusion, Latin, urban, nerdcore, and culturally inspired releases.',
  isPrimary: true
};
const DEFAULT_HERO_TITLE = 'Out of My Body';
const DEFAULT_HERO_META = 'Pop fusion - Released this Friday';
const DEFAULT_HERO_COVER = 'assets/images/out_of_body_spiritual.webp';
const DEFAULT_HERO_COVER_ALT = 'Featured release artwork for Out of My Body';

let vaultTracks = [];
let vaultFilter = 'all';
let vaultSearchQuery = '';
let vaultYearFilter = 'all';
let vaultGenreFilter = 'all';
let vaultArtists = [DEFAULT_ARTIST];
let vaultArtistFilter = DEFAULT_ARTIST_ID;
let vaultCategoryFilter = 'all';
const revealedTrackIds = new Set();

initSite();

function initSite() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onSiteReady, { once: true });
    return;
  }

  onSiteReady();
}

function onSiteReady() {
  document.addEventListener('click', handleVaultDocumentClick);
  setupVaultControls();
  loadTrackManifest();
  setupDropForm();
}

async function loadTrackManifest() {
  const grid = document.getElementById('vault-grid');
  const resultsCount = document.getElementById('vault-results-count');
  if (!grid) return;

  try {
    const [trackResponse, artistResponse] = await Promise.all([
      fetch(TRACK_MANIFEST_PATH),
      fetch(ARTIST_MANIFEST_PATH).catch((error) => {
        console.warn('Artist manifest could not be requested:', error);
        return null;
      })
    ]);

    if (!trackResponse.ok) {
      throw new Error(`Track manifest could not be loaded: ${trackResponse.status}`);
    }

    const data = await trackResponse.json();
    const tracks = Array.isArray(data) ? data : data.tracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new Error('Track manifest is empty');
    }

    if (artistResponse?.ok) {
      try {
        const artistData = await artistResponse.json();
        const artists = Array.isArray(artistData) ? artistData : artistData.artists;
        vaultArtists = Array.isArray(artists) && artists.length ? artists : [DEFAULT_ARTIST];
      } catch (error) {
        vaultArtists = [DEFAULT_ARTIST];
        console.warn('Artist manifest could not be parsed:', error);
      }
    } else {
      vaultArtists = [DEFAULT_ARTIST];
      console.warn(`Artist manifest could not be loaded: ${artistResponse?.status || 'unavailable'}`);
    }

    vaultTracks = tracks;
    normalizeVaultSelections();
    populateVaultFilterOptions();
    renderVaultGrid();
  } catch (error) {
    grid.innerHTML = '<p class="vault-loading">Unable to load releases right now.</p>';
    if (resultsCount) {
      resultsCount.textContent = 'Unable to load releases right now.';
    }
    console.error('Error loading track manifest:', error);
  }
}

function setupVaultControls() {
  const searchInput = document.getElementById('vault-search-input');
  const artistSelect = document.getElementById('vault-artist-filter');
  const categorySelect = document.getElementById('vault-category-filter');
  const yearSelect = document.getElementById('vault-year-filter');
  const genreSelect = document.getElementById('vault-genre-filter');
  const resetButton = document.getElementById('vault-reset-filters');
  const filterButtons = document.querySelectorAll('.vault-filter');

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      vaultSearchQuery = String(event.target.value || '').trim().toLowerCase();
      renderVaultGrid();
    });
  }

  if (artistSelect) {
    artistSelect.addEventListener('change', (event) => {
      vaultArtistFilter = String(event.target.value || DEFAULT_ARTIST_ID);
      vaultCategoryFilter = 'all';
      vaultGenreFilter = 'all';
      populateVaultFilterOptions();
      renderVaultGrid();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', (event) => {
      vaultCategoryFilter = String(event.target.value || 'all');
      vaultGenreFilter = 'all';
      populateVaultFilterOptions();
      renderVaultGrid();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener('change', (event) => {
      vaultYearFilter = String(event.target.value || 'all');
      renderVaultGrid();
    });
  }

  if (genreSelect) {
    genreSelect.addEventListener('change', (event) => {
      vaultGenreFilter = String(event.target.value || 'all');
      renderVaultGrid();
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      vaultFilter = 'all';
      vaultSearchQuery = '';
      vaultArtistFilter = getPrimaryArtist().id;
      vaultCategoryFilter = 'all';
      vaultYearFilter = 'all';
      vaultGenreFilter = 'all';

      if (searchInput) {
        searchInput.value = '';
      }

      populateVaultFilterOptions();

      if (artistSelect) artistSelect.value = vaultArtistFilter;
      if (categorySelect) categorySelect.value = vaultCategoryFilter;
      if (yearSelect) yearSelect.value = vaultYearFilter;
      if (genreSelect) genreSelect.value = vaultGenreFilter;

      filterButtons.forEach((button) => {
        const isActive = button.dataset.filter === 'all';
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      renderVaultGrid();
    });
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      vaultFilter = button.dataset.filter || 'all';
      filterButtons.forEach((otherButton) => {
        const isActive = otherButton === button;
        otherButton.classList.toggle('is-active', isActive);
        otherButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      renderVaultGrid();
    });
  });
}

function populateVaultFilterOptions() {
  const artistSelect = document.getElementById('vault-artist-filter');
  const categorySelect = document.getElementById('vault-category-filter');
  const yearSelect = document.getElementById('vault-year-filter');
  const genreSelect = document.getElementById('vault-genre-filter');

  const primaryArtist = getPrimaryArtist();
  const orderedArtists = [
    primaryArtist,
    ...vaultArtists.filter((artist) => artist.id !== primaryArtist.id)
  ];

  if (artistSelect) {
    const artistIds = orderedArtists.map((artist) => String(artist.id || '').trim()).filter(Boolean);
    if (!artistIds.includes(vaultArtistFilter) && vaultArtistFilter !== 'all') {
      vaultArtistFilter = primaryArtist.id;
    }

    const artistOptions = orderedArtists.map((artist) => `
      <option value="${escapeAttribute(artist.id)}">${escapeHtml(artist.name || artist.id)}</option>
    `);

    if (orderedArtists.length > 1) {
      artistOptions.push('<option value="all">All Artists</option>');
    }

    artistSelect.innerHTML = artistOptions.join('');
    artistSelect.value = vaultArtistFilter;
  }

  if (categorySelect) {
    categorySelect.innerHTML = ['<option value="all">All Categories</option>']
      .concat(PRIMARY_CATEGORIES.map((category) => `
        <option value="${escapeAttribute(category.id)}">${escapeHtml(category.label)}</option>
      `))
      .join('');
    categorySelect.value = PRIMARY_CATEGORIES.some((category) => category.id === vaultCategoryFilter)
      ? vaultCategoryFilter
      : 'all';
    vaultCategoryFilter = categorySelect.value;
  }

  if (yearSelect) {
    const selectedYear = vaultYearFilter;
    const years = [...new Set(getArtistScopedTracks()
      .map((track) => getTrackYear(track))
      .filter(Boolean))]
      .sort((left, right) => Number(right) - Number(left));

    yearSelect.innerHTML = ['<option value="all">All Years</option>']
      .concat(years.map((year) => `<option value="${escapeAttribute(year)}">${escapeHtml(year)}</option>`))
      .join('');

    vaultYearFilter = years.includes(selectedYear) ? selectedYear : 'all';
    yearSelect.value = vaultYearFilter;
  }

  if (genreSelect) {
    const selectedGenre = vaultGenreFilter;
    const genres = [...new Set(getArtistScopedTracks()
      .filter((track) => vaultCategoryFilter === 'all' || getTrackCategory(track) === vaultCategoryFilter)
      .flatMap((track) => getTrackGenres(track)))]
      .sort((left, right) => left.localeCompare(right));

    genreSelect.innerHTML = ['<option value="all">All Genres</option>']
      .concat(genres.map((genre) => `<option value="${escapeAttribute(genre)}">${escapeHtml(genre)}</option>`))
      .join('');

    vaultGenreFilter = genres.some((genre) => normalizeVaultValue(genre) === normalizeVaultValue(selectedGenre))
      ? selectedGenre
      : 'all';
    genreSelect.value = vaultGenreFilter;
  }
}

function normalizeVaultSelections() {
  const primaryArtist = getPrimaryArtist();
  const artistIds = vaultArtists.map((artist) => String(artist.id || '').trim()).filter(Boolean);

  if (!artistIds.includes(vaultArtistFilter) && vaultArtistFilter !== 'all') {
    vaultArtistFilter = primaryArtist.id;
  }
}

function renderVaultGrid() {
  const grid = document.getElementById('vault-grid');
  const resultsCount = document.getElementById('vault-results-count');
  if (!grid) return;

  const activeTracks = sortTracksByReleaseDate(vaultTracks.filter((track) => track.status !== 'locked'));
  const lockedTracks = vaultTracks.filter((track) => track.status === 'locked');
  const primaryArtistTracks = activeTracks.filter((track) => getTrackArtistId(track) === getPrimaryArtist().id);
  const heroTrack = getFeaturedTrack(primaryArtistTracks.length ? primaryArtistTracks : activeTracks);

  populateHeroTrack(heroTrack);
  renderSelectedArtist();

  const visibleActiveTracks = activeTracks.filter((track) => matchesVaultFilters(track));
  const visibleLockedTracks = lockedTracks.filter((track) => matchesVaultFilters(track));
  const visibleTracks = [...visibleActiveTracks, ...visibleLockedTracks];

  if (!visibleTracks.length) {
    grid.innerHTML = '<p class="vault-loading">No releases match your search.</p>';
    if (resultsCount) {
      resultsCount.textContent = 'No releases match your search.';
    }
    return;
  }

  grid.innerHTML = visibleTracks
    .map((track, index) => renderTrackCard(track, index, heroTrack))
    .join('');

  if (resultsCount) {
    const trackLabel = visibleTracks.length === 1 ? 'release' : 'releases';
    resultsCount.textContent = `${visibleTracks.length} ${trackLabel} shown`;
  }
}

function renderSelectedArtist() {
  const context = document.getElementById('vault-artist-context');
  if (!context) return;

  const artist = vaultArtistFilter === 'all' ? getPrimaryArtist() : getArtistById(vaultArtistFilter);
  const heading = vaultArtistFilter === 'all' ? 'All Artists' : (artist.name || 'Artist');
  const description = vaultArtistFilter === 'all'
    ? 'Browse releases from every artist in the vault.'
    : (artist.description || `Browse releases by ${artist.name || 'this artist'}.`);

  context.innerHTML = `
    <img src="${escapeAttribute(artist.cover || DEFAULT_ARTIST.cover)}" alt="${escapeAttribute(artist.coverAlt || `${heading} artwork`)}" loading="lazy">
    <div class="vault-artist-context-copy">
      <p class="vault-artist-kicker">Artist Collection</p>
      <h3>${escapeHtml(heading)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

function matchesVaultFilters(track) {
  const searchableText = normalizeVaultSearchText([
    track.title,
    getTrackArtistName(track),
    getTrackCategoryLabel(track),
    getTrackGenres(track).join(' '),
    getTrackTags(track).join(' '),
    track.week,
    getTrackYear(track),
    track.lockedLabel
  ].filter(Boolean).join(' '));
  const searchQuery = normalizeVaultSearchText(vaultSearchQuery);

  if (searchQuery && !searchableText.includes(searchQuery)) {
    return false;
  }

  if (vaultFilter === 'featured') {
    return Boolean(track.featured);
  }

  if (vaultFilter === 'pinned') {
    return isPinActive(track);
  }

  if (vaultFilter === 'active') {
    return track.status !== 'locked';
  }

  if (vaultArtistFilter !== 'all' && getTrackArtistId(track) !== vaultArtistFilter) {
    return false;
  }

  if (vaultCategoryFilter !== 'all' && getTrackCategory(track) !== vaultCategoryFilter) {
    return false;
  }

  if (vaultYearFilter !== 'all' && getTrackYear(track) !== vaultYearFilter) {
    return false;
  }

  if (vaultGenreFilter !== 'all' && !getTrackGenres(track).some((genre) => (
    normalizeVaultValue(genre) === normalizeVaultValue(vaultGenreFilter)
  ))) {
    return false;
  }

  return true;
}

function getTrackYear(track) {
  const releaseTime = parseReleaseTime(track?.releaseDate);
  if (!releaseTime) return '';

  return String(new Date(releaseTime).getFullYear());
}

function getPrimaryArtist() {
  return vaultArtists.find((artist) => artist.isPrimary) || vaultArtists[0] || DEFAULT_ARTIST;
}

function getArtistById(artistId) {
  return vaultArtists.find((artist) => artist.id === artistId) || getPrimaryArtist();
}

function getTrackArtistId(track) {
  return String(track?.artistId || DEFAULT_ARTIST_ID).trim() || DEFAULT_ARTIST_ID;
}

function getTrackArtistName(track) {
  return getArtistById(getTrackArtistId(track)).name || 'Unknown Artist';
}

function getTrackCategory(track) {
  return normalizeVaultValue(track?.primaryCategory || track?.category);
}

function getTrackCategoryLabel(track) {
  const categoryId = getTrackCategory(track);
  const category = PRIMARY_CATEGORIES.find((item) => item.id === categoryId);
  return category?.label || String(track?.primaryCategory || track?.category || '').trim();
}

function getTrackGenres(track) {
  const rawGenres = Array.isArray(track?.genres) ? track.genres : [track?.genre];
  return [...new Set(rawGenres
    .map((genre) => String(genre || '').trim())
    .filter(Boolean))];
}

function getTrackGenre(track) {
  const configuredGenre = String(track?.genre || '').trim();
  return configuredGenre || getTrackGenres(track).join(' / ');
}

function getTrackTags(track) {
  const rawTags = Array.isArray(track?.tags) ? track.tags : [track?.tags];
  return [...new Set(rawTags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean))];
}

function getArtistScopedTracks() {
  return vaultTracks.filter((track) => (
    vaultArtistFilter === 'all' || getTrackArtistId(track) === vaultArtistFilter
  ));
}

function normalizeVaultValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeVaultSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortTracksByReleaseDate(tracks) {
  return tracks
    .map((track, index) => ({
      track,
      index,
      releaseTime: parseReleaseTime(track.releaseDate)
    }))
    .sort((left, right) => {
      if (right.releaseTime !== left.releaseTime) {
        return right.releaseTime - left.releaseTime;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.track);
}

function parseReleaseTime(releaseDate) {
  if (!releaseDate) return 0;

  const parsed = parseReleaseDate(releaseDate);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function parseReleaseDate(releaseDate) {
  const value = String(releaseDate || '').trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(value);
}

function getFeaturedTrack(tracks) {
  const pinnedTrack = tracks.find((track) => isPinActive(track));
  if (pinnedTrack) return pinnedTrack;

  return tracks.find((track) => track.featured) || tracks[0] || null;
}

function isPinActive(track) {
  const pinnedUntil = track?.pinnedUntil;
  if (!pinnedUntil) return false;

  const parsed = parseReleaseDate(pinnedUntil);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return time >= today.getTime();
}

function populateHeroTrack(track) {
  const heroEyebrow = document.getElementById('hero-eyebrow');
  const heroCover = document.getElementById('hero-cover');
  const heroContentGate = document.getElementById('hero-content-gate');
  const heroBadge = document.getElementById('hero-badge');
  const heroTitle = document.getElementById('hero-title');
  const heroMeta = document.getElementById('hero-meta');
  const heroStreamingLinks = document.getElementById('hero-streaming-links');

  if (!track) {
    if (heroCover) {
      heroCover.src = DEFAULT_HERO_COVER;
      heroCover.alt = DEFAULT_HERO_COVER_ALT;
      heroCover.hidden = false;
    }

    if (heroContentGate) {
      heroContentGate.hidden = true;
      heroContentGate.innerHTML = '';
    }

    if (heroBadge) {
      heroBadge.textContent = 'Week 01 Single';
    }

    if (heroTitle) {
      heroTitle.textContent = DEFAULT_HERO_TITLE;
    }

    if (heroMeta) {
      heroMeta.textContent = DEFAULT_HERO_META;
    }

    if (heroEyebrow) {
      heroEyebrow.textContent = 'Official Release';
    }

    if (heroStreamingLinks) {
      heroStreamingLinks.innerHTML = renderHeroStreamingLinks({});
    }

    configureHeroPlayer(null, 'video');

    return;
  }

  const trackTitle = track.title || DEFAULT_HERO_TITLE;
  const releaseLabel = formatReleaseDate(track.releaseDate);
  const heroMode = getHeroPlaybackMode(track);
  const contentNotice = getTrackContentNotice(track);
  const contentIsGated = Boolean(contentNotice && !isTrackContentRevealed(track));
  const isUpcoming = heroMode === 'preview';
  const trackGenre = getTrackGenre(track);
  const trackMeta = trackGenre
    ? `${trackGenre}${releaseLabel ? ` - ${isUpcoming ? 'Coming' : 'Released'} ${releaseLabel}` : ''}`
    : DEFAULT_HERO_META;

  if (heroCover) {
    heroCover.src = track.cover || DEFAULT_HERO_COVER;
    heroCover.alt = track.coverAlt || `${trackTitle} cover art`;
    heroCover.hidden = contentIsGated;
  }

  if (heroContentGate) {
    heroContentGate.hidden = !contentIsGated;
    heroContentGate.innerHTML = contentIsGated
      ? renderContentGate(track, contentNotice)
      : '';
  }

  if (heroBadge) {
    heroBadge.textContent = getTrackBadgeLabel(track, 0);
  }

  if (heroTitle) {
    heroTitle.textContent = trackTitle;
  }

  if (heroMeta) {
    heroMeta.textContent = trackMeta;
  }

  if (heroEyebrow) {
    heroEyebrow.textContent = contentIsGated
      ? 'Mature Themes'
      : (isUpcoming ? 'Coming Soon Preview' : 'Official Release');
  }

  if (heroStreamingLinks) {
    heroStreamingLinks.innerHTML = contentIsGated ? '' : renderHeroStreamingLinks(track);
  }

  configureHeroPlayer(track, heroMode, contentIsGated);
}

function formatReleaseDate(releaseDate) {
  if (!releaseDate) return '';

  const parsed = parseReleaseDate(releaseDate);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
}

function buildYoutubeMusicUrl(value) {
  const candidate = String(value || '').trim();
  if (!isValidYoutubeId(candidate)) return '';

  return `https://music.youtube.com/watch?v=${encodeURIComponent(candidate)}`;
}

function buildYoutubeEmbedUrl(value) {
  const candidate = String(value || '').trim();
  if (!isValidYoutubeId(candidate)) return '';

  return `https://www.youtube.com/embed/${encodeURIComponent(candidate)}?playsinline=1&controls=1&autoplay=0&rel=0`;
}

function isValidYoutubeId(value) {
  return /^[A-Za-z0-9_-]{11}$/.test(String(value || '').trim());
}

function isTrackUpcoming(track) {
  const releaseTime = parseReleaseTime(track?.releaseDate);
  if (releaseTime) return releaseTime > Date.now();

  return /coming soon|upcoming|preview/i.test(`${track?.week || ''} ${track?.status || ''}`);
}

function getTrackBadgeLabel(track, index) {
  const configuredLabel = String(track?.week || '').trim();
  const isStaleComingSoonLabel = !isTrackUpcoming(track)
    && /coming soon|upcoming|preview/i.test(configuredLabel);

  if (isStaleComingSoonLabel) return 'Released';
  return configuredLabel || `WK ${String(index + 1).padStart(2, '0')}`;
}

function getTrackContentNotice(track) {
  const notice = track?.contentNotice;
  if (!notice || notice.requiresReveal !== true) return null;

  return {
    label: String(notice.label || 'Mature Themes').trim(),
    message: String(notice.message || 'This song contains suggestive themes and sexual innuendo.').trim()
  };
}

function isTrackContentRevealed(track) {
  const notice = getTrackContentNotice(track);
  if (!notice || !track?.id) return true;
  if (revealedTrackIds.has(track.id)) return true;

  try {
    return sessionStorage.getItem(`ivoleus-revealed-track:${track.id}`) === 'true';
  } catch (error) {
    return false;
  }
}

function revealTrackContent(trackId) {
  if (!trackId) return;
  revealedTrackIds.add(trackId);

  try {
    sessionStorage.setItem(`ivoleus-revealed-track:${trackId}`, 'true');
  } catch (error) {
    // The in-memory set still keeps the reveal active for this page visit.
  }
}

function renderContentGate(track, notice) {
  return `
    <div class="content-gate-copy">
      <p class="content-gate-kicker">${escapeHtml(notice.label)}</p>
      <h3>Content Notice</h3>
      <p>${escapeHtml(notice.message)}</p>
      <p>Would you like to reveal this release?</p>
      <button
        class="btn-reveal-content"
        type="button"
        data-reveal-track="${escapeAttribute(track.id)}"
        aria-label="Reveal ${escapeHtml(track.title || 'song')}">
        Reveal Song
      </button>
    </div>
  `;
}

function getHeroPlaybackMode(track) {
  const previewAudioPath = String(track?.previewAudio || '').trim();
  if (!previewAudioPath) return 'video';

  const requestedMode = String(track?.heroMode || 'auto').trim().toLowerCase();
  if (requestedMode === 'preview') return 'preview';
  if (requestedMode === 'video' && isValidYoutubeId(track?.youtubeId)) return 'video';

  return isTrackUpcoming(track) || !isValidYoutubeId(track?.youtubeId) ? 'preview' : 'video';
}

function configureHeroPlayer(track, mode, contentIsGated = false) {
  const videoPlayer = document.getElementById('hero-video-player');
  const videoPlaceholder = document.getElementById('hero-video-placeholder');
  const youtubeEmbed = document.getElementById('hero-youtube-embed');
  const previewPlayer = document.getElementById('hero-preview-player');
  const previewAudio = document.getElementById('hero-preview-audio');
  const previewAudioPath = String(track?.previewAudio || '').trim();
  const isPreview = mode === 'preview' && previewAudioPath;
  const embedUrl = mode === 'video' ? buildYoutubeEmbedUrl(track?.youtubeId) : '';
  const hasVideo = Boolean(embedUrl);

  if (contentIsGated) {
    if (videoPlayer) videoPlayer.hidden = true;
    if (videoPlaceholder) videoPlaceholder.hidden = true;
    if (previewPlayer) previewPlayer.hidden = true;
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.removeAttribute('src');
      previewAudio.load();
    }
    if (youtubeEmbed) youtubeEmbed.removeAttribute('src');
    return;
  }

  if (videoPlayer) {
    videoPlayer.hidden = !hasVideo;
  }

  if (videoPlaceholder) {
    videoPlaceholder.hidden = Boolean(isPreview) || hasVideo;
  }

  if (previewPlayer) {
    previewPlayer.hidden = !isPreview;
  }

  if (isPreview) {
    if (youtubeEmbed) {
      youtubeEmbed.removeAttribute('src');
    }
    if (previewAudio && previewAudio.getAttribute('src') !== previewAudioPath) {
      previewAudio.src = previewAudioPath;
      previewAudio.load();
    }
    if (previewAudio) {
      previewAudio.setAttribute('aria-label', `${track.title || DEFAULT_HERO_TITLE} preview`);
    }
    return;
  }

  if (previewAudio) {
    previewAudio.pause();
    previewAudio.removeAttribute('src');
    previewAudio.load();
  }

  if (youtubeEmbed) {
    if (youtubeEmbed.getAttribute('src') !== embedUrl) {
      youtubeEmbed.src = embedUrl;
    }
  }
}

function renderHeroStreamingLinks(track) {
  const providers = [
    {
      className: 'spotify',
      label: 'Spotify',
      href: track.spotifyUrl || ''
    },
    {
      className: 'youtube',
      label: 'YouTube Music',
      href: track.youtubeMusicUrl || buildYoutubeMusicUrl(track.youtubeId)
    },
    {
      className: 'apple',
      label: 'Apple Music',
      href: track.appleMusicUrl || ''
    },
    {
      className: 'hyperfollow',
      label: 'HyperFollow',
      href: track.hyperfollowUrl || ''
    }
  ];

  return providers.map(renderProviderLink).join('');
}

function renderProviderLink(provider) {
  if (provider.href) {
    return `
      <a href="${escapeAttribute(provider.href)}" class="btn-stream ${provider.className}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(provider.label)}
      </a>
    `;
  }

  return `
    <span class="btn-stream ${provider.className} is-placeholder" aria-disabled="true">
      ${escapeHtml(provider.label)} Coming Soon
    </span>
  `;
}

function renderTrackCard(track, index, featuredTrack) {
  const trackAnchorId = track.id ? `track-${sanitizeId(track.id)}` : '';

  if (track.status === 'locked') {
    return `
      <article${trackAnchorId ? ` id="${escapeAttribute(trackAnchorId)}" data-track-id="${escapeAttribute(track.id)}"` : ''} class="vault-card locked" aria-disabled="true">
        <div class="card-img-holder">
          <div class="lock-overlay"><span>${escapeHtml(track.lockedLabel || 'Unlocks Next Friday')}</span></div>
          <span class="week-tag">${escapeHtml(track.week || `WK ${String(index + 1).padStart(2, '0')}`)}</span>
        </div>
        <div class="card-info">
          <h3>${escapeHtml(track.title || 'Coming Soon')}</h3>
          <p class="genre">${escapeHtml(getTrackGenre(track) || 'Track coming soon')}</p>
        </div>
      </article>
    `;
  }

  const contentNotice = getTrackContentNotice(track);
  if (contentNotice && !isTrackContentRevealed(track)) {
    return renderGatedTrackCard(track, index, contentNotice);
  }

  const drawerId = `lyrics-${index + 1}`;
  const trackTitle = track.title || 'Untitled track';
  const youtubeId = String(track.youtubeId || '').trim();
  const cover = track.cover || 'assets/images/out_of_body_spiritual.webp';
  const coverAlt = track.coverAlt || `${trackTitle} cover art`;
  const previewAudioPath = String(track.previewAudio || '').trim();
  const lyricsPath = String(track.lyrics || '').trim();
  const isHeroTrack = isSameTrack(track, featuredTrack);
  const cardPreviewPath = isHeroTrack ? '' : previewAudioPath;
  const cardVideoControl = isValidYoutubeId(youtubeId)
    ? `
      <button
        class="card-play-btn"
        type="button"
        data-card-youtube-id="${escapeAttribute(youtubeId)}"
        data-card-youtube-title="${escapeAttribute(trackTitle)}"
        aria-label="Show ${escapeHtml(trackTitle)} YouTube video">
        <span class="card-play-chip" aria-hidden="true">Watch Video</span>
      </button>
    `
    : '';

  return `
    <article${trackAnchorId ? ` id="${escapeAttribute(trackAnchorId)}" data-track-id="${escapeAttribute(track.id)}"` : ''} class="vault-card${isHeroTrack ? ' active' : ''}">
      <div class="card-img-holder">
        ${cardVideoControl}
        <img src="${escapeAttribute(cover)}" alt="${escapeAttribute(coverAlt)}" loading="lazy">
        <span class="week-tag">${escapeHtml(getTrackBadgeLabel(track, index))}</span>
      </div>
      <div class="card-info">
        <h3>${escapeHtml(trackTitle)}</h3>
        <p class="genre">${escapeHtml(getTrackGenre(track) || 'Track')}</p>
        ${cardPreviewPath ? `
          <div class="track-preview">
            <span class="track-preview-label">Preview</span>
            <audio controls preload="none" aria-label="${escapeAttribute(`${trackTitle} preview`)}" src="${escapeAttribute(previewAudioPath)}"></audio>
          </div>
        ` : ''}
        ${lyricsPath ? `
          <button
            class="btn-lyrics"
            type="button"
            data-lyrics-target="${drawerId}"
            data-lyrics-src="${escapeAttribute(lyricsPath)}"
            aria-expanded="false"
            aria-controls="${drawerId}">
            View Lyrics & Concept
          </button>
        ` : ''}
      </div>
      <div id="${drawerId}" class="lyrics-drawer" hidden>
        <h4>${escapeHtml(trackTitle)}</h4>
        <pre class="lyrics-content">Click to load lyrics...</pre>
      </div>
    </article>
  `;
}

function renderGatedTrackCard(track, index, notice) {
  const trackAnchorId = track.id ? `track-${sanitizeId(track.id)}` : '';

  return `
    <article${trackAnchorId ? ` id="${escapeAttribute(trackAnchorId)}" data-track-id="${escapeAttribute(track.id)}"` : ''} class="vault-card content-gated" aria-label="${escapeAttribute(notice.label)} release">
      <div class="card-img-holder">
        <div class="content-gate card-content-gate">
          ${renderContentGate(track, notice)}
        </div>
        <span class="week-tag">${escapeHtml(getTrackBadgeLabel(track, index))}</span>
      </div>
      <div class="card-info">
        <h3>${escapeHtml(notice.label)}</h3>
        <p class="genre">Reveal to view this release.</p>
      </div>
    </article>
  `;
}

function handleVaultDocumentClick(event) {
  const revealButton = event.target.closest('[data-reveal-track]');
  if (revealButton) {
    revealTrackContent(revealButton.dataset.revealTrack);
    renderVaultGrid();
    return;
  }

  const youtubeButton = event.target.closest('[data-card-youtube-id]');
  if (youtubeButton) {
    activateCardYoutubeEmbed(youtubeButton);
    return;
  }

  const lyricsButton = event.target.closest('.btn-lyrics');
  if (lyricsButton) {
    const drawerId = lyricsButton.dataset.lyricsTarget;
    const sourcePath = lyricsButton.dataset.lyricsSrc;
    if (drawerId && sourcePath) {
      toggleAndFetchLyrics(lyricsButton, drawerId, sourcePath);
    }
    return;
  }
}

function activateCardYoutubeEmbed(button) {
  const cardImageHolder = button.closest('.card-img-holder');
  const youtubeId = button.dataset.cardYoutubeId;
  const trackTitle = button.dataset.cardYoutubeTitle || 'Track';
  const embedUrl = buildYoutubeEmbedUrl(youtubeId);

  if (!cardImageHolder || !embedUrl || cardImageHolder.querySelector('.card-youtube-embed')) {
    return;
  }

  const youtubeEmbed = document.createElement('iframe');
  youtubeEmbed.className = 'card-youtube-embed';
  youtubeEmbed.title = `${trackTitle} YouTube video`;
  youtubeEmbed.loading = 'lazy';
  youtubeEmbed.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  youtubeEmbed.allowFullscreen = true;
  youtubeEmbed.src = embedUrl;

  cardImageHolder.classList.add('is-youtube-embedded');
  cardImageHolder.insertBefore(youtubeEmbed, cardImageHolder.firstChild);
  button.remove();
}

async function toggleAndFetchLyrics(button, drawerId, filePath) {
  const targetDrawer = document.getElementById(drawerId);
  if (!targetDrawer) return;

  const preContainer = targetDrawer.querySelector('.lyrics-content');
  if (!preContainer) return;

  const isOpen = !targetDrawer.hidden;

  document.querySelectorAll('.lyrics-drawer').forEach((drawer) => {
    drawer.hidden = true;
  });
  document.querySelectorAll('.btn-lyrics').forEach((otherButton) => {
    otherButton.setAttribute('aria-expanded', 'false');
  });

  if (isOpen) {
    return;
  }

  if (!targetDrawer.dataset.loaded) {
    preContainer.textContent = 'Loading lyrics...';

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Lyrics file could not be loaded: ${response.status}`);
      }

      const text = await response.text();
      preContainer.textContent = text;
      targetDrawer.dataset.loaded = 'true';
    } catch (error) {
      preContainer.textContent = 'Unable to load lyrics at this time.';
      console.error('Error fetching lyrics:', error);
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

function isSameTrack(left, right) {
  if (!left || !right) return false;

  if (left.youtubeId && right.youtubeId) {
    return left.youtubeId === right.youtubeId;
  }

  return left.title === right.title && left.week === right.week;
}

function sanitizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


function setupDropForm() {
  const scriptURL = 'https://script.google.com/macros/s/AKfycbwrtmQNN7bRaws1emSIfDgiTyfXvoo0mXcaokYx3wKR0n3NIM82WFnvQY2v9A4hsgzL/exec'; // <--- PASTE YOUR URL HERE
  const form = document.getElementById('drop-form');
  const btn = document.getElementById('submit-btn');
  const msg = document.getElementById('response-message');

  if (!form || !btn || !msg) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // 1. Visual feedback
    btn.disabled = true;
    btn.innerText = 'Joining...';

    // 2. Prepare data
    // Using FormData makes it easy to grab all inputs by their "name" attribute
    const requestBody = new FormData(form);

    // 3. Send to Google
    fetch(scriptURL, { method: 'POST', body: requestBody })
      .then(() => {
        // Success
        btn.innerText = "You're on the list!";
        form.reset();
        msg.innerText = 'Success! Watch your inbox for the next drop.';
        msg.style.display = 'block';
        msg.style.color = '#fff';
      })
      .catch((error) => {
        // Error
        console.error('Error!', error.message);
        btn.disabled = false;
        btn.innerText = 'Join the Drop List';
        alert('Something went wrong. Please try again.');
      });
  });
}

// Dropdown Menu Interaction
document.addEventListener('DOMContentLoaded', () => {
  const dropdown = document.getElementById('external-sites-dropdown');
  const triggerBtn = document.getElementById('dropdown-trigger-btn');

  if (dropdown && triggerBtn) {
    // Toggle on click
    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('is-open');
      triggerBtn.setAttribute('aria-expanded', isOpen.toString());
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('is-open');
        triggerBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('is-open')) {
        dropdown.classList.remove('is-open');
        triggerBtn.setAttribute('aria-expanded', 'false');
        triggerBtn.focus();
      }
    });
  }
});
