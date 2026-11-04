document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const authStatus = document.getElementById("auth-status");
  const adminContainer = document.getElementById("admin-container");
  const createActivityForm = document.getElementById("create-activity-form");
  const updateActivityForm = document.getElementById("update-activity-form");
  const deleteActivityForm = document.getElementById("delete-activity-form");
  const updateActivitySelect = document.getElementById("update-activity");
  const deleteActivitySelect = document.getElementById("delete-activity");
  const updateDescriptionInput = document.getElementById("update-description");
  const updateScheduleInput = document.getElementById("update-schedule");
  const updateMaxInput = document.getElementById("update-max");

  let authState = {
    token: localStorage.getItem("authToken"),
    role: localStorage.getItem("authRole"),
    username: localStorage.getItem("authUsername"),
  };
  let activitiesCache = {};

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  async function apiFetch(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };
    if (authState.token) {
      headers.Authorization = `Bearer ${authState.token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  function renderAuthState() {
    const isLoggedIn = Boolean(authState.token);
    const isStudent = authState.role === "student";
    const isAdmin = authState.role === "admin";

    authStatus.textContent = isLoggedIn
      ? `Signed in as ${authState.username} (${authState.role})`
      : "Not signed in";
    logoutBtn.classList.toggle("hidden", !isLoggedIn);
    signupForm.classList.toggle("hidden", !isStudent);
    adminContainer.classList.toggle("hidden", !isAdmin);
  }

  function clearAuth() {
    authState = { token: null, role: null, username: null };
    localStorage.removeItem("authToken");
    localStorage.removeItem("authRole");
    localStorage.removeItem("authUsername");
    renderAuthState();
  }

  function populateActivitySelects(activities) {
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
    updateActivitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
    deleteActivitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

    Object.keys(activities).forEach((name) => {
      const optionForSignup = document.createElement("option");
      optionForSignup.value = name;
      optionForSignup.textContent = name;
      activitySelect.appendChild(optionForSignup);

      const optionForUpdate = document.createElement("option");
      optionForUpdate.value = name;
      optionForUpdate.textContent = name;
      updateActivitySelect.appendChild(optionForUpdate);

      const optionForDelete = document.createElement("option");
      optionForDelete.value = name;
      optionForDelete.textContent = name;
      deleteActivitySelect.appendChild(optionForDelete);
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await apiFetch("/activities");
      const activities = await response.json();
      activitiesCache = activities;

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;
        const canManageParticipants = authState.role === "admin";

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${canManageParticipants ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);
      });
      populateActivitySelects(activities);

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const activity = document.getElementById("activity").value;

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(activity)}/signup`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authState = {
        token: result.token,
        role: result.role,
        username: result.username,
      };

      localStorage.setItem("authToken", result.token);
      localStorage.setItem("authRole", result.role);
      localStorage.setItem("authUsername", result.username);

      renderAuthState();
      fetchActivities();
      showMessage(`Logged in as ${result.username}`, "success");
    } catch (error) {
      showMessage("Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      if (authState.token) {
        await apiFetch("/auth/logout", { method: "POST" });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      clearAuth();
      fetchActivities();
      showMessage("Logged out", "info");
    }
  });

  updateActivitySelect.addEventListener("change", () => {
    const selectedActivity = updateActivitySelect.value;
    if (!selectedActivity || !activitiesCache[selectedActivity]) {
      updateDescriptionInput.value = "";
      updateScheduleInput.value = "";
      updateMaxInput.value = "";
      return;
    }

    const details = activitiesCache[selectedActivity];
    updateDescriptionInput.value = details.description;
    updateScheduleInput.value = details.schedule;
    updateMaxInput.value = details.max_participants;
  });

  createActivityForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      name: document.getElementById("create-name").value,
      description: document.getElementById("create-description").value,
      schedule: document.getElementById("create-schedule").value,
      max_participants: Number(document.getElementById("create-max").value),
    };

    try {
      const response = await apiFetch("/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Failed to create activity", "error");
        return;
      }

      createActivityForm.reset();
      showMessage(result.message, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Failed to create activity. Please try again.", "error");
      console.error("Error creating activity:", error);
    }
  });

  updateActivityForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const activityName = updateActivitySelect.value;
    const payload = {
      description: updateDescriptionInput.value,
      schedule: updateScheduleInput.value,
      max_participants: Number(updateMaxInput.value),
    };

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(activityName)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Failed to update activity", "error");
        return;
      }

      showMessage(result.message, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Failed to update activity. Please try again.", "error");
      console.error("Error updating activity:", error);
    }
  });

  deleteActivityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const activityName = deleteActivitySelect.value;
    if (!activityName) {
      showMessage("Please select an activity to delete", "error");
      return;
    }

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(activityName)}`,
        {
          method: "DELETE",
        }
      );
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Failed to delete activity", "error");
        return;
      }

      showMessage(result.message, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Failed to delete activity. Please try again.", "error");
      console.error("Error deleting activity:", error);
    }
  });

  // Initialize app
  renderAuthState();
  fetchActivities();
});
