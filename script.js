// Register Service Worker for PWA functionality
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => console.log("PWA: Active."))
    .catch((err) => console.log("PWA: Error", err));
}

document.addEventListener("DOMContentLoaded", function() {

    let myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
    let currentFilter = -1; 
    let editIndex = -1; 
    let searchTimer; 
    let listSearchInput = ""; 

    const statusNames = ["Plan to Watch", "Watching", "Completed", "Dropped"];
    const statusColors = ["status-plan", "status-watching", "status-completed", "status-dropped"];

    // DOM Elements
    const listSearchInputElement = document.getElementById("list-search-input");
    const searchInput = document.getElementById("name-input");
    const suggestions = document.getElementById("suggestions");
    const addNameInput = document.getElementById("anime-name");
    const totalEpisodesInput = document.getElementById("episode-total");
    const addButton = document.getElementById("add-anime");
    const list = document.getElementById("anime-list");
    const cancelButton = document.getElementById("cancel-edit");
    const sortSelect = document.getElementById("sort-select");
    const exportBtn = document.getElementById("export-btn");
    const importBtn = document.getElementById("import-btn");
    const importFile = document.getElementById("import-file");

    //
    if (listSearchInputElement) {
        listSearchInputElement.addEventListener("input", (e) => {
            listSearchInput = e.target.value.toLowerCase();
            renderAnimeList();
        });
    }

    //
    function updateStatistics() {
        let totalAnime = myAnimeList.length;
        let totalEpisodes = 0;

        myAnimeList.forEach(anime => {
            if (anime.seasons) {
                anime.seasons.forEach(s => {
                    s.episodes.forEach(e => totalEpisodes += e.episodesWatched);
                });
            }
        });

        document.getElementById("stat-total-anime").textContent = totalAnime;
        document.getElementById("stat-total-episodes").textContent = totalEpisodes;
        
        const completedCount = myAnimeList.filter(a => a.status === 2).length;
        document.getElementById("stat-watchtime").textContent = completedCount;
        
        // Safety check in case the DOM is still building
        const watchtimeLabel = document.querySelector("#stat-watchtime + .stat-label");
        if(watchtimeLabel) watchtimeLabel.textContent = "Completed";
    }

    function applySorting() {
        if(!sortSelect) return;
        const sortValue = sortSelect.value;

        myAnimeList.sort((a, b) => {
            const getPercent = (item) => {
                let watched = 0, total = 0;
                item.seasons?.forEach(s => s.episodes.forEach(e => {
                    watched += e.episodesWatched;
                    total += e.episodesTotal;
                }));
                return total > 0 ? (watched / total) : 0;
            };

            if (sortValue === "title") return a.title.localeCompare(b.title);
            if (sortValue === "status") return a.status - b.status;
            if (sortValue === "progress") return getPercent(b) - getPercent(a);
            if (sortValue === "date-asc") return new Date(a.date) - new Date(b.date);
            if (sortValue === "date-desc") return new Date(b.date) - new Date(a.date);
        });
    }

    function renderAnimeList() {
        applySorting();
        updateStatistics();

        const filteredList = myAnimeList.filter(anime => {
            const matchesFilter = currentFilter === -1 || anime.status === currentFilter;
            const matchesSearch = anime.title.toLowerCase().includes(listSearchInput);
            return matchesFilter && matchesSearch;
        });

        if(!list) return;
        list.innerHTML = "";
        
        if (filteredList.length === 0) {
            list.innerHTML = "<li style='justify-content: center; opacity: 0.5;'>No entries found</li>";
        } else {
            filteredList.forEach(anime => {
                const originalIndex = myAnimeList.indexOf(anime);
                let watched = 0, total = 0;
                
                anime.seasons.forEach(s => s.episodes.forEach(e => {
                    watched += e.episodesWatched;
                    total += e.episodesTotal;
                }));
                const percent = total > 0 ? Math.round((watched / total) * 100) : 0;

                list.innerHTML += `
                    <li>
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
                        <div class="button-group">
                            <button data-index="${originalIndex}" class="edit-btn">Edit</button>
                            <button data-index="${originalIndex}" class="delete-btn">×</button>
                            ${anime.status < 2 ? `<button data-index="${originalIndex}" class="plus-btn">+1</button>` : ""}
                        </div>
                    </li>`;
            });
        }
    }


    if(addButton) {
        addButton.addEventListener("click", () => {
            const name = addNameInput.value.trim();
            const total = parseInt(totalEpisodesInput.value);

            if (!name || isNaN(total) || total <= 0) return alert("Valid data required");

            if (editIndex !== -1) {
                myAnimeList[editIndex].title = name;
                myAnimeList[editIndex].seasons[0].episodes[0].episodesTotal = total;
            } else {
                myAnimeList.push({
                    title: name, status: 0, date: new Date().toISOString(),
                    seasons: [{ episodes: [{ episodesTotal: total, episodesWatched: 0 }] }]
                });
            }
            saveAndRefresh();
            resetEditMode();
        });
    }

    const handleEnter = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (addButton) addButton.click();
        }
      };
      if (addNameInput) addNameInput.addEventListener("keydown", handleEnter);
      if (totalEpisodesInput) totalEpisodesInput.addEventListener("keydown", handleEnter);
      if (searchInput) searchInput.addEventListener("keydown", handleEnter);
      
    if(list) {
        list.addEventListener("click", (e) => {
            const idx = e.target.dataset.index;
            if (!idx) return;
            const anime = myAnimeList[idx];

            if (e.target.classList.contains("plus-btn")) {
                const ep = anime.seasons[0].episodes[0];
                if (ep.episodesWatched < ep.episodesTotal) {
                    ep.episodesWatched++;
                    if (anime.status === 0) anime.status = 1;
                    if (ep.episodesWatched === ep.episodesTotal) anime.status = 2;
                    saveAndRefresh();
                }
            }

            if (e.target.classList.contains("delete-btn")) {
                if (confirm(`Delete ${anime.title}?`)) {
                    myAnimeList.splice(idx, 1);
                    saveAndRefresh();
                }
            }

            if (e.target.classList.contains("edit-btn")) {
                addNameInput.value = anime.title;
                totalEpisodesInput.value = anime.seasons[0].episodes[0].episodesTotal;
                editIndex = idx;
                addButton.textContent = "Save";
                cancelButton.style.display = "block";
                window.scrollTo(0,0);
            }
        });
    }

    if(sortSelect) sortSelect.addEventListener("change", renderAnimeList);
    
    if(exportBtn) {
        exportBtn.addEventListener("click", () => {
            const blob = new Blob([JSON.stringify(myAnimeList, null, 2)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "anime-list-backup.json"; a.click();
        });
    }

    function saveAndRefresh() {
        localStorage.setItem("anime-data", JSON.stringify(myAnimeList));
        renderAnimeList();
    }


    window.setFilter = function(f) { 
        currentFilter = f; 
        renderAnimeList(); 
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if(Number(btn.dataset.filter) === f) btn.classList.add('active-filter');
            else btn.classList.remove('active-filter');
        });
    };

    function resetEditMode() { 
        editIndex = -1; 
        if(addButton) addButton.textContent = "Add"; 
        if(addNameInput) addNameInput.value = ""; 
        if(totalEpisodesInput) totalEpisodesInput.value = ""; 
        if(cancelButton) cancelButton.style.display = "none"; 
    }


    if(searchInput) {
        searchInput.addEventListener("input", function (event) {
            const searchTerm = event.target.value;
            if(!suggestions) return;
            suggestions.innerHTML = "";
            if (searchTerm.trim() === "") { clearTimeout(searchTimer); return; }
            clearTimeout(searchTimer);

            searchTimer = setTimeout(async function () {
                const url = `https://api.jikan.moe/v4/anime?q=${searchTerm}`;
                try {
                    const response = await fetch(url);
                    const result = await response.json();
                    if(!result.data) return;
                    
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
                } catch (error) { console.error("Error fetching anime:", error); }
            }, 500);
        });
    }

    if(suggestions) {
        suggestions.addEventListener("click", function (event) {
            const clickedItem = event.target.closest(".suggestion-item");
            if (clickedItem) {
                const selectedTitle = clickedItem.querySelector(".suggestion-title").textContent;
                const selectedEpisodes = parseInt(clickedItem.dataset.episodes);
                addNameInput.value = selectedTitle;
                totalEpisodesInput.value = isNaN(selectedEpisodes) ? "" : selectedEpisodes;
                suggestions.innerHTML = "";
                searchInput.value = "";
            }
        });
    }

    // Cancel Edit Button Listener
    if(cancelButton) {
        cancelButton.addEventListener("click", resetEditMode);
    }

    // Start
    renderAnimeList();
});