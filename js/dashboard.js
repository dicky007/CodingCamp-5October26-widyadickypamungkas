// To-Do List Life Dashboard - Main JavaScript Module
"use strict";

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
    TASKS: "todoDashboard_tasks",
    QUICK_LINKS: "todoDashboard_quickLinks",
    USER_PREFERENCES: "todoDashboard_userPreferences",
    THEME: "todoDashboard_theme",
    TIMER: "todoDashboard_timer"
};

const LIMITS = {
    TASK_MIN: 1,
    TASK_MAX: 1000,
    LINK_NAME_MIN: 1,
    LINK_NAME_MAX: 50,
    USER_NAME_MAX: 50,
    TIMER_MIN: 1,
    TIMER_MAX: 120,
    TIMER_DEFAULT: 25,
    URL_MAX: 2048
};

const SORT_OPTIONS = [
    "created-asc",
    "created-desc",
    "alphabetical-asc",
    "alphabetical-desc",
    "completion-status"
];

const DEFAULT_PREFERENCES = {
    userName: "",
    focusTimerDuration: LIMITS.TIMER_DEFAULT,
    theme: "light",
    taskSorting: "created-desc",
    preventTaskDuplicates: true,
    preventLinkDuplicates: true
};

const ERROR_MESSAGES = {
    "storage-quota-exceeded": "Storage limit reached. Try deleting some old tasks or completed items.",
    "storage-unavailable": "Local Storage is not available. Your changes will not be saved.",
    "invalid-url": "Please enter a valid HTTPS URL (e.g., https://example.com)",
    "duplicate-task": "This task already exists. Try a different description.",
    "duplicate-link": "This link already exists.",
    "empty-task": "Task description cannot be empty.",
    "empty-link-name": "Link name cannot be empty.",
    "timer-invalid-duration": "Timer duration must be between 1 and 120 minutes."
};

// ============================================================================
// MODELS
// ============================================================================

/**
 * Task Model
 */
class Task {
    constructor(description) {
        this.id = Task.generateId();
        this.description = (description || "").trim();
        this.completed = false;
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    static generateId() {
        return "task_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    }

    static validateDescription(description) {
        const trimmed = description ? description.trim() : "";

        if (trimmed.length < LIMITS.TASK_MIN) {
            return { valid: false, error: ERROR_MESSAGES["empty-task"] };
        }

        if (trimmed.length > LIMITS.TASK_MAX) {
            return {
                valid: false,
                error: `Task description too long (max ${LIMITS.TASK_MAX} characters)`,
                truncated: trimmed.substring(0, LIMITS.TASK_MAX)
            };
        }

        return { valid: true };
    }

    updateDescription(newDescription) {
        const validation = Task.validateDescription(newDescription);
        if (validation.valid) {
            this.description = newDescription.trim();
            this.updatedAt = new Date().toISOString();
        }
        return validation;
    }

    toggleCompletion() {
        this.completed = !this.completed;
        this.updatedAt = new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            description: this.description,
            completed: this.completed,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        const task = new Task(data && data.description);
        if (data) {
            task.id = data.id || task.id;
            task.completed = Boolean(data.completed);
            task.createdAt = data.createdAt || task.createdAt;
            task.updatedAt = data.updatedAt || task.createdAt;
        }
        return task;
    }
}

/**
 * QuickLink Model
 */
class QuickLink {
    constructor(name, url) {
        this.id = QuickLink.generateId();
        this.name = (name || "").trim();
        this.url = (url || "").trim();
        this.createdAt = new Date().toISOString();
    }

    static generateId() {
        return "link_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    }

    static validateName(name) {
        const trimmed = name ? name.trim() : "";

        if (trimmed.length < LIMITS.LINK_NAME_MIN) {
            return { valid: false, error: ERROR_MESSAGES["empty-link-name"] };
        }

        if (trimmed.length > LIMITS.LINK_NAME_MAX) {
            return {
                valid: false,
                error: `Link name too long (max ${LIMITS.LINK_NAME_MAX} characters)`,
                truncated: trimmed.substring(0, LIMITS.LINK_NAME_MAX)
            };
        }

        return { valid: true };
    }

    static validateUrl(url) {
        const trimmed = url ? url.trim() : "";

        if (!trimmed) {
            return { valid: false, error: "URL cannot be empty" };
        }

        if (trimmed.length > LIMITS.URL_MAX) {
            return { valid: false, error: "URL is too long" };
        }

        try {
            const urlPattern = /^https:\/\/([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i;
            if (!urlPattern.test(trimmed)) {
                return { valid: false, error: ERROR_MESSAGES["invalid-url"] };
            }

            const parsed = new URL(trimmed);
            if (parsed.protocol !== "https:") {
                return { valid: false, error: "URL must use HTTPS protocol" };
            }
            if (!parsed.hostname.includes(".")) {
                return { valid: false, error: "Please enter a valid domain name" };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: "Please enter a valid URL format" };
        }
    }

    /**
     * Normalize a URL for duplicate comparison.
     */
    static normalizeUrl(url) {
        return (url || "")
            .toLowerCase()
            .trim()
            .replace(/^(https?:\/\/)?(www\.)?/, "")
            .replace(/\/+$/, "");
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            url: this.url,
            createdAt: this.createdAt
        };
    }

    static fromJSON(data) {
        const link = new QuickLink(data && data.name, data && data.url);
        if (data) {
            link.id = data.id || link.id;
            link.createdAt = data.createdAt || link.createdAt;
        }
        return link;
    }
}

/**
 * UserPreferences Model
 */
class UserPreferences {
    constructor() {
        this.userName = DEFAULT_PREFERENCES.userName;
        this.focusTimerDuration = DEFAULT_PREFERENCES.focusTimerDuration;
        this.theme = DEFAULT_PREFERENCES.theme;
        this.taskSorting = DEFAULT_PREFERENCES.taskSorting;
        this.preventTaskDuplicates = DEFAULT_PREFERENCES.preventTaskDuplicates;
        this.preventLinkDuplicates = DEFAULT_PREFERENCES.preventLinkDuplicates;
        this.lastUpdated = new Date().toISOString();
    }

    validateUpdates(updates) {
        const errors = [];

        // Note: an over-long user name is truncated (see update) rather than
        // rejected, per Requirement 6.7.

        if (updates.focusTimerDuration !== undefined) {
            const duration = parseInt(updates.focusTimerDuration, 10);
            if (isNaN(duration) || duration < LIMITS.TIMER_MIN || duration > LIMITS.TIMER_MAX) {
                errors.push(ERROR_MESSAGES["timer-invalid-duration"]);
            }
        }

        if (updates.theme !== undefined) {
            if (["light", "dark"].indexOf(updates.theme) === -1) {
                errors.push("Theme must be either light or dark");
            }
        }

        if (updates.taskSorting !== undefined) {
            if (SORT_OPTIONS.indexOf(updates.taskSorting) === -1) {
                errors.push("Invalid sorting option");
            }
        }

        return errors.length > 0 ? { valid: false, errors } : { valid: true };
    }

    update(updates) {
        const validation = this.validateUpdates(updates);
        if (!validation.valid) {
            return validation;
        }

        if (updates.userName !== undefined) {
            this.userName = String(updates.userName).trim().substring(0, LIMITS.USER_NAME_MAX);
        }
        if (updates.focusTimerDuration !== undefined) {
            this.focusTimerDuration = parseInt(updates.focusTimerDuration, 10);
        }
        if (updates.theme !== undefined) {
            this.theme = updates.theme;
        }
        if (updates.taskSorting !== undefined) {
            this.taskSorting = updates.taskSorting;
        }
        if (updates.preventTaskDuplicates !== undefined) {
            this.preventTaskDuplicates = Boolean(updates.preventTaskDuplicates);
        }
        if (updates.preventLinkDuplicates !== undefined) {
            this.preventLinkDuplicates = Boolean(updates.preventLinkDuplicates);
        }

        this.lastUpdated = new Date().toISOString();
        return { valid: true };
    }

    resetToDefaults() {
        const defaults = new UserPreferences();
        this.userName = defaults.userName;
        this.focusTimerDuration = defaults.focusTimerDuration;
        this.theme = defaults.theme;
        this.taskSorting = defaults.taskSorting;
        this.preventTaskDuplicates = defaults.preventTaskDuplicates;
        this.preventLinkDuplicates = defaults.preventLinkDuplicates;
        this.lastUpdated = new Date().toISOString();
    }

    toJSON() {
        return {
            userName: this.userName,
            focusTimerDuration: this.focusTimerDuration,
            theme: this.theme,
            taskSorting: this.taskSorting,
            preventTaskDuplicates: this.preventTaskDuplicates,
            preventLinkDuplicates: this.preventLinkDuplicates,
            lastUpdated: this.lastUpdated
        };
    }

    static fromJSON(data) {
        const prefs = new UserPreferences();
        if (!data || typeof data !== "object") {
            return prefs;
        }

        // Validate and apply each property independently so an invalid value
        // for one property falls back to its default without discarding the
        // other valid stored values (Requirement 6.4).
        const restore = (key, value) => {
            if (value !== undefined) {
                prefs.update({ [key]: value });
            }
        };

        restore("userName", data.userName);
        restore("focusTimerDuration", data.focusTimerDuration);
        restore("theme", data.theme);
        restore("taskSorting", data.taskSorting);
        restore("preventTaskDuplicates", data.preventTaskDuplicates);
        restore("preventLinkDuplicates", data.preventLinkDuplicates);

        return prefs;
    }
}

// ============================================================================
// STORAGE MANAGER
// ============================================================================

class StorageManager {
    constructor() {
        this.QUOTA_LIMIT = 5 * 1024 * 1024;
        this.storageAvailable = this.testStorage();
    }

    testStorage() {
        try {
            const testKey = "__storage_test__";
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn("Local Storage not available:", error);
            return false;
        }
    }

    getItem(key) {
        if (!this.storageAvailable) return null;
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Error reading Local Storage (key: ${key}):`, error);
            return null;
        }
    }

    setItem(key, value) {
        if (!this.storageAvailable) return false;
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing Local Storage (key: ${key}):`, error);
            if (error && error.name === "QuotaExceededError") {
                this.handleQuotaExceeded();
            }
            return false;
        }
    }

    removeItem(key) {
        if (!this.storageAvailable) return;
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`Error removing Local Storage (key: ${key}):`, error);
        }
    }

    estimateUsage() {
        if (!this.storageAvailable) return 0;
        let total = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key) || "";
                total += (key.length + value.length) * 2;
            }
        } catch (error) {
            console.error("Error estimating storage usage:", error);
        }
        return total;
    }

    handleQuotaExceeded() {
        console.warn("Local Storage quota exceeded");
    }
}

// ============================================================================
// NOTIFICATION MANAGER
// ============================================================================

class NotificationManager {
    constructor(container) {
        this.container = container;
    }

    show(message, type = "info", duration = 5000) {
        if (!this.container) {
            console.log(`Notification (${type}): ${message}`);
            return null;
        }

        const notification = document.createElement("div");
        notification.className = `notification notification--${type}`;
        notification.setAttribute("role", type === "error" ? "alert" : "status");
        notification.setAttribute("aria-live", type === "error" ? "assertive" : "polite");

        const icons = {
            success: "✅",
            error: "❌",
            warning: "⚠️",
            info: "ℹ️"
        };

        notification.innerHTML = `
            <span class="notification__icon" aria-hidden="true">${icons[type] || icons.info}</span>
            <span class="notification__message"></span>
            <button class="notification__close" type="button" aria-label="Dismiss notification">&times;</button>
        `;
        notification.querySelector(".notification__message").textContent = message;

        const closeBtn = notification.querySelector(".notification__close");
        closeBtn.addEventListener("click", () => this.dismiss(notification));

        this.container.appendChild(notification);

        const timeoutId = setTimeout(() => this.dismiss(notification), duration);
        notification._timeoutId = timeoutId;

        return notification;
    }

    dismiss(notification) {
        if (!notification || !notification.parentNode) return;
        if (notification._timeoutId) {
            clearTimeout(notification._timeoutId);
        }
        notification.classList.add("notification--exiting");
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    static announce(message) {
        const region = document.createElement("div");
        region.setAttribute("aria-live", "assertive");
        region.setAttribute("aria-atomic", "true");
        region.className = "visually-hidden";
        region.textContent = message;
        document.body.appendChild(region);
        setTimeout(() => {
            if (region.parentNode) region.parentNode.removeChild(region);
        }, 1000);
    }
}

// ============================================================================
// GREETING COMPONENT
// ============================================================================

class GreetingComponent {
    constructor(elements, preferences) {
        this.timeElement = elements.time;
        this.dateElement = elements.date;
        this.messageElement = elements.message;
        this.preferences = preferences;
        this.intervalId = null;
    }

    getCurrentGreeting(hour) {
        if (hour >= 5 && hour < 12) return "Good morning";
        if (hour >= 12 && hour < 18) return "Good afternoon";
        return "Good evening";
    }

    setUserName(name) {
        this.preferences.userName = (name || "").trim().substring(0, LIMITS.USER_NAME_MAX);
        this.updateDisplay();
    }

    updateDisplay() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const timeText = `${hours}:${minutes}`;
        const dateText = `${year}-${month}-${day}`;

        if (this.timeElement) {
            this.timeElement.textContent = timeText;
            this.timeElement.setAttribute("datetime", now.toISOString());
        }
        if (this.dateElement) {
            this.dateElement.textContent = dateText;
            this.dateElement.setAttribute("datetime", dateText);
        }
        if (this.messageElement) {
            let greeting = this.getCurrentGreeting(now.getHours());
            greeting += this.preferences.userName ? `, ${this.preferences.userName}!` : "!";
            this.messageElement.textContent = greeting;
        }
    }

    start() {
        this.updateDisplay();
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.updateDisplay(), 1000);
    }
}

// ============================================================================
// FOCUS TIMER COMPONENT
// ============================================================================

class FocusTimerComponent {
    constructor(options) {
        this.displayElement = options.display;
        this.container = options.container;
        this.storage = options.storage;
        this.getDuration = options.getDuration;
        this.onComplete = options.onComplete;

        this.durationSeconds = this._resolveDuration();
        this.remaining = this.durationSeconds;
        this.isRunning = false;
        this.intervalId = null;
        this.endTime = null;

        this._restoreState();
    }

    _resolveDuration() {
        const minutes = parseInt(this.getDuration(), 10);
        if (isNaN(minutes) || minutes < LIMITS.TIMER_MIN || minutes > LIMITS.TIMER_MAX) {
            return LIMITS.TIMER_DEFAULT * 60;
        }
        return minutes * 60;
    }

    _restoreState() {
        const saved = this.storage.getItem(STORAGE_KEYS.TIMER);
        if (!saved) return;

        if (saved.isRunning && typeof saved.endTime === "number") {
            const remaining = Math.round((saved.endTime - Date.now()) / 1000);
            if (remaining > 0) {
                this.remaining = remaining;
                this.endTime = saved.endTime;
                this.isRunning = true;
                this._runInterval();
            } else {
                this.remaining = 0;
                this._markCompleted(false);
            }
        } else if (typeof saved.remaining === "number" && saved.remaining >= 0) {
            this.remaining = Math.min(saved.remaining, this.durationSeconds);
        }
        this.updateDisplay();
    }

    formatTime(seconds) {
        const safe = Math.max(0, Math.floor(seconds));
        const mins = Math.floor(safe / 60);
        const secs = safe % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    updateDisplay() {
        if (!this.displayElement) return;
        this.displayElement.textContent = this.formatTime(this.remaining);
        if (this.container) {
            this.container.classList.toggle("timer--running", this.isRunning);
        }
    }

    start() {
        if (this.isRunning) return;
        if (this.remaining <= 0) {
            this.remaining = this.durationSeconds;
        }
        this.isRunning = true;
        this.endTime = Date.now() + this.remaining * 1000;
        if (this.container) this.container.classList.remove("timer--completed");
        this._runInterval();
        this.updateDisplay();
        this._persist();
    }

    _runInterval() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this._tick(), 1000);
    }

    _tick() {
        if (!this.isRunning) return;
        this.remaining = Math.max(0, Math.round((this.endTime - Date.now()) / 1000));
        this.updateDisplay();
        this._persist();

        if (this.remaining <= 0) {
            this._markCompleted(true);
        }
    }

    stop() {
        if (!this.isRunning) return;
        this.remaining = Math.max(0, Math.round((this.endTime - Date.now()) / 1000));
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.updateDisplay();
        this._persist();
    }

    reset() {
        this.remaining = this.durationSeconds;
        if (this.isRunning) {
            this.endTime = Date.now() + this.remaining * 1000;
        }
        if (this.container) this.container.classList.remove("timer--completed");
        this.updateDisplay();
        this._persist();
    }

    setDuration(minutes) {
        const parsed = parseInt(minutes, 10);
        const valid = !isNaN(parsed) && parsed >= LIMITS.TIMER_MIN && parsed <= LIMITS.TIMER_MAX;
        this.durationSeconds = (valid ? parsed : LIMITS.TIMER_DEFAULT) * 60;
        if (!this.isRunning) {
            this.remaining = this.durationSeconds;
            if (this.container) this.container.classList.remove("timer--completed");
        }
        this.updateDisplay();
        this._persist();
    }

    _markCompleted(notify) {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.remaining = 0;
        this.updateDisplay();
        if (this.container) this.container.classList.add("timer--completed");
        this._persist();
        if (notify && typeof this.onComplete === "function") {
            this.onComplete();
        }
    }

    _persist() {
        this.storage.setItem(STORAGE_KEYS.TIMER, {
            isRunning: this.isRunning,
            remaining: this.remaining,
            endTime: this.isRunning ? this.endTime : null
        });
    }
}

// ============================================================================
// TASK MANAGER COMPONENT
// ============================================================================

class TaskManagerComponent {
    constructor(options) {
        this.storage = options.storage;
        this.getPreferences = options.getPreferences;
        this.notify = options.notify;
        this.listElement = options.list;
        this.emptyElement = options.empty;

        this.tasks = [];
        this.load();
    }

    load() {
        const stored = this.storage.getItem(STORAGE_KEYS.TASKS);
        if (Array.isArray(stored)) {
            this.tasks = stored.map((data) => Task.fromJSON(data));
        }
    }

    save() {
        this.storage.setItem(STORAGE_KEYS.TASKS, this.tasks.map((task) => task.toJSON()));
    }

    getTasks() {
        return this.tasks;
    }

    hasDuplicate(description) {
        const normalized = description.trim().toLowerCase().replace(/\s+/g, " ");
        return this.tasks.some((task) =>
            task.description.trim().toLowerCase().replace(/\s+/g, " ") === normalized
        );
    }

    addTask(description) {
        const raw = (description || "").trim();
        const validation = Task.validateDescription(raw);

        if (!validation.valid) {
            return { valid: false, error: validation.error };
        }

        if (this.getPreferences().preventTaskDuplicates && this.hasDuplicate(raw)) {
            return { valid: false, error: ERROR_MESSAGES["duplicate-task"] };
        }

        const task = new Task(raw);
        this.tasks.push(task);
        this.save();
        this.render();
        return { valid: true, task };
    }

    updateTask(id, newDescription) {
        const task = this.tasks.find((t) => t.id === id);
        if (!task) return { valid: false, error: "Task not found" };

        const raw = (newDescription || "").trim();
        const validation = Task.validateDescription(raw);
        if (!validation.valid) {
            return { valid: false, error: validation.error };
        }

        if (this.getPreferences().preventTaskDuplicates) {
            const normalized = raw.toLowerCase().replace(/\s+/g, " ");
            const duplicate = this.tasks.some((t) =>
                t.id !== id &&
                t.description.trim().toLowerCase().replace(/\s+/g, " ") === normalized
            );
            if (duplicate) {
                return { valid: false, error: ERROR_MESSAGES["duplicate-task"] };
            }
        }

        task.updateDescription(raw);
        this.save();
        this.render();
        return { valid: true };
    }

    toggleCompletion(id) {
        const task = this.tasks.find((t) => t.id === id);
        if (!task) return;
        task.toggleCompletion();
        this.save();
        this.render();
    }

    deleteTask(id) {
        const task = this.tasks.find((t) => t.id === id);
        if (!task) return false;
        if (!window.confirm(`Delete task "${task.description}"?`)) {
            return false;
        }
        this.tasks = this.tasks.filter((t) => t.id !== id);
        this.save();
        this.render();
        return true;
    }

    sortTasks(criteria) {
        const sorted = this.tasks.slice();

        switch (criteria) {
            case "created-asc":
                return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            case "created-desc":
                return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            case "alphabetical-asc":
                return sorted.sort((a, b) => a.description.localeCompare(b.description));
            case "alphabetical-desc":
                return sorted.sort((a, b) => b.description.localeCompare(a.description));
            case "completion-status":
                return sorted.sort((a, b) => {
                    if (a.completed === b.completed) {
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    }
                    return a.completed ? 1 : -1;
                });
            default:
                return sorted;
        }
    }

    render() {
        if (!this.listElement) return;

        this.listElement.innerHTML = "";
        const sorted = this.sortTasks(this.getPreferences().taskSorting);

        sorted.forEach((task) => {
            this.listElement.appendChild(this._createTaskElement(task));
        });

        if (this.emptyElement) {
            this.emptyElement.hidden = sorted.length > 0;
        }
    }

    _createTaskElement(task) {
        const element = document.createElement("div");
        element.className = `task-item${task.completed ? " task-item--completed" : ""}`;
        element.setAttribute("data-task-id", task.id);
        element.setAttribute("role", "listitem");

        const content = document.createElement("div");
        content.className = "task-item__content";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", `Mark "${task.description}" as ${task.completed ? "incomplete" : "completed"}`);

        const description = document.createElement("span");
        description.className = "task-description";
        description.textContent = task.description;

        content.appendChild(checkbox);
        content.appendChild(description);

        const actions = document.createElement("div");
        actions.className = "task-item__actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "task-edit-btn";
        editBtn.setAttribute("aria-label", `Edit task "${task.description}"`);
        editBtn.innerHTML = '<span aria-hidden="true">✎</span>';

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "task-delete-btn";
        deleteBtn.setAttribute("aria-label", `Delete task "${task.description}"`);
        deleteBtn.innerHTML = '<span aria-hidden="true">🗑</span>';

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        element.appendChild(content);
        element.appendChild(actions);

        checkbox.addEventListener("change", () => this.toggleCompletion(task.id));
        editBtn.addEventListener("click", () => this.editTask(task.id));
        deleteBtn.addEventListener("click", () => {
            if (this.deleteTask(task.id)) {
                this.notify("Task deleted", "success");
            }
        });

        return element;
    }

    editTask(id) {
        const task = this.tasks.find((t) => t.id === id);
        if (!task) return;

        const taskElement = this.listElement.querySelector(`[data-task-id="${id}"]`);
        if (!taskElement) return;

        const descriptionEl = taskElement.querySelector(".task-description");
        const original = task.description;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "task-edit-input";
        input.value = original;
        input.setAttribute("aria-label", "Edit task description");

        descriptionEl.replaceWith(input);
        input.focus();
        input.select();

        let finished = false;
        const completeEdit = (save) => {
            if (finished) return;
            finished = true;
            if (save) {
                const result = this.updateTask(id, input.value);
                if (!result.valid) {
                    this.notify(result.error, "error");
                } else {
                    this.notify("Task updated", "success");
                }
            }
            this.render();
        };

        input.addEventListener("blur", () => completeEdit(true));
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                completeEdit(true);
            } else if (event.key === "Escape") {
                finished = true;
                this.render();
            }
        });
    }
}

// ============================================================================
// QUICK LINKS COMPONENT
// ============================================================================

class QuickLinksComponent {
    constructor(options) {
        this.storage = options.storage;
        this.getPreferences = options.getPreferences;
        this.notify = options.notify;
        this.listElement = options.list;
        this.emptyElement = options.empty;

        this.links = [];
        this.load();
    }

    load() {
        const stored = this.storage.getItem(STORAGE_KEYS.QUICK_LINKS);
        if (Array.isArray(stored)) {
            this.links = stored.map((data) => QuickLink.fromJSON(data));
        }
    }

    save() {
        this.storage.setItem(STORAGE_KEYS.QUICK_LINKS, this.links.map((link) => link.toJSON()));
    }

    getLinks() {
        return this.links;
    }

    addLink(name, url) {
        const nameValidation = QuickLink.validateName(name);
        if (!nameValidation.valid) {
            return { valid: false, error: nameValidation.error, field: "name" };
        }

        const urlValidation = QuickLink.validateUrl(url);
        if (!urlValidation.valid) {
            return { valid: false, error: urlValidation.error, field: "url" };
        }

        if (this.getPreferences().preventLinkDuplicates) {
            const normalized = QuickLink.normalizeUrl(url);
            const duplicate = this.links.some(
                (link) => QuickLink.normalizeUrl(link.url) === normalized
            );
            if (duplicate) {
                return { valid: false, error: ERROR_MESSAGES["duplicate-link"], field: "url" };
            }
        }

        const link = new QuickLink(name, url);
        this.links.push(link);
        this.save();
        this.render();
        return { valid: true, link };
    }

    deleteLink(id) {
        const link = this.links.find((l) => l.id === id);
        if (!link) return false;
        if (!window.confirm(`Delete link "${link.name}"?`)) {
            return false;
        }
        this.links = this.links.filter((l) => l.id !== id);
        this.save();
        this.render();
        return true;
    }

    openLink(url) {
        window.open(url, "_blank", "noopener,noreferrer");
    }

    render() {
        if (!this.listElement) return;

        this.listElement.innerHTML = "";
        this.links.forEach((link) => {
            this.listElement.appendChild(this._createLinkElement(link));
        });

        if (this.emptyElement) {
            this.emptyElement.hidden = this.links.length > 0;
        }
    }

    _createLinkElement(link) {
        const element = document.createElement("div");
        element.className = "link-item";
        element.setAttribute("data-link-id", link.id);
        element.setAttribute("role", "listitem");

        const anchor = document.createElement("a");
        anchor.className = "link-url";
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.setAttribute("aria-label", `Open ${link.name} in a new tab`);

        const icon = document.createElement("span");
        icon.className = "link-url__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "🔗";

        const nameSpan = document.createElement("span");
        nameSpan.className = "link-name";
        nameSpan.textContent = link.name;

        anchor.appendChild(icon);
        anchor.appendChild(nameSpan);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "link-delete-btn";
        deleteBtn.setAttribute("aria-label", `Delete link "${link.name}"`);
        deleteBtn.innerHTML = '<span aria-hidden="true">🗑</span>';

        deleteBtn.addEventListener("click", () => {
            if (this.deleteLink(link.id)) {
                this.notify("Link deleted", "success");
            }
        });

        element.appendChild(anchor);
        element.appendChild(deleteBtn);

        return element;
    }
}

// ============================================================================
// THEME MANAGER COMPONENT
// ============================================================================

class ThemeManagerComponent {
    constructor(options) {
        this.storage = options.storage;
        this.getPreferences = options.getPreferences;
        this.savePreferences = options.savePreferences;
        this.toggleButton = options.toggleButton;
    }

    getCurrentTheme() {
        return this.getPreferences().theme === "dark" ? "dark" : "light";
    }

    setTheme(themeName, persist = true) {
        const theme = themeName === "dark" ? "dark" : "light";
        document.body.classList.toggle("dark-mode", theme === "dark");
        document.body.classList.toggle("light-mode", theme === "light");
        document.documentElement.setAttribute("data-theme", theme);

        if (persist) {
            this.storage.setItem(STORAGE_KEYS.THEME, theme);
        }
        this.applyThemeStyles(theme);
    }

    applyThemeStyles(theme) {
        if (!this.toggleButton) return;
        const icon = this.toggleButton.querySelector(".theme-toggle__icon");
        const label = this.toggleButton.querySelector(".theme-toggle__label");
        const isDark = theme === "dark";

        if (icon) icon.textContent = isDark ? "☾" : "☀";
        if (label) label.textContent = isDark ? "Light" : "Dark";
        this.toggleButton.setAttribute("aria-pressed", String(isDark));
        this.toggleButton.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    }

    toggleTheme() {
        const next = this.getCurrentTheme() === "dark" ? "light" : "dark";
        const result = this.getPreferences();
        result.theme = next;
        this.savePreferences();
        this.storage.setItem(STORAGE_KEYS.THEME, next);
        this.setTheme(next, false);
    }

    load() {
        let theme = this.storage.getItem(STORAGE_KEYS.THEME);
        if (theme !== "light" && theme !== "dark") {
            theme = this.getPreferences().theme;
        }
        if (theme !== "light" && theme !== "dark") {
            theme = "light";
        }
        this.setTheme(theme, false);
    }
}

// ============================================================================
// PREFERENCES CONTROLLER
// ============================================================================

class PreferencesController {
    constructor(storage) {
        this.storage = storage;
        this.preferences = new UserPreferences();
        this.saveTimerId = null;
        this.loadPreferences();
    }

    loadPreferences() {
        const stored = this.storage.getItem(STORAGE_KEYS.USER_PREFERENCES);
        if (stored) {
            this.preferences = UserPreferences.fromJSON(stored);
        }
    }

    getPreferences() {
        return this.preferences;
    }

    updatePreferences(updates) {
        const result = this.preferences.update(updates);
        if (result.valid) {
            this.savePreferences();
        }
        return result;
    }

    savePreferences() {
        // Debounce so multiple rapid changes persist within 500ms.
        if (this.saveTimerId) {
            clearTimeout(this.saveTimerId);
        }
        this.saveTimerId = setTimeout(() => {
            this.storage.setItem(STORAGE_KEYS.USER_PREFERENCES, this.preferences.toJSON());
            this.saveTimerId = null;
        }, 300);
    }

    flushPreferences() {
        if (this.saveTimerId) {
            clearTimeout(this.saveTimerId);
            this.saveTimerId = null;
        }
        this.storage.setItem(STORAGE_KEYS.USER_PREFERENCES, this.preferences.toJSON());
    }

    resetToDefaults() {
        this.preferences.resetToDefaults();
        this.flushPreferences();
    }
}

// ============================================================================
// APP CONTROLLER
// ============================================================================

class AppController {
    constructor() {
        this.storage = new StorageManager();
        this.notificationManager = new NotificationManager(
            document.querySelector(".notifications-container")
        );
        this.preferencesController = new PreferencesController(this.storage);

        this._buildComponents();
        this._cacheElements();
        this._bindEvents();
        this._initialRender();
    }

    get preferences() {
        return this.preferencesController.getPreferences();
    }

    _notify(message, type) {
        this.notificationManager.show(message, type);
    }

    _buildComponents() {
        this.greeting = new GreetingComponent(
            {
                time: document.querySelector(".current-time"),
                date: document.querySelector(".current-date"),
                message: document.querySelector(".greeting-message")
            },
            this.preferences
        );

        this.timer = new FocusTimerComponent({
            display: document.querySelector(".timer-display"),
            container: document.querySelector(".timer"),
            storage: this.storage,
            getDuration: () => this.preferences.focusTimerDuration,
            onComplete: () => {
                this._notify("Focus session complete! Take a break.", "success", 6000);
                NotificationManager.announce("Focus session complete");
            }
        });

        this.taskManager = new TaskManagerComponent({
            storage: this.storage,
            getPreferences: () => this.preferences,
            notify: (message, type) => this._notify(message, type),
            list: document.querySelector(".tasks-list"),
            empty: document.querySelector(".tasks-empty")
        });

        this.quickLinks = new QuickLinksComponent({
            storage: this.storage,
            getPreferences: () => this.preferences,
            notify: (message, type) => this._notify(message, type),
            list: document.querySelector(".links-list"),
            empty: document.querySelector(".links-empty")
        });

        this.themeManager = new ThemeManagerComponent({
            storage: this.storage,
            getPreferences: () => this.preferences,
            savePreferences: () => this.preferencesController.flushPreferences(),
            toggleButton: document.getElementById("theme-toggle")
        });
    }

    _cacheElements() {
        this.elements = {
            taskForm: document.querySelector(".add-task-form"),
            taskInput: document.querySelector(".task-input"),
            charCount: document.querySelector(".char-count"),
            taskSort: document.querySelector(".task-sort"),
            preventDuplicates: document.querySelector(".prevent-duplicates"),

            linkForm: document.querySelector(".add-link-form"),
            linkNameInput: document.querySelector(".link-name-input"),
            linkUrlInput: document.querySelector(".link-url-input"),

            timerStart: document.querySelector(".timer-start"),
            timerStop: document.querySelector(".timer-stop"),
            timerReset: document.querySelector(".timer-reset"),
            timerDuration: document.querySelector(".timer-duration"),

            userNameInput: document.querySelector(".user-name-input"),
            resetPreferencesBtn: document.querySelector(".reset-preferences-btn"),
            storageStatus: document.querySelector(".storage-status"),

            themeToggle: document.getElementById("theme-toggle")
        };
    }

    _bindEvents() {
        // Theme
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener("click", () => {
                this.themeManager.toggleTheme();
            });
        }

        // Timer
        if (this.elements.timerStart) {
            this.elements.timerStart.addEventListener("click", () => this.timer.start());
        }
        if (this.elements.timerStop) {
            this.elements.timerStop.addEventListener("click", () => this.timer.stop());
        }
        if (this.elements.timerReset) {
            this.elements.timerReset.addEventListener("click", () => this.timer.reset());
        }
        if (this.elements.timerDuration) {
            this.elements.timerDuration.addEventListener("change", (event) => {
                const value = parseInt(event.target.value, 10);
                const result = this.preferencesController.updatePreferences({ focusTimerDuration: value });
                if (result.valid) {
                    this.timer.setDuration(value);
                    this._notify("Timer duration updated", "success");
                } else {
                    event.target.value = this.preferences.focusTimerDuration;
                    this._notify(result.errors[0], "error");
                }
            });
        }

        // Tasks
        if (this.elements.taskForm) {
            this.elements.taskForm.addEventListener("submit", (event) => {
                event.preventDefault();
                this._handleAddTask();
            });
        }
        if (this.elements.taskInput) {
            this.elements.taskInput.addEventListener("input", () => this._updateCharCount());
        }
        if (this.elements.taskSort) {
            this.elements.taskSort.addEventListener("change", (event) => {
                this.preferencesController.updatePreferences({ taskSorting: event.target.value });
                this.taskManager.render();
            });
        }
        if (this.elements.preventDuplicates) {
            this.elements.preventDuplicates.addEventListener("change", (event) => {
                this.preferencesController.updatePreferences({
                    preventTaskDuplicates: event.target.checked
                });
                this._notify(
                    event.target.checked ? "Duplicate prevention enabled" : "Duplicate prevention disabled",
                    "success"
                );
            });
        }

        // Quick links
        if (this.elements.linkForm) {
            this.elements.linkForm.addEventListener("submit", (event) => {
                event.preventDefault();
                this._handleAddLink();
            });
        }

        // Preferences
        if (this.elements.userNameInput) {
            this.elements.userNameInput.addEventListener("change", (event) => {
                const result = this.preferencesController.updatePreferences({ userName: event.target.value });
                if (result.valid) {
                    this.greeting.setUserName(this.preferences.userName);
                    this._notify("Name updated", "success");
                } else {
                    this._notify(result.errors[0], "error");
                }
            });
        }
        if (this.elements.resetPreferencesBtn) {
            this.elements.resetPreferencesBtn.addEventListener("click", () => this._handleResetPreferences());
        }

        // Keyboard shortcuts
        document.addEventListener("keydown", (event) => this._handleGlobalShortcut(event));

        // Persist any pending preference changes before unload
        window.addEventListener("beforeunload", () => this.preferencesController.flushPreferences());

        // Sync state across tabs
        window.addEventListener("storage", (event) => {
            if (event.key === STORAGE_KEYS.USER_PREFERENCES || event.key === STORAGE_KEYS.THEME) {
                this.preferencesController.loadPreferences();
                this.themeManager.load();
                this._applyPreferencesToUI();
            }
        });
    }

    _handleGlobalShortcut(event) {
        const tag = (event.target && event.target.tagName) || "";
        const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
        if (isTyping || event.ctrlKey || event.metaKey || event.altKey) return;

        if (event.key === "t" || event.key === "T") {
            if (this.elements.timerStart) {
                event.preventDefault();
                this.elements.timerStart.focus();
            }
        } else if (event.key === "q" || event.key === "Q") {
            if (this.elements.linkNameInput) {
                event.preventDefault();
                this.elements.linkNameInput.focus();
            }
        } else if (event.key === "Escape") {
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
        }
    }

    _handleAddTask() {
        const input = this.elements.taskInput;
        if (!input) return;

        let value = input.value;
        if (value.length > LIMITS.TASK_MAX) {
            value = value.substring(0, LIMITS.TASK_MAX);
            input.value = value;
            this._notify(`Task truncated to ${LIMITS.TASK_MAX} characters`, "warning");
        }

        const result = this.taskManager.addTask(value);
        if (!result.valid) {
            this._showFieldError(input, result.error);
            return;
        }

        input.value = "";
        this._updateCharCount();
        this._notify("Task added", "success");
    }

    _handleAddLink() {
        const nameInput = this.elements.linkNameInput;
        const urlInput = this.elements.linkUrlInput;
        if (!nameInput || !urlInput) return;

        const result = this.quickLinks.addLink(nameInput.value, urlInput.value);
        if (!result.valid) {
            this._showFieldError(result.field === "name" ? nameInput : urlInput, result.error);
            return;
        }

        nameInput.value = "";
        urlInput.value = "";
        this._notify("Link added", "success");
    }

    _handleResetPreferences() {
        if (!window.confirm("Reset all preferences to their default values?")) {
            return;
        }

        this.preferencesController.resetToDefaults();
        this.themeManager.load();
        this._applyPreferencesToUI();
        this.timer.setDuration(this.preferences.focusTimerDuration);
        this.greeting.updateDisplay();
        this.taskManager.render();
        this._notify("Preferences reset to defaults", "success");
    }

    _applyPreferencesToUI() {
        if (this.elements.userNameInput) {
            this.elements.userNameInput.value = this.preferences.userName;
        }
        if (this.elements.timerDuration) {
            this.elements.timerDuration.value = this.preferences.focusTimerDuration;
        }
        if (this.elements.taskSort) {
            this.elements.taskSort.value = this.preferences.taskSorting;
        }
        if (this.elements.preventDuplicates) {
            this.elements.preventDuplicates.checked = this.preferences.preventTaskDuplicates;
        }
        if (this.elements.themeToggle) {
            this.themeManager.applyThemeStyles(this.themeManager.getCurrentTheme());
        }
    }

    _updateCharCount() {
        const input = this.elements.taskInput;
        const counter = this.elements.charCount;
        if (!input || !counter) return;

        const length = input.value.length;
        counter.textContent = `${length}/${LIMITS.TASK_MAX}`;
        counter.classList.toggle("char-count--warning", length >= LIMITS.TASK_MAX);
    }

    _showFieldError(input, message) {
        if (!input) return;
        input.classList.add("input--error");

        let errorEl = input.parentNode.querySelector(".input-error");
        if (!errorEl) {
            errorEl = document.createElement("div");
            errorEl.className = "input-error";
            errorEl.setAttribute("role", "alert");
            input.parentNode.appendChild(errorEl);
        }
        errorEl.textContent = message;

        input.focus();

        if (input._errorTimeout) clearTimeout(input._errorTimeout);
        input._errorTimeout = setTimeout(() => {
            input.classList.remove("input--error");
            if (errorEl && errorEl.parentNode) {
                errorEl.parentNode.removeChild(errorEl);
            }
        }, 5000);
    }

    _updateStorageStatus() {
        const status = this.elements.storageStatus;
        if (!status) return;

        if (this.storage.storageAvailable) {
            const usageKB = Math.round(this.storage.estimateUsage() / 1024);
            status.textContent = `Local Storage: Available (${usageKB} KB used)`;
        } else {
            status.textContent = ERROR_MESSAGES["storage-unavailable"];
        }
    }

    _initialRender() {
        // Load and apply theme first to avoid a flash of the wrong theme.
        this.themeManager.load();

        // Greeting
        this.greeting.start();

        // Timer
        this.timer.setDuration(this.preferences.focusTimerDuration);
        this.timer.updateDisplay();

        // Tasks & links
        this.taskManager.render();
        this.quickLinks.render();

        // Preferences UI
        this._applyPreferencesToUI();
        this._updateCharCount();
        this._updateStorageStatus();

        if (!this.storage.storageAvailable) {
            this._notify(ERROR_MESSAGES["storage-unavailable"], "warning", 8000);
        }

        // Periodic storage status refresh
        setInterval(() => this._updateStorageStatus(), 30000);
    }
}

// ============================================================================
// BOOTSTRAP
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
    try {
        window.dashboardApp = new AppController();
    } catch (error) {
        console.error("Failed to initialize dashboard:", error);
    }
});
