const TRACK_MANIFEST_PATH = 'assets/data/tracks.json';
const DEFAULT_YOUTUBE_ID = '_JkPSw9EDmM';
const DEFAULT_HERO_TITLE = 'Out of My Body';
const DEFAULT_HERO_META = 'Pop fusion - Released this Friday';
const DEFAULT_HERO_COVER = 'assets/images/out_of_body_spiritual.webp';
const DEFAULT_HERO_COVER_ALT = 'Featured release artwork for Out of My Body';

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', handleDocumentClick);
  loadTrackManifest();

  if (typeof window !== 'undefined' && typeof YT !== 'undefined' && YT.Player) {
    initYouTubePlayer();
  }
});

async function loadTrackManifest() {
  const grid = document.getElementById('vault-grid');
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

    const activeTracks = tracks.filter((track) => track.status !== 'locked');
    const lockedTracks = tracks.filter((track) => track.status === 'locked');
    const sortedActiveTracks = sortTracksByReleaseDate(activeTracks);
    const featuredTrack = getFeaturedTrack(sortedActiveTracks);

    populateHeroTrack(featuredTrack);
    grid.innerHTML = [...sortedActiveTracks, ...lockedTracks]
      .map((track, index) => renderTrackCard(track, index, featuredTrack))
      .join('');
  } catch (error) {
    grid.innerHTML = '<p class="vault-loading">Unable to load releases right now.</p>';
    console.error('Error loading track manifest:', error);
  }
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

  const parsed = new Date(releaseDate);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getFeaturedTrack(tracks) {
  const pinnedTrack = tracks.find((track) => isPinActive(track));
  if (pinnedTrack) return pinnedTrack;

  return tracks.find((track) => track.featured) || tracks[0] || null;
}

function isPinActive(track) {
  const pinnedUntil = track?.pinnedUntil || track?.featuredUntil;
  if (!pinnedUntil) return false;

  const parsed = new Date(pinnedUntil);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return time >= today.getTime();
}

function populateHeroTrack(track) {
  const heroCover = document.getElementById('hero-cover');
  const heroBadge = document.getElementById('hero-badge');
  const heroTitle = document.getElementById('hero-title');
  const heroMeta = document.getElementById('hero-meta');
  const heroStatusLabel = document.getElementById('hero-status-label');
  const heroPlayButton = document.getElementById('play-toggle');
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

    if (heroStatusLabel) {
      heroStatusLabel.textContent = 'Featured Track';
    }

    if (heroPlayButton) {
      heroPlayButton.dataset.trackTitle = DEFAULT_HERO_TITLE;
      heroPlayButton.dataset.trackYoutubeId = DEFAULT_YOUTUBE_ID;
      heroPlayButton.setAttribute('aria-label', `Play ${DEFAULT_HERO_TITLE}`);
    }

    if (heroStreamingLinks) {
      heroStreamingLinks.innerHTML = renderHeroStreamingLinks({});
    }

    return;
  }

  const trackTitle = track.title || DEFAULT_HERO_TITLE;
  const releaseLabel = formatReleaseDate(track.releaseDate);
  const trackMeta = track.genre
    ? `${track.genre}${releaseLabel ? ` - Released ${releaseLabel}` : ''}`
    : DEFAULT_HERO_META;

  if (heroCover) {
    heroCover.src = track.cover || DEFAULT_HERO_COVER;
    heroCover.alt = track.coverAlt || `${trackTitle} cover art`;
  }

  if (heroBadge) {
    heroBadge.textContent = track.week || 'Latest Drop';
  }

  if (heroTitle) {
    heroTitle.textContent = trackTitle;
  }

  if (heroMeta) {
    heroMeta.textContent = trackMeta;
  }

  if (heroStatusLabel) {
    heroStatusLabel.textContent = track.featured ? 'Featured Track' : 'Latest Release';
  }

  if (heroPlayButton) {
    heroPlayButton.dataset.trackTitle = trackTitle;
    heroPlayButton.dataset.trackYoutubeId = track.youtubeId || DEFAULT_YOUTUBE_ID;
    heroPlayButton.setAttribute('aria-label', `Play ${trackTitle}`);
  }

  if (heroStreamingLinks) {
    heroStreamingLinks.innerHTML = renderHeroStreamingLinks(track);
  }
}

function formatReleaseDate(releaseDate) {
  if (!releaseDate) return '';

  const parsed = new Date(releaseDate);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
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
      href: track.youtubeMusicUrl || ''
    },
    {
      className: 'apple',
      label: 'Apple Music',
      href: track.appleMusicUrl || ''
    },
    {
      className: 'hyperfollow',
      label: 'HyperFollow',
      href: "https://distrokid.com/hyperfollow/ivoleusbalam/yo-voy?ref=release" || ''
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
  if (track.status === 'locked') {
    return `
      <article class="vault-card locked" aria-disabled="true">
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
  const youtubeId = track.youtubeId || DEFAULT_YOUTUBE_ID;
  const cover = track.cover || 'assets/images/out_of_body_spiritual.webp';
  const coverAlt = track.coverAlt || `${trackTitle} cover art`;
  const isHeroTrack = isSameTrack(track, featuredTrack);

  return `
    <article class="vault-card${isHeroTrack ? ' active' : ''}">
      <div class="card-img-holder">
        <button
          class="card-play-btn"
          type="button"
          aria-label="Play ${escapeHtml(trackTitle)}"
          data-play-track="true"
          data-track-title="${escapeAttribute(trackTitle)}"
          data-track-youtube-id="${escapeAttribute(youtubeId)}">
          <span class="card-play-chip" aria-hidden="true">Play</span>
        </button>
        <img src="${escapeAttribute(cover)}" alt="${escapeAttribute(coverAlt)}" loading="lazy">
        <span class="week-tag">${escapeHtml(track.week || `WK ${String(index + 1).padStart(2, '0')}`)}</span>
      </div>
      <div class="card-info">
        <h3>${escapeHtml(trackTitle)}</h3>
        <p class="genre">${escapeHtml(track.genre || 'Track')}</p>
        <button
          class="btn-lyrics"
          type="button"
          data-lyrics-target="${drawerId}"
          data-lyrics-src="${escapeAttribute(track.lyrics || '')}"
          aria-expanded="false"
          aria-controls="${drawerId}">
          View Lyrics & Concept
        </button>
      </div>
      <div id="${drawerId}" class="lyrics-drawer" hidden>
        <h4>${escapeHtml(trackTitle)}</h4>
        <pre class="lyrics-content">Click to load lyrics...</pre>
      </div>
    </article>
  `;
}

function handleDocumentClick(event) {
  const lyricsButton = event.target.closest('.btn-lyrics');
  if (lyricsButton) {
    const drawerId = lyricsButton.dataset.lyricsTarget;
    const sourcePath = lyricsButton.dataset.lyricsSrc;
    if (drawerId && sourcePath) {
      toggleAndFetchLyrics(lyricsButton, drawerId, sourcePath);
    }
    return;
  }

  const playButton = event.target.closest('[data-play-track="true"]');
  if (playButton) {
    requestTrackPlayback(playButton);
  }
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

let ytPlayer = null;
let currentTrackId = null;
let pendingTrack = null;

function getTrackFromButton(button) {
  return {
    title: button.dataset.trackTitle || 'Featured track',
    youtubeId: button.dataset.trackYoutubeId || DEFAULT_YOUTUBE_ID
  };
}

function setActivePlayButton(activeButton) {
  document.querySelectorAll('[data-play-track="true"]').forEach((button) => {
    const isActive = button === activeButton;
    button.classList.toggle('is-playing', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function requestTrackPlayback(button) {
  const track = getTrackFromButton(button);
  pendingTrack = { ...track, button };
  setActivePlayButton(button);
  updatePlayerStatus(`Loading ${track.title}...`);

  if (!ytPlayer) {
    if (typeof YT === 'undefined') {
      updatePlayerStatus('Loading player...');
      return;
    }

    initYouTubePlayer();
    return;
  }

  playRequestedTrack(track);
}

function initYouTubePlayer() {
  const playerContainer = document.getElementById('youtube-audio-player');
  if (!playerContainer || ytPlayer) return;

  ytPlayer = new YT.Player('youtube-audio-player', {
    height: '0',
    width: '0',
    videoId: getInitialVideoId(),
    playerVars: {
      playsinline: 1,
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
}

function getInitialVideoId() {
  const playButton = document.querySelector('[data-play-track="true"]');
  if (!playButton) return DEFAULT_YOUTUBE_ID;

  return playButton.dataset.trackYoutubeId || DEFAULT_YOUTUBE_ID;
}

window.onYouTubeIframeAPIReady = initYouTubePlayer;

function playRequestedTrack(track) {
  if (!ytPlayer) return;

  const state = ytPlayer.getPlayerState();
  const isSameTrack = currentTrackId === track.youtubeId;

  if (!isSameTrack) {
    currentTrackId = track.youtubeId;
    ytPlayer.loadVideoById(track.youtubeId);
    updatePlayerStatus(`Playing ${track.title}...`);
    syncPlaybackState(true);
    return;
  }

  if (state === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
    updatePlayerStatus(`Paused ${track.title}`);
    syncPlaybackState(false);
  } else if (state === YT.PlayerState.ENDED) {
    ytPlayer.loadVideoById(track.youtubeId);
    updatePlayerStatus(`Playing ${track.title}...`);
    syncPlaybackState(true);
  } else {
    ytPlayer.playVideo();
    updatePlayerStatus(`Playing ${track.title}...`);
    syncPlaybackState(true);
  }
}

function syncPlaybackState(isPlaying) {
  const icon = document.getElementById('ytPlayIcon');
  if (icon) {
    icon.textContent = isPlaying ? 'Pause' : 'Play';
  }
}

function updatePlayerStatus(message) {
  const statusText = document.getElementById('player-status-text');
  if (statusText) {
    statusText.textContent = message;
  }
}

function onPlayerReady() {
  if (pendingTrack) {
    currentTrackId = pendingTrack.youtubeId;
    ytPlayer.loadVideoById(pendingTrack.youtubeId);
    updatePlayerStatus(`Playing ${pendingTrack.title}...`);
    syncPlaybackState(true);
    pendingTrack = null;
    return;
  }

  updatePlayerStatus('Ready to play');
}

function onPlayerStateChange(event) {
  const icon = document.getElementById('ytPlayIcon');
  const statusText = document.getElementById('player-status-text');

  if (!icon || !statusText) return;

  if (event.data === YT.PlayerState.PLAYING) {
    icon.textContent = 'Pause';
    statusText.textContent = 'Playing from YouTube';
  } else if (event.data === YT.PlayerState.PAUSED) {
    icon.textContent = 'Play';
    statusText.textContent = 'Paused';
  } else if (event.data === YT.PlayerState.ENDED) {
    icon.textContent = 'Play';
    statusText.textContent = 'Finished';
    document.querySelectorAll('[data-play-track="true"]').forEach((button) => {
      button.classList.remove('is-playing');
      button.setAttribute('aria-pressed', 'false');
    });
  }
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


const scriptURL = 'https://script.google.com/macros/s/AKfycbwrtmQNN7bRaws1emSIfDgiTyfXvoo0mXcaokYx3wKR0n3NIM82WFnvQY2v9A4hsgzL/exec'; // <--- PASTE YOUR URL HERE
const form = document.getElementById('drop-form');
const btn = document.getElementById('submit-btn');
const msg = document.getElementById('response-message');

form.addEventListener('submit', e => {
  e.preventDefault();
  
  // 1. Visual feedback
  btn.disabled = true;
  btn.innerText = "Joining...";

  // 2. Prepare data
  // Using FormData makes it easy to grab all inputs by their "name" attribute
  let requestBody = new FormData(form);

  // 3. Send to Google
  fetch(scriptURL, { method: 'POST', body: requestBody})
    .then(response => {
       // Success
       btn.innerText = "You're on the list!";
       form.reset(); // Clear the inputs
       msg.innerText = "Success! Watch your inbox for the next drop.";
       msg.style.display = "block";
       msg.style.color = "#fff";
    })
    .catch(error => {
       // Error
       console.error('Error!', error.message);
       btn.disabled = false;
       btn.innerText = "Join the Drop List";
       alert("Something went wrong. Please try again.");
    });
});