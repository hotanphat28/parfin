
import { Api } from '../api.js';
import { state } from '../state.js';
import { showToast, t } from '../utils.js';

export const Auth = {
	init() {
		const loginForm = document.getElementById('login-form');
		if (loginForm) {
			loginForm.addEventListener('submit', (e) => this.handleLogin(e));
		}

		const logoutBtn = document.getElementById('logout-btn');
		if (logoutBtn) {
			logoutBtn.addEventListener('click', () => this.handleLogout());
		}

		this.checkAuth();
	},

	async checkAuth() {
		const user = localStorage.getItem('parfin_user');
		if (user) {
			state.currentUser = JSON.parse(user);
			this.showDashboard();
		} else {
			this.showLogin();
		}
	},

	async handleLogin(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());

		try {
			const result = await Api.login(data);

			if (result.ok) {
				state.currentUser = result.data.user;
				localStorage.setItem('parfin_user', JSON.stringify(result.data.user));
				this.showDashboard();
				showToast(t('toast_welcome'), 'success');
			} else {
				showToast(result.data.error || t('toast_login_fail'), 'error');
			}
		} catch (err) {
			showToast(t('toast_connect_error'), 'error');
		}
	},

	handleLogout() {
		state.currentUser = null;
		localStorage.removeItem('parfin_user');
		this.showLogin();
		// clear other state?
		// state.transactions = [];
	},

	showLogin() {
		document.getElementById('login-view').classList.remove('hidden');
		document.getElementById('dashboard-view').classList.add('hidden');
	},

	showDashboard() {
		document.getElementById('login-view').classList.add('hidden');
		document.getElementById('dashboard-view').classList.remove('hidden');

		const username = state.currentUser.username;
		const userDisplayName = document.getElementById('user-display-name');
		const sidebarUserName = document.getElementById('sidebar-user-name');

		if (userDisplayName) userDisplayName.textContent = username;
		if (sidebarUserName) sidebarUserName.textContent = username;

		// Trigger other modules to load data
		// We can dispatch a custom event or let main.js handle this coordination?
		// Dispatch event is cleaner for decoupling.
		document.dispatchEvent(new Event('auth:login_success'));
	}
};
