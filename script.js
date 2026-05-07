if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log("PWA: Service Worker aktiv."))
    .catch((err) => console.log("PWA: Fehler", err));
}

let myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
let currentFilter = -1; // -1 = all, 0 = plan to watch, 1 = watching, 2 = completed, 3 = dropped
let editIndex = -1; // Store the index of the anime being edited, -1 means no anime is being edited
let searchTimer; // Declare a variable to hold the timer for debouncing
let listSearchInput = ""; // Store the current search input value for filtering the anime list
const listSearchInputElement = document.getElementById("list-search-input"); // Get the search input element for filtering the anime list
listSearchInputElement.addEventListener("input", function (event) {
  listSearchInput = event.target.value.toLowerCase(); // Update the search input value and convert it to lowercase for case-insensitive searching
  renderAnimeList(); // Re-render the anime list to apply the search filter
});

// search input and suggestions elements
const searchInput = document.getElementById("name-input");
const suggestions = document.getElementById("suggestions");

// form input elements
const addNameInput = document.getElementById("anime-name"); // Get the name input element to read the anime name
const totalEpisodesInput = document.getElementById("episode-total"); // Get the total episodes input element to read the total number of episodes

// button elements
const addButton = document.getElementById("add-anime"); // Get the add button element to attach event listeners
const list = document.getElementById("anime-list"); // Get the list element to attach event listeners
const cancelButton = document.getElementById("cancel-edit"); // Get the cancel edit button element to attach event listeners
const allButton = document.querySelectorAll(".filter-btn"); // Get all filter buttons to attach event listeners

const statusNames = ["Plan to Watch", "Watching", "Completed", "Dropped"];
const statusColors = [
  "status-plan",
  "status-watching",
  "status-completed",
  "status-dropped",
];

const handleEnter = function (event) {
  if (event.key === "Enter") {
    addButton.click(); // Trigger the click event on the add button when Enter key is pressed
  }
};
searchInput.addEventListener("keypress", handleEnter); // Attach the keypress event listener to the search input field
totalEpisodesInput.addEventListener("keypress", handleEnter); // Attach the keypress event listener to the total episodes input field

// Event listener for handling input in the name search field
searchInput.addEventListener("input", function (event) {
  const searchTerm = event.target.value; // Get the current value of the search input field

  suggestions.innerHTML = ""; // Clear previous suggestions before displaying new ones

  if (searchTerm.trim() === "") {
    clearTimeout(searchTimer); // Clear any existing timer if the search term is empty
    return; // If the search term is empty, do not make an API call
  }
  clearTimeout(searchTimer); // Clear any existing timer to prevent multiple API calls while typing
  
  searchTimer = setTimeout(function () {
    fetchAnimeData(searchTerm).then(function (results) {
      if (!results) return;
      console.log(results); // Log the results from the API to the console for debugging purposes
      
      results.forEach(function (anime) {
      const suggestionItem = document.createElement("div"); // Create a new div element for each suggestion item

      suggestionItem.classList.add("suggestion-item");
      suggestions.appendChild(suggestionItem);

      suggestionItem.dataset.title = anime.title; // Store the anime title in a data attribute for later use when selecting a suggestion
      suggestionItem.dataset.episodes = anime.episodes; // Store the total number of episodes in a data attribute for later use when selecting a suggestion
      
      suggestionItem.innerHTML = `
        <img src="${anime.images.jpg.image_url}" alt="${anime.title} Poster" class="suggestion-image">
        <span class="suggestion-title">${anime.title}</span>
      `;
  }); // Attach the input event listener to the name input field to handle changes in the input value
    });  
}, 500); // Set a debounce timer of 500 milliseconds to limit the number of API calls while typing
});

suggestions.addEventListener("click", function (event) {
    const clickedItem = event.target.closest(".suggestion-item");
    
    if (clickedItem) {
      const selectedTitle = clickedItem.querySelector(".suggestion-title").textContent;
      const selectedEpisodes = parseInt(clickedItem.dataset.episodes);
      addNameInput.value = selectedTitle; // Set the name input field to the selected anime's title
      totalEpisodesInput.value = isNaN(selectedEpisodes) ? "" : selectedEpisodes;

      if (!isNaN(selectedEpisodes)) {
        totalEpisodesInput.value = selectedEpisodes; // Set the total episodes input field to the selected anime's episode count if it's a valid number
      } else {
        totalEpisodesInput.value = ""; // Clear the total episodes input field if the selected anime does not have a valid episode count
      }
      suggestions.innerHTML = ""; // Clear suggestions after selecting an item
      searchInput.value = ""; // Clear the search input field after selecting an item
    }
});

// Event listener for adding a new anime
addButton.addEventListener("click", function () {
  const name = addNameInput.value; // Read the anime name from the input field
  const totalEpisodes = Number(totalEpisodesInput.value); // Read the total number of episodes from the input field and convert it to a number

  if (name === "" || totalEpisodes <= 0 || isNaN(totalEpisodes)) {
    // Basic validation for input fields
    alert("Please enter a valid anime name and total episodes.");
    return;
  }

  if (editIndex !== -1) {
    // If we are in edit mode, update the existing anime instead of creating a new one
    const anime = myAnimeList[editIndex];

    // Ensure the anime has a seasons array and at least one season with episodes
    if (!anime.seasons) {
      anime.seasons = [
        {
          seasonNumber: 1,
          episodes: [
            {
              episodenGesamt: totalEpisodes,
              episodenGesehen: 0
            }
          ]
        }
      ];
    }
    const episodeData = anime.seasons[0].episodes[0];
    anime.titel = name;
    episodeData.episodenGesamt = totalEpisodes;
    

    if (episodeData.episodenGesehen > totalEpisodes) {
      episodeData.episodenGesehen = totalEpisodes; // Adjust the number of episodes watched if it exceeds the new total
    }

    if (episodeData.episodenGesehen === episodeData.episodenGesamt) {
      anime.status = 2; // Change status to "completed" if all episodes are watched
    } else if (episodeData.episodenGesehen > 0) {
      anime.status = 1; // Change status to "watching" if some episodes are watched
    } else {
      anime.status = 0; // Change status to "plan to watch" if no episodes are watched
    }
  } else {
    // Create a new anime object and add it to the list
    const newAnime = {
      titel: name,
      status: 0, // 0 = "plan to watch", 1 = "watching", 2 = "completed", 3 = "dropped"
      date: new Date().toISOString(), // Store the date when the anime was added
      seasons: [
        {
          seasonNumber: 1, // Default season number, can be extended to support multiple seasons in the future
          episodes: [
            {
              episodenGesamt: totalEpisodes, // Total number of episodes for the anime
              episodenGesehen: 0, // Number of episodes watched, initialized to 0
            }
          ],
        },
      ],

      
    };
    myAnimeList.push(newAnime); // Add the new anime to the list
  }

  saveAnimeList(); // Save the updated anime list to localStorage
  renderAnimeList(); // Re-render the anime list to reflect changes
  resetEditMode(); // Reset the edit mode and clear input fields after adding or editing an anime
});

// Event listener for handling the "+1 Episode" button clicks
list.addEventListener("click", function (event) {
  const index = event.target.dataset.index; // Get the index of the anime from the data attribute of the clicked button
  const anime = myAnimeList[index]; // Get the anime object from the list using the index

  if (index === undefined || !anime) {
    return; // If the index is not valid or the anime does not exist, exit the function
  }

  // Check if the clicked element is a "+1 Episode" button
  if (event.target.classList.contains("plus-btn")) {
    const currentSeason = anime.seasons.find(season => {
      const episode = season.episodes[0]; 
      return episode.episodenGesehen < episode.episodenGesamt; // Find the first season that has unwatched episodes
    }); // Find the current season that has unwatched episodes

    if (currentSeason) {
      currentSeason.episodes[0].episodenGesehen++; // Increment the number of episodes watched for the current season

      if (anime.status === 0) {
        anime.status = 1; // Change status to "watching" if it was "plan to watch"
      }

      let totalWatched = 0; // Initialize a variable to keep track of the total number of episodes watched
      let totalEpisodes = 0; // Initialize a variable to keep track of the total number of episodes in the list

      anime.seasons.forEach(function (season) {
        season.episodes.forEach(function (episode) {
          totalWatched += episode.episodenGesehen; // Add the number of episodes watched for each episode to the total watched count
          totalEpisodes += episode.episodenGesamt; // Add the total number of episodes for each episode to the total episodes count
        });
      });

      if (totalWatched === totalEpisodes) {
        anime.status = 2; // Change status to "completed" if all episodes are watched
      }
    }
  }

  // Check if the clicked element is a "Delete" button
  if (event.target.classList.contains("delete-btn")) {
    // Confirm deletion with the user
    if (
      confirm(`You sure you want to delete "${anime.titel}" from your list?`)
    ) {
      myAnimeList.splice(Number(index), 1); // Remove the anime from the list using the index
    }
  }

  // Check if the clicked element is a "Drop" button
  if (event.target.classList.contains("drop-btn")) {
    if (confirm(`You sure you want to drop "${anime.titel}" from your list?`)) {
      anime.status = 3; // Change status to "dropped"
    }
  }

  // Check if the clicked element is an "Edit" button
  if (event.target.classList.contains("edit-btn")) {
    addNameInput.value = anime.titel; // Pre-fill the name input with the current anime title
    totalEpisodesInput.value = anime.seasons[0].episodes[0].episodenGesamt; // Pre-fill the total episodes input with the current total episodes

    editIndex = index; // Store the index of the anime being edited
    addButton.textContent = "Save Changes"; // Change the button text to indicate editing mode

    cancelButton.style.display = "inline-block"; // Show the cancel button when in edit mode
  }
  saveAnimeList(); // Save the updated anime list to localStorage after handling the button click
  renderAnimeList(); // Re-render the anime list to reflect changes after handling the button click
});

cancelButton.addEventListener("click", function (event) {
  resetEditMode(); // Reset the edit mode and clear input fields
});



// ========================= Helper Functions =========================

// Helper function to apply the current sorting order to the anime list
function applySorting() {
  const sortSelect = document.getElementById("sort-select"); // Get the sort select element to attach event listeners
  const sortValue = sortSelect.value; // Get the current value of the sort select element

  sortSelect.addEventListener("change", function () {
    renderAnimeList(); // Re-render the anime list when the sorting order is changed
  });
  
  if (sortValue === "title") {
    myAnimeList.sort((a, b) => a.titel.localeCompare(b.titel)); // Sort the anime list alphabetically by title
  } else if (sortValue === "status") {
    myAnimeList.sort((a, b) => a.status - b.status); // Sort the anime list by status
  } else if (sortValue === "date-asc") {
    myAnimeList.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (sortValue === "date-desc") {
    myAnimeList.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

// Helper function to render the anime list on the page
function renderAnimeList() {
  applySorting(); // Apply the current sorting order before rendering the list
  
  const list = document.getElementById("anime-list");
  const filteredList = myAnimeList.filter(function (anime) {
    // 1. Check Filter (Status muss Filter entsprechen oder Filter ist "all")
    const matchesFilter = currentFilter === -1 || anime.status === currentFilter;
    // 2. Check Search (Titel muss Suchbegriff enthalten, Suche ist nicht case-sensitive)
    const matchesSearch = anime.titel.toLowerCase().includes(listSearchInput);
    
    return matchesFilter && matchesSearch;
});

  list.innerHTML = ""; // Clear the list before rendering
  if (filteredList.length === 0) {
    list.innerHTML = "<li>No animes found in this category</li>";
  } else {
    filteredList.forEach(function (anime) {
      const originalIndex = myAnimeList.indexOf(anime); // Get the original index of the anime in the list
      let totalWatched = 0; // Initialize a variable to keep track of the total number of episodes watched
      let totalEpisodes = 0; // Initialize a variable to keep track of the total number of episodes in the list

      anime.seasons.forEach(function (season) {
        season.episodes.forEach(function (episode) {
          totalWatched += episode.episodenGesehen; // Add the number of episodes watched for each episode to the total watched count
          totalEpisodes += episode.episodenGesamt; // Add the total number of episodes for each episode to the total episodes count
        });
      });

      const percent = totalEpisodes > 0 ? Math.round((totalWatched / totalEpisodes) * 100) : 0; // Calculate the percentage of episodes watched, handling division by zero

      list.innerHTML += `
            <li>
            <div class="anime-info">
            <span class="anime-title"><strong>${anime.titel}:</strong></span>
            <span class="status-tag ${statusColors[anime.status]}">${statusNames[anime.status]}</span>
            <span class="episode-progress">${totalWatched} / ${totalEpisodes} (${percent}%)</span>
            </div>

            <div class="button-group">
            <button data-index="${originalIndex}" class="delete-btn">Delete</button>
            <button data-index="${originalIndex}" class="edit-btn">Edit</button>

            ${
              anime.status !== 2 && anime.status !== 3
                ? `<button data-index="${originalIndex}" class="drop-btn">Drop</button>
                   <button data-index="${originalIndex}" class="plus-btn">+1 Episode</button>`
                : ""
            }
            </div>
        </li>`;
    });
  }
  allButton.forEach(function (button) {
    // Loop through all filter buttons to update their active state
    if (Number(button.dataset.filter) === currentFilter) {
      button.classList.add("active-filter"); // Add active class to the currently selected filter button
    } else {
      button.classList.remove("active-filter"); // Remove active class from other filter buttons
    }
  });
}
// helper function to save the anime list to localStorage
function saveAnimeList() {
  const data = JSON.stringify(myAnimeList);
  localStorage.setItem("anime-data", data);
}

// Helper function to set the current filter and re-render the anime list
function setFilter(filter) {
  currentFilter = filter;
  renderAnimeList();
}

// Helper function to reset the edit mode and clear input fields
function resetEditMode() {
  editIndex = -1;
  addButton.textContent = "Add Anime";
  addNameInput.value = "";
  totalEpisodesInput.value = "";
  cancelButton.style.display = "none"; // Hide the cancel button when not in edit mode
}

// Initial rendering of the anime list when the page loads
renderAnimeList();

async function fetchAnimeData(name) {
  
  const url = `https://api.jikan.moe/v4/anime?q=${name}`; // Replace with the actual API endpoint and query parameters

  try {
    const response = await fetch(url); // Make the API request
    const result = await response.json(); // Parse the response as JSON

    return result.data; // Return the relevant data from the API response

  } catch (error) {
    console.error("Error fetching anime data:", error); // Log any errors that occur during the fetch operation
  }
}
