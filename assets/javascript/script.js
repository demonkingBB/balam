const TRACK_MANIFEST_PATH = 'assets/data/tracks.json';
const DEFAULT_HERO_TITLE = 'Out of My Body';
const DEFAULT_HERO_META = 'Pop fusion - Released this Friday';
const DEFAULT_HERO_COVER = 'assets/images/out_of_body_spiritual.webp';
const DEFAULT_HERO_COVER_ALT = 'Featured release artwork for Out of My Body';

let vaultTracks = [];
let vaultFilter = 'all';
let vaultSearchQuery = '';
let vaultYearFilter = 'all';
let vaultGenreFilter = 'all';

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
    const response = await fetch(TRACK_MANIFEST_PATH);
    if (!response.ok) {
      throw new Error(`Manifest could not be loaded: ${response.status}`);
    }

    const data = await response.json();
    const tracks = Array.isArray(data) ? data : data.tracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new Error('Track manifest is empty');
    }

    vaultTracks = tracks;
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
      vaultYearFilter = 'all';
      vaultGenreFilter = 'all';

      if (searchInput) {
        searchInput.value = '';
      }

      if (yearSelect) {
        yearSelect.value = 'all';
      }

      if (genreSelect) {
        genreSelect.value = 'all';
      }

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
  const yearSelect = document.getElementById('vault-year-filter');
  const genreSelect = document.getElementById('vault-genre-filter');

  if (yearSelect) {
    const selectedYear = yearSelect.value || vaultYearFilter;
    const years = [...new Set(vaultTracks
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
    const selectedGenre = genreSelect.value || vaultGenreFilter;
    const genres = [...new Set(vaultTracks
      .map((track) => getTrackGenre(track))
      .filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));

    genreSelect.innerHTML = ['<option value="all">All Genres</option>']
      .concat(genres.map((genre) => `<option value="${escapeAttribute(genre)}">${escapeHtml(genre)}</option>`))
      .join('');

    vaultGenreFilter = genres.includes(selectedGenre) ? selectedGenre : 'all';
    genreSelect.value = vaultGenreFilter;
  }
}

function renderVaultGrid() {
  const grid = document.getElementById('vault-grid');
  const resultsCount = document.getElementById('vault-results-count');
  if (!grid) return;

  const activeTracks = sortTracksByReleaseDate(vaultTracks.filter((track) => track.status !== 'locked'));
  const lockedTracks = vaultTracks.filter((track) => track.status === 'locked');
  const heroTrack = getFeaturedTrack(activeTracks);

  populateHeroTrack(heroTrack);

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

function matchesVaultFilters(track) {
  const searchableText = [
    track.title,
    track.genre,
    track.week,
    track.releaseDate,
    track.lockedLabel
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (vaultSearchQuery && !searchableText.includes(vaultSearchQuery)) {
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

  if (vaultYearFilter !== 'all' && getTrackYear(track) !== vaultYearFilter) {
    return false;
  }

  if (vaultGenreFilter !== 'all' && normalizeVaultValue(getTrackGenre(track)) !== normalizeVaultValue(vaultGenreFilter)) {
    return false;
  }

  return true;
}

function getTrackYear(track) {
  const releaseTime = parseReleaseTime(track?.releaseDate);
  if (!releaseTime) return '';

  return String(new Date(releaseTime).getFullYear());
}

function getTrackGenre(track) {
  const genre = String(track?.genre || '').trim();
  if (!genre) return '';

  return genre;
}

function normalizeVaultValue(value) {
  return String(value || '').trim().toLowerCase();
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
  const heroBadge = document.getElementById('hero-badge');
  const heroTitle = document.getElementById('hero-title');
  const heroMeta = document.getElementById('hero-meta');
  const heroStreamingLinks = document.getElementById('hero-streaming-links');

  if (!track) {
    if (heroCover) {
      heroCover.src = DEFAULT_HERO_COVER;
      heroCover.alt = DEFAULT_HERO_COVER_ALT;
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
  const isUpcoming = heroMode === 'preview';
  const trackMeta = track.genre
    ? `${track.genre}${releaseLabel ? ` - ${isUpcoming ? 'Coming' : 'Released'} ${releaseLabel}` : ''}`
    : DEFAULT_HERO_META;

  if (heroCover) {
    heroCover.src = track.cover || DEFAULT_HERO_COVER;
    heroCover.alt = track.coverAlt || `${trackTitle} cover art`;
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
    heroEyebrow.textContent = isUpcoming ? 'Coming Soon Preview' : 'Official Release';
  }

  if (heroStreamingLinks) {
    heroStreamingLinks.innerHTML = renderHeroStreamingLinks(track);
  }

  configureHeroPlayer(track, heroMode);
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

function getHeroPlaybackMode(track) {
  const previewAudioPath = String(track?.previewAudio || '').trim();
  if (!previewAudioPath) return 'video';

  const requestedMode = String(track?.heroMode || 'auto').trim().toLowerCase();
  if (requestedMode === 'preview') return 'preview';
  if (requestedMode === 'video' && isValidYoutubeId(track?.youtubeId)) return 'video';

  return isTrackUpcoming(track) || !isValidYoutubeId(track?.youtubeId) ? 'preview' : 'video';
}

function configureHeroPlayer(track, mode) {
  const videoPlayer = document.getElementById('hero-video-player');
  const videoPlaceholder = document.getElementById('hero-video-placeholder');
  const youtubeEmbed = document.getElementById('hero-youtube-embed');
  const previewPlayer = document.getElementById('hero-preview-player');
  const previewAudio = document.getElementById('hero-preview-audio');
  const previewAudioPath = String(track?.previewAudio || '').trim();
  const isPreview = mode === 'preview' && previewAudioPath;
  const embedUrl = mode === 'video' ? buildYoutubeEmbedUrl(track?.youtubeId) : '';
  const hasVideo = Boolean(embedUrl);

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
          <p class="genre">${escapeHtml(track.genre || 'Track coming soon')}</p>
        </div>
      </article>
    `;
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
        <p class="genre">${escapeHtml(track.genre || 'Track')}</p>
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

function handleVaultDocumentClick(event) {
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
