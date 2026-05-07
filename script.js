// Register Service Worker for PWA functionality
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(() => console.log("PWA: Active."))
    .catch((err) => console.log("PWA: Error", err));
}

document.addEventListener("DOMContentLoaded", function () {
  let myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
  let currentFilter = -1;
  let editIndex = -1;
  let searchTimer;
  let listSearchInput = "";

  const statusNames = ["Plan to Watch", "Watching", "Completed", "Dropped"];
  const statusColors = [
    "status-plan",
    "status-watching",
    "status-completed",
    "status-dropped"
  ];

  // DOM Elements
  const listSearchInputElement = document.getElementById("list-search-input");
  const searchInput = document.getElementById("name-input");
  const suggestions = document.getElementById("suggestions");
  const addNameInput = document.getElementById("anime-name");
  const addButton = document.getElementById("add-anime");
  const list = document.getElementById("anime-list");
  const cancelButton = document.getElementById("cancel-edit");
  const sortSelect = document.getElementById("sort-select");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");

  // Multi-Season Selectors
  const seasonsList = document.getElementById("seasons-input-list");
  const addSeasonBtn = document.getElementById("add-season-field");

  // --- 1. SEARCH LOGIC ---
  if (listSearchInputElement) {
    listSearchInputElement.addEventListener("input", (e) => {
      listSearchInput = e.target.value.toLowerCase();
      renderAnimeList();
    });
  }

  // --- 2. STATISTICS ---
  function updateStatistics() {
    let totalAnime = myAnimeList.length;
    let totalEpisodes = 0;

    myAnimeList.forEach((anime) => {
      if (anime.seasons) {
        anime.seasons.forEach((s) => {
          s.episodes.forEach((e) => (totalEpisodes += e.episodesWatched));
        });
      }
    });

    document.getElementById("stat-total-anime").textContent = totalAnime;
    document.getElementById("stat-total-episodes").textContent = totalEpisodes;

    const completedCount = myAnimeList.filter((a) => a.status === 2).length;
    document.getElementById("stat-watchtime").textContent = completedCount;

    const watchtimeLabel = document.querySelector("#stat-watchtime + .stat-label");
    if (watchtimeLabel) watchtimeLabel.textContent = "Completed";
  }

  // --- 3. SORTING ---
  function applySorting() {
    if (!sortSelect) return;
    const sortValue = sortSelect.value;

    myAnimeList.sort((a, b) => {
      const getPercent = (item) => {
        let watched = 0, total = 0;
        item.seasons?.forEach((s) =>
          s.episodes.forEach((e) => {
            watched += e.episodesWatched;
            total += e.episodesTotal;
          })
        );
        return total > 0 ? watched / total : 0;
      };

      if (sortValue === "title") return a.title.localeCompare(b.title);
      if (sortValue === "status") return a.status - b.status;
      if (sortValue === "progress") return getPercent(b) - getPercent(a);
      if (sortValue === "date-asc") return new Date(a.date) - new Date(b.date);
      if (sortValue === "date-desc") return new Date(b.date) - new Date(a.date);
    });
  }

  // --- 4. CORE RENDER LOGIC ---
  function renderAnimeList() {
    applySorting();
    updateStatistics();

    const filteredList = myAnimeList.filter((anime) => {
      const matchesFilter = currentFilter === -1 || anime.status === currentFilter;
      const matchesSearch = anime.title.toLowerCase().includes(listSearchInput);
      return matchesFilter && matchesSearch;
    });

    if (!list) return;
    list.innerHTML = "";

    if (filteredList.length === 0) {
      list.innerHTML = "<li style='justify-content: center; opacity: 0.5;'>No entries found</li>";
    } else {
      filteredList.forEach((anime) => {
        const originalIndex = myAnimeList.indexOf(anime);
        let watched = 0, total = 0;

        // Aggregate across all seasons
        anime.seasons.forEach((s) => {
          s.episodes.forEach((e) => {
            watched += e.episodesWatched || 0;
            total += e.episodesTotal || 0;
          });
        });

        const percent = total > 0 ? Math.round((watched / total) * 100) : 0;

        list.innerHTML += `
          <li class="fade-in">
            <div class="anime-entry-content">
              <img src="${anime.imageUrl || "placeholder.png"}" class="list-cover" alt="Cover">
              <div class="anime-info">
                <span class="anime-title"><strong>${anime.title}</strong></span>
                <span class="status-tag ${statusColors[anime.status]}">${statusNames[anime.status]}</span>
                <div class="progress-wrapper">
                  <div class="progress-container">
                    <div class="progress-bar" style="--target-width: ${percent}%;"></div>
                  </div>
                  <span class="episode-progress">${watched} / ${total} (${percent}%)</span>
                </div>
              </div>
            </div>
            <div class="button-group">
              <button data-index="${originalIndex}" class="edit-btn">Edit</button>
              <button data-index="${originalIndex}" class="delete-btn">×</button>
              ${anime.status < 2 ? `<button data-index="${originalIndex}" class="plus-btn">+1</button>` : ""}
            </div>
          </li>`;
      });
    }
  }

  // --- 5. MULTI-SEASON MECHANICS ---
  function createSeasonRow(name = "", total = "") {
    const row = document.createElement("div");
    row.className = "season-input-row";
    row.innerHTML = `
      <input type="text" class="s-name" placeholder="Season (e.g. S1)" value="${name}">
      <input type="number" class="s-total" placeholder="Episodes" value="${total}">
      <button type="button" class="remove-season">×</button>
    `;
    row.querySelector(".remove-season").onclick = () => row.remove();
    seasonsList.appendChild(row);
  }

  if (addSeasonBtn) addSeasonBtn.onclick = () => createSeasonRow();

  if (addButton) {
    addButton.onclick = () => {
      const name = addNameInput.value.trim();
      const seasonRows = document.querySelectorAll(".season-input-row");

      if (!name || seasonRows.length === 0) return alert("Name and at least one season required");

      const seasonsData = Array.from(seasonRows).map((row) => ({
        seasonName: row.querySelector(".s-name").value || "Season",
        episodes: [{
          episodesTotal: parseInt(row.querySelector(".s-total").value) || 0,
          episodesWatched: 0
        }]
      }));

      if (editIndex !== -1) {
        // Preserve watched episodes during edit
        seasonsData.forEach((newS, i) => {
          if (myAnimeList[editIndex].seasons[i]) {
            newS.episodes[0].episodesWatched = myAnimeList[editIndex].seasons[i].episodes[0].episodesWatched;
          }
        });
        myAnimeList[editIndex].title = name;
        myAnimeList[editIndex].seasons = seasonsData;
      } else {
        myAnimeList.push({
          title: name,
          status: 0,
          date: new Date().toISOString(),
          imageUrl: addNameInput.dataset.tempImage || "",
          seasons: seasonsData
        });
      }
      saveAndRefresh();
      resetEditMode();
    };
  }

  // --- 6. ACTION LISTENERS (LIST INTERACTIONS) ---
  if (list) {
    list.addEventListener("click", (e) => {
      const idx = e.target.dataset.index;
      if (!idx) return;
      const anime = myAnimeList[idx];

      // Smart +1 Logic
      if (e.target.classList.contains("plus-btn")) {
        // Find the first unfinished season
        let targetSeason = anime.seasons.find(s => s.episodes[0].episodesWatched < s.episodes[0].episodesTotal);

        // If found, increment. Otherwise, check if totals are 0 (endless) and increment last.
        if (targetSeason) {
          targetSeason.episodes[0].episodesWatched++;
        } else {
          let lastSeason = anime.seasons[anime.seasons.length - 1];
          if (lastSeason.episodes[0].episodesTotal === 0) {
            lastSeason.episodes[0].episodesWatched++;
          }
        }

        // Global status check
        let totalWatched = 0, totalEps = 0;
        anime.seasons.forEach(s => {
          totalWatched += s.episodes[0].episodesWatched;
          totalEps += s.episodes[0].episodesTotal;
        });

        if (anime.status === 0) anime.status = 1;
        if (totalEps > 0 && totalWatched >= totalEps) anime.status = 2;

        saveAndRefresh();
      }

      // Delete Logic
      if (e.target.classList.contains("delete-btn")) {
        if (confirm(`Delete ${anime.title}?`)) {
          const listItem = e.target.closest("li");
          listItem.style.opacity = "0";
          listItem.style.transform = "scale(0.9)";
          setTimeout(() => {
            myAnimeList.splice(idx, 1);
            saveAndRefresh();
          }, 200);
        }
      }

      // Edit Logic
      if (e.target.classList.contains("edit-btn")) {
        addNameInput.value = anime.title;
        editIndex = idx;
        addButton.textContent = "Save Changes";
        cancelButton.style.display = "block";

        seasonsList.innerHTML = "";
        anime.seasons.forEach(s => createSeasonRow(s.seasonName, s.episodes[0].episodesTotal));

        window.scrollTo(0, 0);
      }
    });
  }

  // --- 7. UTILS & API ---
  const handleEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (addButton) addButton.click();
    }
  };
  if (addNameInput) addNameInput.addEventListener("keydown", handleEnter);
  if (searchInput) searchInput.addEventListener("keydown", handleEnter);

  if (sortSelect) sortSelect.addEventListener("change", renderAnimeList);

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(myAnimeList, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "anime-list-backup.json";
      a.click();
    });
  }

  function saveAndRefresh() {
    localStorage.setItem("anime-data", JSON.stringify(myAnimeList));
    renderAnimeList();
  }

  window.setFilter = function (f) {
    currentFilter = f;
    renderAnimeList();
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      if (Number(btn.dataset.filter) === f) btn.classList.add("active-filter");
      else btn.classList.remove("active-filter");
    });
  };

  function resetEditMode() {
    editIndex = -1;
    if (addButton) addButton.textContent = "Save Anime";
    if (addNameInput) {
      addNameInput.value = "";
      addNameInput.dataset.tempImage = "";
    }
    if (cancelButton) cancelButton.style.display = "none";
    if (seasonsList) {
      seasonsList.innerHTML = "";
      createSeasonRow(); // Reset to one empty row
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", function (event) {
      const searchTerm = event.target.value;
      if (!suggestions) return;
      suggestions.innerHTML = "";
      if (searchTerm.trim() === "") {
        clearTimeout(searchTimer);
        return;
      }
      clearTimeout(searchTimer);

      searchTimer = setTimeout(async function () {
        const url = `https://api.jikan.moe/v4/anime?q=${searchTerm}`;
        try {
          const response = await fetch(url);
          const result = await response.json();
          if (!result.data) return;

          result.data.forEach(function (anime) {
            const suggestionItem = document.createElement("div");
            suggestionItem.classList.add("suggestion-item");
            suggestionItem.dataset.title = anime.title;
            suggestionItem.dataset.episodes = anime.episodes;
            suggestionItem.innerHTML = `
              <img src="${anime.images.jpg.image_url}" class="suggestion-image">
              <span class="suggestion-title">${anime.title}</span>`;
            suggestions.appendChild(suggestionItem);
          });
        } catch (error) {
          console.error("Error fetching anime data:", error);
        }
      }, 500);
    });
  }

  if (suggestions) {
    suggestions.addEventListener("click", function (event) {
      const clickedItem = event.target.closest(".suggestion-item");
      if (clickedItem) {
        const selectedTitle = clickedItem.querySelector(".suggestion-title").textContent;
        const selectedEpisodes = parseInt(clickedItem.dataset.episodes);
        const selectedImage = clickedItem.querySelector(".suggestion-image").src;

        addNameInput.value = selectedTitle;
        addNameInput.dataset.tempImage = selectedImage;

        // Auto-fill season data
        seasonsList.innerHTML = "";
        createSeasonRow("Season 1", isNaN(selectedEpisodes) ? "" : selectedEpisodes);

        suggestions.innerHTML = "";
        searchInput.value = "";
      }
    });
  }

  if (cancelButton) cancelButton.addEventListener("click", resetEditMode);

  // Initialize
  resetEditMode(); // Ensures clean start state
  renderAnimeList();
});