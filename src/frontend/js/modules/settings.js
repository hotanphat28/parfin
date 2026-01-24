
import { state } from '../state.js';
import { Api } from '../api.js';
import { t, showToast } from '../utils.js';

export const Settings = {
	// Called once on App Init
	initGlobal() {
		this.applyTheme(state.theme);
		this.applyLanguage(state.currentLanguage);
		this.loadSettings(); // Fetch rates etc in background
	},

	// Called when View is Loaded
	init() {
		this.bindEvents();
		// Re-apply to ensure UI elements match state
		const langSelector = document.getElementById('language-selector');
		const themeSelector = document.getElementById('theme-selector');
		const rateInput = document.getElementById('exchange-rate-input');

		if (langSelector) langSelector.value = state.currentLanguage;
		if (themeSelector) themeSelector.value = state.theme;
		if (rateInput && state.settings.exchange_rate_usd_vnd) {
			rateInput.value = state.settings.exchange_rate_usd_vnd;
		}

		// Admin Check
		const board = document.getElementById('admin-board');
		if (state.currentUser && state.currentUser.role === 'admin') {
			if (board) {
				board.classList.remove('hidden');
				this.loadUsers();
				this.bindAdminEvents();
			}
		} else {
			if (board) {
				board.classList.add('hidden');
			}
		}
	},

	bindEvents() {
		const langSelector = document.getElementById('language-selector');
		const themeSelector = document.getElementById('theme-selector');
		const updateRateBtn = document.getElementById('update-rate-btn');

		if (langSelector) {
			langSelector.addEventListener('change', (e) => {
				this.handleLanguageChange(e.target.value);
			});
		}

		if (themeSelector) {
			themeSelector.addEventListener('change', (e) => {
				this.handleThemeChange(e.target.value);
			});
		}

		if (updateRateBtn) {
			const rateInput = document.getElementById('exchange-rate-input');
			updateRateBtn.addEventListener('click', () => {
				const rate = rateInput.value;
				if (rate) this.updateExchangeRate(rate);
			});
		}
	},

	async loadSettings() {
		try {
			const settings = await Api.getSettings();
			state.settings = settings;
			// If view is active, update input
			const rateInput = document.getElementById('exchange-rate-input');
			if (rateInput && settings.exchange_rate_usd_vnd) {
				rateInput.value = settings.exchange_rate_usd_vnd;
			}
			// Notify app that settings are ready (fixes race condition with currency recalc)
			document.dispatchEvent(new Event('settings:updated'));
		} catch (e) {
			console.error('Failed to load settings', e);
		}
	},

	handleLanguageChange(lang) {
		state.currentLanguage = lang;
		localStorage.setItem('parfin_language', lang);
		this.applyLanguage(lang);
		document.dispatchEvent(new Event('settings:updated'));
		this.updateUIText();
	},

	handleThemeChange(theme) {
		state.theme = theme;
		localStorage.setItem('parfin_theme', theme);
		this.applyTheme(theme);
	},

	applyTheme(theme) {
		const root = document.documentElement;
		if (theme === 'dark') {
			root.setAttribute('data-theme', 'dark');
		} else if (theme === 'light') {
			root.setAttribute('data-theme', 'light');
		} else {
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
				root.setAttribute('data-theme', 'dark');
			} else {
				root.setAttribute('data-theme', 'light');
			}
		}
	},

	applyLanguage(lang) {
		this.updateUIText();
	},

	updateUIText() {
		document.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.dataset.i18n;
			el.textContent = t(key);
		});
		document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
			const key = el.dataset.i18nPlaceholder;
			el.placeholder = t(key);
		});
	},

	async updateExchangeRate(rate) {
		try {
			await Api.updateSettings({ 'exchange_rate_usd_vnd': rate });
			state.settings.exchange_rate_usd_vnd = rate;
			showToast(t('toast_save_success'), 'success');
			document.dispatchEvent(new Event('settings:updated'));
		} catch (e) {
			showToast(t('toast_error'), 'error');
		}
	},

	bindAdminEvents() {
		const createUserForm = document.getElementById('create-user-form');
		const showAddUserBtn = document.getElementById('show-add-user-btn');
		const cancelAddUserBtn = document.getElementById('cancel-add-user-btn');
		const addUserModal = document.getElementById('add-user-modal');

		if (createUserForm) {
			createUserForm.addEventListener('submit', (e) => this.handleCreateUser(e));
		}

		if (showAddUserBtn && addUserModal) {
			showAddUserBtn.addEventListener('click', () => {
				addUserModal.classList.remove('hidden');
			});
		}

		if (cancelAddUserBtn && addUserModal) {
			cancelAddUserBtn.addEventListener('click', () => {
				addUserModal.classList.add('hidden');
				if (createUserForm) createUserForm.reset();
			});
		}

		// Close on click outside
		if (addUserModal) {
			addUserModal.addEventListener('click', (e) => {
				if (e.target === addUserModal) {
					addUserModal.classList.add('hidden');
				}
			});
		}
	},

	async loadUsers() {
		try {
			const users = await Api.getUsers();
			const tbody = document.getElementById('user-list-body');
			if (!tbody) return;
			tbody.innerHTML = '';

			users.forEach(user => {
				const tr = document.createElement('tr');
				tr.className = 'border-b hover:bg-accent transition-colors';
				tr.style.borderBottom = '1px solid var(--bg-accent)';

				// Initials for avatar
				const initials = user.username.substring(0, 2).toUpperCase();
				const avatarColor = user.role === 'admin' ? 'var(--primary)' : 'var(--secondary)';
				const avatarTextColor = user.role === 'admin' ? 'var(--text-on-primary)' : '#fff';

				tr.innerHTML = `
					<td class="py-4 pl-4 w-10 align-middle">
						<input type="checkbox" class="accent-primary cursor-pointer w-4 h-4">
					</td>
					<td class="py-4 pl-4 pr-8 align-middle">
						<div class="flex items-center gap-4">
							<div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm" style="background-color: ${avatarColor}; color: ${avatarTextColor}; flex-shrink: 0">
								${initials}
							</div>
							<div class="flex flex-col">
								<span class="font-bold text-sm">${user.username}</span>
								<span class="text-xs text-secondary">ID: ${user.id}</span>
							</div>
						</div>
					</td>
					<td class="py-4 px-4 align-middle">
						<span class="badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'} bg-opacity-10 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
							${user.role}
						</span>
					</td>
					<td class="py-4 pl-8 pr-4 align-middle">
						${user.role !== 'admin' ? `
							<button class="btn-icon text-danger hover:bg-red-100 transition-colors p-2 rounded-full delete-user-btn" data-id="${user.id}" title="Delete User">
								<i class="fa-solid fa-trash"></i>
							</button>
						` : ''}
					</td>
				`;

				const delBtn = tr.querySelector('.delete-user-btn');
				if (delBtn) {
					delBtn.addEventListener('click', () => this.handleDeleteUser(user.id));
				}

				tbody.appendChild(tr);
			});
		} catch (e) {
			console.error('Failed to load users', e);
			showToast(t('toast_load_users_fail'), 'error');
		}
	},

	async handleCreateUser(e) {
		e.preventDefault();
		const form = e.target;
		const formData = new FormData(form);
		const data = Object.fromEntries(formData.entries());

		// Basic client-side validation
		if (!data.username || !data.password) {
			showToast(t('toast_fill_fields'), 'error');
			return;
		}

		try {
			const response = await Api.createUser(data);
			if (response.ok || response.success) {
				showToast(t('toast_user_created'), 'success');
				form.reset();
				// Toggle visibility back
				const addUserModal = document.getElementById('add-user-modal');
				if (addUserModal) addUserModal.classList.add('hidden');

				this.loadUsers();
			} else {
				showToast(response.error || t('toast_create_user_fail'), 'error');
			}
		} catch (e) {
			showToast(t('toast_create_user_error'), 'error');
		}
	},

	async handleDeleteUser(id) {
		// Use custom confirmation modal
		const modal = document.getElementById('confirmation-modal');
		const title = document.getElementById('confirmation-title');
		const msg = document.getElementById('confirmation-message');
		const confirmBtn = document.getElementById('confirm-ok-btn');
		const cancelBtn = document.getElementById('confirm-cancel-btn');

		if (!modal) {
			// Fallback
			if (!confirm(t('confirm_delete_user_msg'))) return;
			this.performDeleteUser(id);
			return;
		}

		// Setup Modal
		title.textContent = t('confirm_delete_user_title');
		msg.textContent = t('confirm_delete_user_msg');
		modal.classList.remove('hidden');

		// Cleanup old listeners
		const newConfirmBtn = confirmBtn.cloneNode(true);
		confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

		const newCancelBtn = cancelBtn.cloneNode(true);
		cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

		newCancelBtn.addEventListener('click', () => {
			modal.classList.add('hidden');
		});

		newConfirmBtn.addEventListener('click', async () => {
			modal.classList.add('hidden');
			await this.performDeleteUser(id);
		});
	},

	async performDeleteUser(id) {
		try {
			const ok = await Api.deleteUser(id);
			if (ok) {
				showToast(t('toast_user_deleted'), 'success');
				this.loadUsers();
			} else {
				showToast(t('toast_delete_user_fail'), 'error');
			}
		} catch (e) {
			showToast(t('toast_delete_user_error'), 'error');
		}
	}
};
