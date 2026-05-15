// --- 1. PWA SERVICE WORKER REGISTRATION ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(() => console.log("PWA: Active."))
    .catch((err) => console.log("PWA: Error", err));
}

// --- 2. GLOBAL UTILITIES (Outside DOMContentLoaded for HTML access) ---

// Global Language Toggle (DUB vs SUB)
let globalLanguage = localStorage.getItem("global-lang") || "sub";

// Cycle Status: Plan -> Watching -> Completed -> Dropped
window.cycleStatus = (index) => {
  const myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
  if (!myAnimeList[index]) return;

  myAnimeList[index].status = (myAnimeList[index].status + 1) % 4;
  localStorage.setItem("anime-data", JSON.stringify(myAnimeList));
  window.dispatchEvent(new Event("anime-updated"));
};

// Toggle between Original (SUB) and English (DUB) titles per Anime
window.toggleTitleDisplay = (index) => {
  const myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
  if (!myAnimeList[index]) return;

  myAnimeList[index].displayEnglish = !myAnimeList[index].displayEnglish;
  localStorage.setItem("anime-data", JSON.stringify(myAnimeList));
  window.dispatchEvent(new Event("anime-updated"));
};

// Prompt-based quick update for episodes with Season Selection
window.quickUpdateProgress = (index) => {
  const myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
  const anime = myAnimeList[index];
  if (!anime) return;

  // Generate options for the prompt
  const options = anime.seasons.map((s, i) => 
    `${i + 1}: ${s.seasonName} (${s.episodes[0].episodesWatched}/${s.episodes[0].episodesTotal})`
  ).join('\n');
  
  const choice = anime.seasons.length > 1 
    ? prompt(`Select Season Number:\n${options}`, "1")
    : "1";

  const sIdx = parseInt(choice) - 1;
  const targetSeason = anime.seasons[sIdx];

  if (targetSeason) {
    const newVal = prompt(`Update episodes for ${anime.title} - ${targetSeason.seasonName}:`, targetSeason.episodes[0].episodesWatched);
    if (newVal !== null && !isNaN(newVal)) {
      const val = parseInt(newVal);
      const total = targetSeason.episodes[0].episodesTotal;
      targetSeason.episodes[0].episodesWatched = Math.max(0, total > 0 ? Math.min(val, total) : val);

      // Global status check
      let tW = 0, tT = 0;
      anime.seasons.forEach(s => { tW += s.episodes[0].episodesWatched; tT += s.episodes[0].episodesTotal; });
      if (tW > 0 && anime.status === 0) anime.status = 1;
      if (tT > 0 && tW >= tT) anime.status = 2;

      localStorage.setItem("anime-data", JSON.stringify(myAnimeList));
      window.dispatchEvent(new Event("anime-updated"));
    }
  }
};

// --- 3. MAIN APPLICATION ---
document.addEventListener("DOMContentLoaded", function () {
  let myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
  let currentFilter = -1;
  let editIndex = -1;
  let searchTimer;
  let listSearchInput = "";
  let selectedItems = [];

  const statusNames = ["Plan to Watch", "Watching", "Completed", "Dropped"];
  const statusColors = ["status-plan", "status-watching", "status-completed", "status-dropped"];

  // DOM Elements
  const langBtn = document.getElementById("lang-toggle-btn");
  const listSearchInputElement = document.getElementById("list-search-input");
  const searchInput = document.getElementById("name-input");
  const suggestions = document.getElementById("suggestions");
  const addNameInput = document.getElementById("anime-name");
  const addButton = document.getElementById("add-anime");
  const list = document.getElementById("anime-list");
  const cancelButton = document.getElementById("cancel-edit");
  const sortSelect = document.getElementById("sort-select");
  const exportBtn = document.getElementById("export-btn");
  const exportTxtBtn = document.getElementById("export-txt-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  const seasonsList = document.getElementById("seasons-input-list");
  const addSeasonBtn = document.getElementById("add-season-field");

  // Sync Language Button
  if (langBtn) {
    langBtn.textContent = `Lang: ${globalLanguage.toUpperCase()}`;
    langBtn.onclick = () => {
      globalLanguage = globalLanguage === "sub" ? "dub" : "sub";
      localStorage.setItem("global-lang", globalLanguage);
      langBtn.textContent = `Lang: ${globalLanguage.toUpperCase()}`;
      renderAnimeList(); // Immediate UI update
    };
  }

  // Listen for local updates
  window.addEventListener("anime-updated", () => {
    myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
    renderAnimeList();
  });

  // --- 4. DATA LOGIC ---
  function updateStatistics() {
    const activeList = currentFilter === -1 ? myAnimeList : myAnimeList.filter(a => a.status === currentFilter);
    let totalAnime = activeList.length;
    let totalEpisodes = 0;
    let completedCount = activeList.filter(a => a.status === 2).length;

    activeList.forEach(anime => {
      anime.seasons.forEach(s => totalEpisodes += (parseInt(s.episodes[0].episodesWatched) || 0));
    });

    document.getElementById("stat-total-anime").textContent = totalAnime;
    document.getElementById("stat-total-episodes").textContent = totalEpisodes;
    document.getElementById("stat-watchtime").textContent = completedCount;
  }

  function applySorting() {
    const sortValue = sortSelect?.value;
    myAnimeList.sort((a, b) => {
      const getPercent = (item) => {
        let watched = 0, total = 0;
        item.seasons?.forEach(s => {
          watched += parseInt(s.episodes[0].episodesWatched) || 0;
          total += parseInt(s.episodes[0].episodesTotal) || 0;
        });
        return total > 0 ? watched / total : 0;
      };

      if (sortValue === "title") return (a.title || "").localeCompare(b.title || "");
      if (sortValue === "status") return a.status - b.status;
      if (sortValue === "progress") return getPercent(b) - getPercent(a);
      if (sortValue === "date-asc") return new Date(a.date) - new Date(b.date);
      if (sortValue === "date-desc") return new Date(b.date) - new Date(a.date);
      return 0;
    });
  }

  function renderAnimeList() {
    applySorting();
    updateStatistics();

    const filteredList = myAnimeList.filter(anime => {
      const matchesFilter = currentFilter === -1 || anime.status === currentFilter;
      const titleSearch = (anime.title || "").toLowerCase();
      const englishSearch = (anime.titleEnglish || "").toLowerCase();
      const matchesSearch = titleSearch.includes(listSearchInput) || englishSearch.includes(listSearchInput);
      return matchesFilter && matchesSearch;
    });

    if (!list) return;
    list.innerHTML = "";

    if (filteredList.length === 0) {
      list.innerHTML = "<li style='justify-content: center; opacity: 0.5;'>No entries found</li>";
      return;
    }

    filteredList.forEach((anime) => {
      const originalIndex = myAnimeList.indexOf(anime);
      let watched = 0, total = 0;
      anime.seasons.forEach(s => {
        watched += (parseInt(s.episodes[0].episodesWatched) || 0);
        total += (parseInt(s.episodes[0].episodesTotal) || 0);
      });

      const percent = total > 0 ? Math.round((watched / total) * 100) : 0;
      const isChecked = selectedItems.includes(originalIndex);
      const coverImg = anime.imageUrl || "https://via.placeholder.com/60x85?text=No+Img";
      
      // Decide title based on Global Toggle vs. Local Override
      let displayTitle = anime.title;
      if (globalLanguage === "dub") displayTitle = anime.titleEnglish || anime.title;
      if (anime.displayEnglish !== undefined) {
          displayTitle = anime.displayEnglish ? (anime.titleEnglish || anime.title) : anime.title;
      }

      list.innerHTML += `
        <li class="fade-in">
          <input type="checkbox" class="select-item" data-index="${originalIndex}" ${isChecked ? 'checked' : ''}>
          <div class="anime-entry-content">
            <img src="${coverImg}" class="list-cover" alt="Cover">
            <div class="anime-info">
              <span class="anime-title" onclick="toggleTitleDisplay(${originalIndex})" style="cursor:pointer; text-decoration: underline dotted;">
                <strong>${displayTitle}</strong>
              </span>
              <span class="status-tag ${statusColors[anime.status]}" onclick="cycleStatus(${originalIndex})" style="cursor:pointer;">
                ${statusNames[anime.status]}
              </span>
              <div class="progress-wrapper">
                <div class="progress-container"><div class="progress-bar" style="--target-width: ${percent}%;"></div></div>
                <span class="episode-progress" onclick="quickUpdateProgress(${originalIndex})" style="cursor:pointer; text-decoration: underline dotted;">
                  ${watched} / ${total} (${percent}%)
                </span>
              </div>
            </div>
          </div>
          <div class="button-group">
            <button data-index="${originalIndex}" class="edit-btn">Edit</button>
            <button data-index="${originalIndex}" class="delete-btn">×</button>
            <button data-index="${originalIndex}" class="minus-btn" style="background:#44475a;">-1</button>
            <button data-index="${originalIndex}" class="plus-btn">+1</button>
          </div>
        </li>`;
    });
  }

  // --- 5. INPUTS ---
  function createSeasonRow(name = "", total = "", watched = "0") {
    const row = document.createElement("div");
    row.className = "season-input-row";
    row.innerHTML = `
      <input type="text" class="s-name" placeholder="Season" value="${name}">
      <input type="number" class="s-total" placeholder="Total" value="${total}">
      <input type="number" class="s-watched" placeholder="Watched" value="${watched}">
      <button type="button" class="remove-season">×</button>
    `;
    row.querySelector(".remove-season").onclick = () => row.remove();
    seasonsList.appendChild(row);
  }

  if (addSeasonBtn) addSeasonBtn.onclick = () => createSeasonRow();

  if (addButton) {
    addButton.onclick = () => {
      const name = addNameInput.value.trim();
      const rows = document.querySelectorAll(".season-input-row");
      if (!name || rows.length === 0) return alert("Required: Name + at least 1 Season");

      const seasonsData = Array.from(rows).map(row => ({
        seasonName: row.querySelector(".s-name").value || "Season",
        episodes: [{
          episodesTotal: parseInt(row.querySelector(".s-total").value) || 0,
          episodesWatched: parseInt(row.querySelector(".s-watched").value) || 0
        }]
      }));

      let tW = 0, tT = 0;
      seasonsData.forEach(s => { tW += s.episodes[0].episodesWatched; tT += s.episodes[0].episodesTotal; });
      let status = tW > 0 ? 1 : 0;
      if (tT > 0 && tW >= tT) status = 2;

      const newAnime = {
        title: name,
        titleEnglish: addNameInput.dataset.titleEnglish || name,
        status: status,
        date: new Date().toISOString(),
        imageUrl: addNameInput.dataset.tempImage || "",
        seasons: seasonsData,
        displayEnglish: globalLanguage === "dub"
      };

      if (editIndex !== -1) {
        myAnimeList[editIndex] = { ...myAnimeList[editIndex], ...newAnime };
      } else {
        myAnimeList.push(newAnime);
      }
      saveAndRefresh();
      resetEditMode();
    };
  }

  // --- 6. INTERACTIONS ---
  if (list) {
    list.addEventListener("click", (e) => {
      const idx = e.target.dataset.index;
      if (!idx) return;
      const anime = myAnimeList[idx];

      if (e.target.classList.contains("plus-btn")) {
        let target = anime.seasons.find(s => s.episodes[0].episodesWatched < s.episodes[0].episodesTotal);
        if (target) target.episodes[0].episodesWatched++;
        else if (anime.seasons[anime.seasons.length - 1].episodes[0].episodesTotal === 0) {
          anime.seasons[anime.seasons.length - 1].episodes[0].episodesWatched++;
        }
        
        let curW = 0, curT = 0;
        anime.seasons.forEach(s => { curW += s.episodes[0].episodesWatched; curT += s.episodes[0].episodesTotal; });
        if (anime.status === 0) anime.status = 1;
        if (curT > 0 && curW >= curT) anime.status = 2;
        saveAndRefresh();
      }

      if (e.target.classList.contains("minus-btn")) {
        for (let i = anime.seasons.length - 1; i >= 0; i--) {
          if (anime.seasons[i].episodes[0].episodesWatched > 0) {
            anime.seasons[i].episodes[0].episodesWatched--;
            if (anime.status === 2) anime.status = 1;
            break;
          }
        }
        saveAndRefresh();
      }

      if (e.target.classList.contains("delete-btn")) {
        if (confirm(`Delete ${anime.title}?`)) { myAnimeList.splice(idx, 1); saveAndRefresh(); }
      }

      if (e.target.classList.contains("edit-btn")) {
        addNameInput.value = anime.title;
        addNameInput.dataset.titleEnglish = anime.titleEnglish || "";
        addNameInput.dataset.tempImage = anime.imageUrl || "";
        editIndex = idx;
        addButton.textContent = "Save Changes";
        cancelButton.style.display = "block";
        seasonsList.innerHTML = "";
        anime.seasons.forEach(s => createSeasonRow(s.seasonName, s.episodes[0].episodesTotal, s.episodes[0].episodesWatched));
        window.scrollTo(0, 0);
      }
    });

    list.addEventListener("change", (e) => {
      if (e.target.classList.contains("select-item")) {
        const idx = parseInt(e.target.dataset.index);
        if (e.target.checked) selectedItems.push(idx);
        else selectedItems = selectedItems.filter(i => i !== idx);
      }
    });
  }

  // --- 7. API AGGREGATOR ---
  async function fetchFromAniList(term) {
    const query = `query ($search: String) { Page(perPage: 5) { media(search: $search, type: ANIME) { title { romaji english } episodes coverImage { large } relations { edges { relationType node { title { romaji english } episodes } } } } } }`;
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { search: term } })
      });
      const json = await response.json();
      return (json.data?.Page?.media || []).map(a => ({
        title: a.title.romaji,
        titleEnglish: a.title.english || a.title.romaji,
        imageUrl: a.coverImage.large,
        episodes: a.episodes || 0,
        sequels: a.relations.edges.filter(e => e.relationType === "SEQUEL").map(e => ({
            name: e.node.title.english || e.node.title.romaji,
            episodes: e.node.episodes || 0
        }))
      }));
    } catch (e) { return []; }
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.trim();
      suggestions.innerHTML = "";
      if (term.length < 3) return;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        let results = [];
        try {
          const resp = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(term)}`);
          const res = await resp.json();
          if (res.data && res.data.length > 0) {
            results = res.data.slice(0, 5).map(a => ({
              title: a.title,
              titleEnglish: a.title_english || a.title,
              imageUrl: a.images.jpg.image_url,
              episodes: a.episodes || 0,
              sequels: [] // Jikan doesn't provide easy relations in simple search
            }));
          } else {
            results = await fetchFromAniList(term);
          }
        } catch (err) {
          results = await fetchFromAniList(term);
        }

        results.forEach(a => {
          const div = document.createElement("div");
          div.className = "suggestion-item";
          const display = globalLanguage === "dub" ? a.titleEnglish : a.title;
          div.innerHTML = `<img src="${a.imageUrl}" class="suggestion-image"><span>${display}</span>`;
          div.onclick = () => {
            addNameInput.value = (globalLanguage === "dub" ? a.titleEnglish : a.title);
            addNameInput.dataset.titleEnglish = a.titleEnglish;
            addNameInput.dataset.tempImage = a.imageUrl;
            seasonsList.innerHTML = "";
            createSeasonRow("Season 1", a.episodes, "0");
            
            // Auto-detect sequels via AniList
            if (a.sequels && a.sequels.length > 0) {
              if (confirm(`Found ${a.sequels.length} sequels. Add them as new seasons?`)) {
                  a.sequels.forEach(seq => createSeasonRow(seq.name, seq.episodes, "0"));
              }
            }
            
            suggestions.innerHTML = "";
            searchInput.value = "";
          };
          suggestions.appendChild(div);
        });
      }, 800);
    });
  }

  // --- 8. UTILS ---
  function saveAndRefresh() { localStorage.setItem("anime-data", JSON.stringify(myAnimeList)); renderAnimeList(); }
  
  function resetEditMode() {
    editIndex = -1;
    addButton.textContent = "Save Anime";
    addNameInput.value = "";
    addNameInput.dataset.titleEnglish = "";
    addNameInput.dataset.tempImage = "";
    seasonsList.innerHTML = "";
    createSeasonRow();
    cancelButton.style.display = "none";
  }

  if (cancelButton) cancelButton.onclick = resetEditMode;
  if (sortSelect) sortSelect.onchange = renderAnimeList;
  if (listSearchInputElement) listSearchInputElement.oninput = (e) => { listSearchInput = e.target.value.toLowerCase(); renderAnimeList(); };

  if (exportBtn) {
    exportBtn.onclick = () => {
      const data = selectedItems.length > 0 ? myAnimeList.filter((_, i) => selectedItems.includes(i)) : myAnimeList;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "anime-list.json";
      a.click();
    };
  }

  if (exportTxtBtn) {
    exportTxtBtn.onclick = () => {
      const listToExport = selectedItems.length > 0 ? myAnimeList.filter((_, i) => selectedItems.includes(i)) : myAnimeList;
      let content = "MY ANIME TRACKER - LIST EXPORT\n================================\n\n";
      listToExport.forEach(anime => {
        let watched = 0, total = 0;
        anime.seasons.forEach(s => { watched += parseInt(s.episodes[0].episodesWatched); total += parseInt(s.episodes[0].episodesTotal); });
        const title = anime.displayEnglish ? (anime.titleEnglish || anime.title) : anime.title;
        content += `[${statusNames[anime.status]}] ${title}\nProgress: ${watched}/${total}\n--------------------------------\n`;
      });
      const blob = new Blob([content], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "anime-list.txt";
      a.click();
    };
  }

  if (importBtn && importFile) {
    importBtn.onclick = () => importFile.click();
    importFile.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (Array.isArray(imported) && confirm("Overwrite current list?")) { myAnimeList = imported; saveAndRefresh(); }
        } catch (err) { alert("Invalid file."); }
      };
      reader.readAsText(file);
    };
  }

  window.setFilter = (f) => {
    currentFilter = f;
    renderAnimeList();
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.toggle("active-filter", Number(btn.dataset.filter) === f));
  };

  resetEditMode();
  renderAnimeList();
});