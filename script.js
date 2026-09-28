const $ = id => document.getElementById(id);

const makeId = () => {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
};

// Songs are hard-coded here. Add new songs directly to this array.
let songs = [
  { id: "song-tbh", title: "T.B.H '고민중독' ", artist: "QWER", image: "", audio: "music/tbh-qwer.mp3" }
];

const PLAYLIST_STORAGE_KEY = "stackify_playlists";
const ACTIVE_PLAYLIST_STORAGE_KEY = "stackify_active_playlist";

function loadPlaylists() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYLIST_STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length) {
      return saved.map(p => ({
        id: String(p.id || makeId()),
        name: String(p.name || "Untitled Playlist"),
        songIds: Array.isArray(p.songIds) ? p.songIds.map(String).filter(id => songs.some(s => s.id === id)) : []
      }));
    }
  } catch (error) {
    console.warn("Unable to load saved playlists.", error);
  }
  return [{ id: makeId(), name: "My Stack", songIds: [] }];
}

function savePlaylists() {
  try {
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
    localStorage.setItem(ACTIVE_PLAYLIST_STORAGE_KEY, activePlaylistId || "");
  } catch (error) {
    console.warn("Unable to save playlists.", error);
  }
}

let playlists = loadPlaylists();
let activePlaylistId = localStorage.getItem(ACTIVE_PLAYLIST_STORAGE_KEY);
if (!playlists.some(p => p.id === activePlaylistId)) activePlaylistId = playlists[0].id;
savePlaylists();
let currentSongId = null;
let currentPlaybackPlaylistId = null;
let currentView = "window1";
let removePlaylistReturnFocus = null;

function activePlaylist() {
  return playlists.find(p => p.id === activePlaylistId) || playlists[0];
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 1800);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function showWindow(id) {
  document.querySelectorAll(".app-window").forEach(windowEl => {
    windowEl.classList.toggle("active-window", windowEl.id === id);
  });
  currentView = id;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (id === "window1") $("playlistDrawer").classList.add("hidden");
  renderAll();
}

function renderAll() {
  renderPlaylistChoices();
  renderLibrary();
  renderPlaylist();
  renderAddWindow();
  renderPlayerText();
  updatePlayerControls();
}

function renderPlaylistChoices() {
  $("playlistList").innerHTML = playlists.map(p => `
    <button class="playlist-item ${p.id === activePlaylistId ? "active" : ""}" data-playlist="${p.id}">
      <span>♫ ${escapeHTML(p.name)}</span>
      <small>${p.songIds.length}</small>
    </button>
  `).join("");

  document.querySelectorAll(".playlist-item").forEach(item => {
    item.addEventListener("click", () => selectPlaylist(item.dataset.playlist));
  });
}

function selectPlaylist(id) {
  if (!playlists.some(p => p.id === id)) return;
  activePlaylistId = id;
  savePlaylists();
  $("playlistDrawer").classList.add("hidden");
  showWindow("window2");
}

function removePlaylist(id) {
  const playlist = playlists.find(p => p.id === id);
  if (!playlist) return;
  if (playlists.length === 1) {
    toast("Keep at least one playlist.");
    return;
  }

  removePlaylistReturnFocus = document.activeElement;
  const dialog = $("removePlaylistDialog");
  $("removePlaylistMessage").textContent = `Remove “${playlist.name}”? Songs in this playlist will remain in your library.`;
  dialog.dataset.playlistId = id;
  dialog.classList.remove("hidden");
  dialog.setAttribute("aria-hidden", "false");
  $("cancelRemovePlaylist").focus();
}

function closeRemovePlaylistDialog(restoreFocus = true) {
  const dialog = $("removePlaylistDialog");
  dialog.classList.add("hidden");
  dialog.setAttribute("aria-hidden", "true");
  delete dialog.dataset.playlistId;
  if (restoreFocus && removePlaylistReturnFocus?.isConnected) removePlaylistReturnFocus.focus();
  removePlaylistReturnFocus = null;
}

function confirmPlaylistRemoval() {
  const dialog = $("removePlaylistDialog");
  const id = dialog.dataset.playlistId;
  const playlist = playlists.find(p => p.id === id);
  if (!playlist || playlists.length === 1) {
    closeRemovePlaylistDialog();
    if (playlists.length === 1) toast("Keep at least one playlist.");
    return;
  }

  closeRemovePlaylistDialog(false);
  playlists = playlists.filter(p => p.id !== id);
  if (activePlaylistId === id) activePlaylistId = playlists[0].id;
  if (currentPlaybackPlaylistId === id) stopPlayer();
  savePlaylists();
  showWindow("window1");
  $("homeBtn").focus();
  toast("Playlist removed.");
}

function renderLibrary() {
  const query = $("searchInput").value.toLowerCase().trim();
  const filtered = songs.filter(song => `${song.title} ${song.artist}`.toLowerCase().includes(query));
  $("songCount").textContent = `${songs.length} song${songs.length === 1 ? "" : "s"}`;

  $("libraryList").innerHTML = filtered.length ? filtered.map(song => `
    <div class="song-row">
      ${thumb(song)}
      <div class="song-info">
        <strong>${escapeHTML(song.title)}</strong>
        <small>${escapeHTML(song.artist)}</small>
      </div>
      <div class="row-actions">
        <button class="small-btn quick-add" data-id="${song.id}">Add</button>
        <button class="small-btn quick-play" data-id="${song.id}">Play</button>
      </div>
    </div>
  `).join("") : `<div class="empty">No songs found.</div>`;

  document.querySelectorAll(".quick-add").forEach(btn => {
    btn.addEventListener("click", () => pushSong(btn.dataset.id));
  });
  document.querySelectorAll(".quick-play").forEach(btn => {
    btn.addEventListener("click", () => playSong(btn.dataset.id, null));
  });
}

function thumb(song) {
  return song.image
    ? `<img class="thumb" src="${escapeHTML(song.image)}" alt="">`
    : `<div class="thumb">♪</div>`;
}

function renderPlaylist() {
  const p = activePlaylist();
  if (!p) return;
  $("playlistTitle").textContent = p.name;
  $("stackInfo").textContent = `${p.songIds.length} song${p.songIds.length === 1 ? "" : "s"} • Your Greatest Hits.`;
  $("popTop").disabled = p.songIds.length === 0;

  const rows = p.songIds.map((id, index) => songs.find(s => s.id === id)).filter(Boolean);

  $("playlistSongs").innerHTML = rows.length ? rows.map((song, index) => `
    <div class="song-row">
      ${thumb(song)}
      <div class="song-info">
        <span class="stack-label">${index === 0 ? "TOP • NEWEST" : index === rows.length - 1 ? "BOTTOM • OLDEST" : `STACK POSITION ${index + 1}`}</span>
        <strong>${escapeHTML(song.title)}</strong>
        <small>${escapeHTML(song.artist)}</small>
      </div>
      <div class="row-actions">
        <button class="small-btn play-song" data-id="${song.id}">Open</button>
      </div>
    </div>
  `).join("") : `<div class="empty">This playlist is empty. Press <strong>＋ Add</strong> to choose songs.</div>`;

  document.querySelectorAll(".play-song").forEach(btn => {
    btn.addEventListener("click", () => playSong(btn.dataset.id, activePlaylistId));
  });
}

function renderAddWindow() {
  const p = activePlaylist();
  if (!p) return;
  $("addWindowSubtitle").textContent = `Adding to “${p.name}”. Fill that up.`;
  const query = $("addSearchInput").value.toLowerCase().trim();
  const filtered = songs.filter(song => `${song.title} ${song.artist}`.toLowerCase().includes(query));

  $("addSongList").innerHTML = filtered.length ? filtered.map(song => {
    const alreadyAdded = p.songIds.includes(song.id);
    return `
      <label class="select-song ${alreadyAdded ? "already-added" : ""}">
        <input type="checkbox" class="song-check" value="${song.id}" ${alreadyAdded ? "disabled" : ""}>
        ${thumb(song)}
        <span class="song-info"><strong>${escapeHTML(song.title)}</strong><small>${escapeHTML(song.artist)}</small></span>
        <span class="selection-status">${alreadyAdded ? "In playlist" : "Select"}</span>
      </label>
    `;
  }).join("") : `<div class="empty">No songs found.</div>`;
}

function pushSong(songId) {
  const p = activePlaylist();
  if (!p || !songs.some(s => s.id === songId)) return;
  if (p.songIds.includes(songId)) {
    toast("That song is already in this playlist.");
    return;
  }
  p.songIds.unshift(songId); // PUSH: newest becomes the stack top.
  savePlaylists();
  renderAll();
  toast("Song pushed to the top.");
}

function addSelectedSongs() {
  const p = activePlaylist();
  const selected = [...document.querySelectorAll(".song-check:checked")].map(input => input.value);
  if (!selected.length) {
    toast("Select at least one song.");
    return;
  }

  // Preserve the selected order while pushing the last selected item first,
  // so the first selected item ends up at the top of the stack.
  [...selected].reverse().forEach(id => {
    if (songs.some(s => s.id === id) && !p.songIds.includes(id)) p.songIds.unshift(id);
  });

  savePlaylists();
  renderAll();
  toast(`${selected.length} song${selected.length === 1 ? "" : "s"} added to the stack.`);
  showWindow("window2");
}

function popStack() {
  const p = activePlaylist();
  if (!p?.songIds.length) return;
  const removedId = p.songIds.shift(); // POP: remove only the top item.
  if (currentSongId === removedId) stopPlayer();
  savePlaylists();
  renderAll();
  toast("Top song popped from the stack.");
}

function playSong(id, playlistId = activePlaylistId) {
  const song = songs.find(s => s.id === id);
  if (!song) return;

  currentSongId = id;
  currentPlaybackPlaylistId = playlistId && playlists.some(p => p.id === playlistId) ? playlistId : null;
  $("nowTitle").textContent = song.title;
  $("nowArtist").textContent = song.artist;
  $("playerPlaylist").textContent = currentPlaybackPlaylistId
    ? `From “${playlists.find(p => p.id === currentPlaybackPlaylistId)?.name || "playlist"}”`
    : "From your music library";
  $("coverArt").innerHTML = song.image ? `<img src="${escapeHTML(song.image)}" alt="">` : "<span>♪</span>";

  const audio = $("audio");
  audio.pause();
  audio.currentTime = 0;
  $("progress").value = 0;
  $("currentTime").textContent = "0:00";
  $("duration").textContent = "0:00";

  if (song.audio) {
    audio.src = song.audio;
    audio.load();
    audio.play().catch(() => {
      $("playerState").textContent = "Ready";
      toast("Press Play to start this audio.");
    });
  } else {
    audio.removeAttribute("src");
    $("playerState").textContent = "No audio URL";
  }

  showWindow("window3");
  updatePlayButton();
}

function stopPlayer() {
  const audio = $("audio");
  audio.pause();
  audio.removeAttribute("src");
  currentSongId = null;
  currentPlaybackPlaylistId = null;
  $("nowTitle").textContent = "Nothing Playing";
  $("nowArtist").textContent = "Select a song from the playlist.";
  $("coverArt").innerHTML = "<span>♪</span>";
  $("playerState").textContent = "Stopped";
  $("progress").value = 0;
  $("currentTime").textContent = "0:00";
  $("duration").textContent = "0:00";
  updatePlayButton();
}

function renderPlayerText() {
  $("playerPlaylist").textContent = currentPlaybackPlaylistId
    ? `From “${playlists.find(p => p.id === currentPlaybackPlaylistId)?.name || "playlist"}”`
    : "From your music library";
  if (!currentSongId) return;
  const song = songs.find(s => s.id === currentSongId);
  if (song) {
    $("nowTitle").textContent = song.title;
    $("nowArtist").textContent = song.artist;
  }
}

function currentPlaybackPlaylist() {
  return currentPlaybackPlaylistId
    ? playlists.find(p => p.id === currentPlaybackPlaylistId) || null
    : null;
}

function currentStackIndex() {
  const p = currentPlaybackPlaylist();
  return p ? p.songIds.indexOf(currentSongId) : -1;
}

function playAtIndex(index) {
  const p = currentPlaybackPlaylist();
  if (!p) return;
  if (index >= 0 && index < p.songIds.length) playSong(p.songIds[index]);
}

function nextSong() {
  const p = currentPlaybackPlaylist();
  if (!p) return;
  const i = currentStackIndex();
  if (i === -1) return playAtIndex(0);
  if (i + 1 < p.songIds.length) playAtIndex(i + 1);
  else toast("Already at the bottom of the stack.");
}

function previousSong() {
  const p = currentPlaybackPlaylist();
  if (!p) return;
  const i = currentStackIndex();
  if (i === -1) return playAtIndex(0);
  if (i - 1 >= 0) playAtIndex(i - 1);
  else toast("Already at the top of the stack.");
}

function goTop() {
  const p = currentPlaybackPlaylist() || activePlaylist();
  if (p.songIds.length) playAtIndex(0);
}

function goBottom() {
  const p = currentPlaybackPlaylist() || activePlaylist();
  if (p.songIds.length) playAtIndex(p.songIds.length - 1);
}

function updatePlayButton() {
  $("playBtn").textContent = $("audio").paused ? "▶" : "Ⅱ";
  if (currentSongId && !$("audio").paused) $("playerState").textContent = "Playing";
}

function updatePlayerControls() {
  const hasSongs = activePlaylist().songIds.length > 0;
  $("playBtn").disabled = !hasSongs && !currentSongId;
  ["prevBtn", "nextBtn", "toTop", "toBottom"].forEach(id => $(id).disabled = !hasSongs);
}

$("homeBtn").addEventListener("click", () => showWindow("window1"));
$("playlistToggle").addEventListener("click", () => {
  if (currentView !== "window1") showWindow("window1");
  $("playlistDrawer").classList.toggle("hidden");
});
$("backToHome").addEventListener("click", () => showWindow("window1"));
$("removePlaylist").addEventListener("click", () => removePlaylist(activePlaylistId));
$("cancelRemovePlaylist").addEventListener("click", () => closeRemovePlaylistDialog());
$("confirmRemovePlaylist").addEventListener("click", confirmPlaylistRemoval);
$("removePlaylistDialog").addEventListener("click", event => {
  if (event.target === event.currentTarget) closeRemovePlaylistDialog();
});
document.addEventListener("keydown", event => {
  const dialog = $("removePlaylistDialog");
  if (dialog.classList.contains("hidden")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeRemovePlaylistDialog();
  } else if (event.key === "Tab") {
    const cancelButton = $("cancelRemovePlaylist");
    const confirmButton = $("confirmRemovePlaylist");
    if (event.shiftKey && document.activeElement === cancelButton) {
      event.preventDefault();
      confirmButton.focus();
    } else if (!event.shiftKey && document.activeElement === confirmButton) {
      event.preventDefault();
      cancelButton.focus();
    }
  }
});
$("backToPlaylist").addEventListener("click", () => showWindow("window2"));
$("backFromAdd").addEventListener("click", () => showWindow("window2"));
$("openAddWindow").addEventListener("click", () => showWindow("window4"));
$("searchInput").addEventListener("input", renderLibrary);
$("addSearchInput").addEventListener("input", renderAddWindow);
$("popTop").addEventListener("click", popStack);
$("addSelected").addEventListener("click", addSelectedSongs);
$("nextBtn").addEventListener("click", nextSong);
$("prevBtn").addEventListener("click", previousSong);
$("toTop").addEventListener("click", goTop);
$("toBottom").addEventListener("click", goBottom);

$("playBtn").addEventListener("click", () => {
  const audio = $("audio");
  if (!currentSongId) return goTop();
  if (audio.src) {
    audio.paused ? audio.play() : audio.pause();
  } else {
    toast("Add an audio URL to this song first.");
  }
});

$("audio").addEventListener("play", updatePlayButton);
$("audio").addEventListener("pause", () => {
  updatePlayButton();
  if (currentSongId) $("playerState").textContent = "Paused";
});
$("audio").addEventListener("ended", nextSong);
$("audio").addEventListener("loadedmetadata", () => {
  $("duration").textContent = formatTime($("audio").duration);
});
$("audio").addEventListener("timeupdate", () => {
  const audio = $("audio");
  $("currentTime").textContent = formatTime(audio.currentTime);
  $("progress").value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
});
$("progress").addEventListener("input", e => {
  const audio = $("audio");
  if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
});

$("playlistName").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    $("playlistCreateForm").requestSubmit();
  }
});

$("playlistCreateForm").addEventListener("submit", event => {
  event.preventDefault();
  const nameInput = $("playlistName");
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  const playlist = { id: makeId(), name, songIds: [] };
  playlists.push(playlist);
  activePlaylistId = playlist.id;
  savePlaylists();
  renderAll();
  $("playlistDrawer").classList.remove("hidden");
  nameInput.value = "";
  nameInput.focus();
  toast("Playlist created.");
});

renderAll();
