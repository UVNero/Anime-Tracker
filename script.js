let myAnimeList = JSON.parse(localStorage.getItem("anime-data")) || [];
let currentFilter = -1; // -1 = all, 0 = plan to watch, 1 = watching, 2 = completed, 3 = dropped
let editIndex = -1; // Store the index of the anime being edited, -1 means no anime is being edited
const list = document.getElementById("anime-list"); // Get the list element to attach event listeners
const addButton = document.getElementById("add-anime"); // Get the add button element to attach event listeners
const allButton = document.querySelectorAll(".filter-btn"); // Get all filter buttons to attach event listeners
const nameInput = document.getElementById("anime-name"); // Get the name input element to read the anime name
const totalEpisodesInput = document.getElementById("episode-total"); // Get the total episodes input element to read the total number of episodes
const statusNames = ["Plan to Watch", "Watching", "Completed", "Dropped"];
const cancelButton = document.getElementById("cancel-edit"); // Get the cancel edit button element to attach event listeners
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
nameInput.addEventListener("keypress", handleEnter); // Attach the keypress event listener to the name input field
totalEpisodesInput.addEventListener("keypress", handleEnter); // Attach the keypress event listener to the total episodes input field

// Event listener for adding a new anime
addButton.addEventListener("click", function () {
  const name = nameInput.value; // Read the anime name from the input field
  const totalEpisodes = Number(totalEpisodesInput.value); // Read the total number of episodes from the input field and convert it to a number

  if (name === "" || totalEpisodes <= 0 || isNaN(totalEpisodes)) {
    // Basic validation for input fields
    alert("Please enter a valid anime name and total episodes.");
    return;
  }

  if (editIndex !== -1) {
    // If we are in edit mode, update the existing anime instead of creating a new one
    const anime = myAnimeList[editIndex];
    anime.titel = name;
    anime.episodenGesamt = totalEpisodes;

    if (anime.episodenGesehen === anime.episodenGesamt) {
      anime.status = 2; // Change status to "completed" if all episodes are watched
    } else if (anime.episodenGesehen > 0) {
      anime.status = 1; // Change status to "watching" if some episodes are watched
    } else {
      anime.status = 0; // Change status to "plan to watch" if no episodes are watched
    }
  } else {
    // Create a new anime object and add it to the list
    const newAnime = {
      titel: name,
      episodenGesehen: 0,
      episodenGesamt: totalEpisodes,
      status: 0, // 0 = "plan to watch", 1 = "watching", 2 = "completed", 3 = "dropped"
      date: new Date().toISOString(), // Store the date when the anime was added
    };
    myAnimeList.push(newAnime); // Add the new anime to the list
  }

  resetEditMode(); // Reset the edit mode and clear input fields
  saveAnimeList(); // Save the updated anime list to localStorage
  renderAnimeList(); // Re-render the anime list to reflect changes
});

// Event listener for handling the "+1 Episode" button clicks
list.addEventListener("click", function (event) {
  const index = event.target.dataset.index; // Get the index of the anime from the button's data attribute
  const anime = myAnimeList[index];

  if (!index || !anime) {
    return; // If the index is not valid or the anime does not exist, exit the function
  }

  // Check if the clicked element is a "+1 Episode" button
  if (event.target.classList.contains("plus-btn")) {
    // Check if the anime has not already been completed
    if (anime.episodenGesehen < anime.episodenGesamt) {
      anime.episodenGesehen++; // Increment the number of episodes watched

      if (anime.status === 0) {
        anime.status = 1; // Change status to "watching" if it was "plan to watch"
      }

      if (anime.episodenGesehen === anime.episodenGesamt) {
        anime.status = 2; // Change status to "completed" if all episodes are watched
      }
    }
    saveAnimeList();
    renderAnimeList();
  }
  // Check if the clicked element is a "Delete" button
  if (event.target.classList.contains("delete-btn")) {
    // Confirm deletion with the user
    if (
      confirm(`You sure you want to delete "${anime.titel}" from your list?`)
    ) {
      myAnimeList.splice(Number(index), 1); // Remove the anime from the list using the index
      saveAnimeList();
      renderAnimeList();
    }
  }
  // Check if the clicked element is a "Drop" button
  if (event.target.classList.contains("drop-btn")) {
    const index = event.target.dataset.index;
    const anime = myAnimeList[index];

    if (confirm(`You sure you want to drop "${anime.titel}" from your list?`)) {
      anime.status = 3; // Change status to "dropped"
      saveAnimeList();
      renderAnimeList();
    }
  }

  // Check if the clicked element is an "Edit" button
  if (event.target.classList.contains("edit-btn")) {
    const index = event.target.dataset.index;
    const anime = myAnimeList[index];

    nameInput.value = anime.titel; // Pre-fill the name input with the current anime title
    totalEpisodesInput.value = anime.episodenGesamt; // Pre-fill the total episodes input with the current total episodes

    editIndex = index; // Store the index of the anime being edited
    addButton.textContent = "Save Changes"; // Change the button text to indicate editing mode

    cancelButton.style.display = "inline-block"; // Show the cancel button when in edit mode
  }
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
    return currentFilter === -1 || anime.status === currentFilter; // Filter the anime list based on the current filter
  });
  list.innerHTML = ""; // Clear the list before rendering
  if (filteredList.length === 0) {
    list.innerHTML = "<li>No animes found in this category</li>";
  } else {
    filteredList.forEach(function (anime) {
      const originalIndex = myAnimeList.indexOf(anime); // Get the original index of the anime in the list
      list.innerHTML += `
            <li>
            <div class="anime-info">
            <span class="anime-title"><strong>${anime.titel}:</strong></span>
            <span class="status-tag ${statusColors[anime.status]}">${statusNames[anime.status]}</span>
            <span class="episode-progress">(${anime.episodenGesehen}/${anime.episodenGesamt})</span>
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
  nameInput.value = "";
  totalEpisodesInput.value = "";
  cancelButton.style.display = "none"; // Hide the cancel button when not in edit mode
}

// Initial rendering of the anime list when the page loads
renderAnimeList();
