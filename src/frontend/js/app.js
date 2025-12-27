/**
 * ParFin Application Logic
 */

const App = {
	state: {
		currentUser: null,
		transactions: [],
		filterParams: { type: 'month', month: new Date().toISOString().slice(0, 7) }, // YYYY-MM
		theme: localStorage.getItem('parfin_theme') || 'system',
		chart: null
	},

	elements: {
		loginView: document.getElementById('login-view'),
		dashboardView: document.getElementById('dashboard-view'),
		loginForm: document.getElementById('login-form'),
		userDisplayName: document.getElementById('user-display-name'),
		logoutBtn: document.getElementById('logout-btn'),
		transactionList: document.getElementById('transaction-list'),
		totalBalance: document.getElementById('total-balance'),
		monthlyIncome: document.getElementById('monthly-income'),
		monthlyExpense: document.getElementById('monthly-expense'),
		addTransactionBtn: document.getElementById('add-transaction-btn'),
		transactionModal: document.getElementById('transaction-modal'),
		transactionForm: document.getElementById('transaction-form'),
		cancelTransactionBtn: document.getElementById('cancel-transaction-btn'),
		filterType: document.getElementById('filter-type'),
		filterMonth: document.getElementById('filter-month'),
		toastContainer: document.getElementById('toast-container'),
		themeSelector: document.getElementById('theme-selector'),
		transactionListBody: document.getElementById('transaction-list-body'),
		allocationChart: document.getElementById('allocation-chart')
	},

	init() {
		this.applyTheme(this.state.theme);
		this.bindEvents();
		this.checkAuth();
	},

	bindEvents() {
		this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
		this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
		this.elements.addTransactionBtn.addEventListener('click', () => {
			this.elements.transactionForm.reset();
			this.elements.transactionForm.querySelector('input[name="id"]').value = '';
			const dateInput = this.elements.transactionForm.querySelector('input[name="date"]');
			if (dateInput) dateInput.valueAsDate = new Date();
			this.showModal();
		});
		this.elements.cancelTransactionBtn.addEventListener('click', () => this.hideModal());
		this.elements.transactionForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));

		// Filter Events
		this.elements.filterType.addEventListener('change', (e) => {
			const type = e.target.value;
			this.state.filterParams.type = type;

			// Toggle month input visibility
			if (type === 'month') {
				this.elements.filterMonth.classList.remove('hidden');
			} else {
				this.elements.filterMonth.classList.add('hidden');
			}

			this.fetchTransactions();
		});

		this.elements.filterMonth.addEventListener('change', (e) => {
			this.state.filterParams.month = e.target.value;
			this.fetchTransactions();
		});

		// Init filter inputs
		this.elements.filterMonth.value = this.state.filterParams.month;

		if (this.elements.themeSelector) {
			this.elements.themeSelector.value = this.state.theme;
			this.elements.themeSelector.addEventListener('change', (e) => {
				this.applyTheme(e.target.value);
			});
		}

		// Date input default to today
		const dateInput = this.elements.transactionForm.querySelector('input[name="date"]');
		if (dateInput) {
			dateInput.valueAsDate = new Date();
		}
	},

	async checkAuth() {
		// Simple check if user data exists in localStorage (Mock session persistence)
		const user = localStorage.getItem('parfin_user');
		if (user) {
			this.state.currentUser = JSON.parse(user);
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
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			const result = await response.json();

			if (response.ok) {
				this.state.currentUser = result.user;
				localStorage.setItem('parfin_user', JSON.stringify(result.user));
				this.showDashboard();
				this.showToast('Chào mừng trở lại!', 'success');
			} else {
				this.showToast(result.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!', 'error');
			}
		} catch (err) {
			this.showToast('Lỗi kết nối', 'error');
		}
	},

	handleLogout() {
		this.state.currentUser = null;
		localStorage.removeItem('parfin_user');
		this.showLogin();
	},

	showLogin() {
		this.elements.loginView.classList.remove('hidden');
		this.elements.dashboardView.classList.add('hidden');
	},

	showDashboard() {
		this.elements.loginView.classList.add('hidden');
		this.elements.dashboardView.classList.remove('hidden');
		this.elements.userDisplayName.textContent = this.state.currentUser.username;
		this.fetchTransactions();
	},

	async fetchTransactions() {
		try {
			const userId = 1; // Hack: For this simple version without session cookies

			let url = '/api/transactions';
			if (this.state.filterParams.type === 'month') {
				url += `?month=${this.state.filterParams.month}`;
			}

			const response = await fetch(url);
			if (response.ok) {
				const transactions = await response.json();
				this.state.transactions = transactions;
				this.renderTransactions();
				this.updateStats();
				this.updateChart();
			}
		} catch (err) {
			console.error('Failed to fetch transactions', err);
		}
	},

	async handleTransactionSubmit(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());

		// Add user_id (Mocking logic, server should infer from session)
		data.user_id = 1;

		const isEdit = !!data.id;
		const url = isEdit ? '/api/transactions/update' : '/api/transactions/create';

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (response.ok) {
				this.hideModal();
				this.elements.transactionForm.reset();
				this.fetchTransactions();
				this.showToast(isEdit ? 'Cập nhật thành công!' : 'Thêm giao dịch thành công!', 'success');
			} else {
				this.showToast('Có lỗi xảy ra', 'error');
			}
		} catch (err) {
			this.showToast('Lỗi lưu giao dịch', 'error');
		}
	},

	async deleteTransaction(id) {
		if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;

		try {
			const response = await fetch('/api/transactions/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			if (response.ok) {
				this.fetchTransactions();
				this.showToast('Đã xóa giao dịch', 'success');
			} else {
				this.showToast('Lỗi khi xóa', 'error');
			}
		} catch (err) {
			this.showToast('Lỗi kết nối', 'error');
		}
	},

	editTransaction(id) {
		const transaction = this.state.transactions.find(t => t.id === id);
		if (!transaction) return;

		const form = this.elements.transactionForm;
		form.id.value = transaction.id;
		form.amount.value = transaction.amount;
		form.type.value = transaction.type; // Radio buttons need manual check if necessary, but value setting often works for radio groups if named correctly? No, usually need to check specific radio.

		// Handle radio buttons for type
		const typeRadios = form.querySelectorAll('input[name="type"]');
		typeRadios.forEach(radio => {
			radio.checked = radio.value === transaction.type;
		});

		form.category.value = transaction.category;
		form.description.value = transaction.description || '';
		form.date.value = transaction.date;
		form.source.value = transaction.source || 'cash';

		this.showModal();
		// Update modal title logic could go here
	},

	renderTransactions() {
		const tbody = this.elements.transactionListBody;
		tbody.innerHTML = '';

		if (this.state.transactions.length === 0) {
			tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary" style="padding: 2rem">Chưa có giao dịch nào.</td></tr>';
			return;
		}

		this.state.transactions.forEach(t => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm hovering-row';
			tr.style.borderColor = 'var(--bg-accent)';

			const isExpense = t.type === 'expense';
			const sign = isExpense ? '-' : '+';
			const colorClass = isExpense ? 'text-danger' : 'text-success';
			const categoryName = this.getCategoryName(t.category);
			const sourceName = t.source === 'bank' ? '🏦 Ngân hàng' : '💵 Tiền mặt';

			tr.innerHTML = `
                <td class="p-4">${new Date(t.date).toLocaleDateString('vi-VN')}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        <span>${this.getCategoryIcon(t.category)}</span>
                        <span>${categoryName}</span>
                    </div>
                </td>
                <td class="p-4 text-secondary">${t.description || '-'}</td>
                <td class="p-4 text-right font-bold ${colorClass}">${sign} ${this.formatCurrency(t.amount)}</td>
                <td class="p-4 text-secondary">${sourceName}</td>
                <td class="p-4 text-right">
                    <button class="btn-icon edit-btn" data-id="${t.id}" style="margin-right: 0.5rem">✏️</button>
                    <button class="btn-icon delete-btn" data-id="${t.id}">🗑️</button>
                </td>
            `;
			tbody.appendChild(tr);
		});

		// Delegate events
		tbody.querySelectorAll('.edit-btn').forEach(btn => {
			btn.addEventListener('click', () => this.editTransaction(parseInt(btn.dataset.id)));
		});
		tbody.querySelectorAll('.delete-btn').forEach(btn => {
			btn.addEventListener('click', () => this.deleteTransaction(parseInt(btn.dataset.id)));
		});
	},

	updateStats() {
		const transactions = this.state.transactions;
		const total = transactions.reduce((acc, t) => {
			return t.type === 'income' ? acc + t.amount : acc - t.amount;
		}, 0);

		const income = transactions
			.filter(t => t.type === 'income')
			.reduce((acc, t) => acc + t.amount, 0);

		const expense = transactions
			.filter(t => t.type === 'expense')
			.reduce((acc, t) => acc + t.amount, 0);

		this.elements.totalBalance.textContent = this.formatCurrency(total);
		this.elements.monthlyIncome.textContent = this.formatCurrency(income);
		this.elements.monthlyExpense.textContent = this.formatCurrency(expense);
	},

	updateChart() {
		const ctx = this.elements.allocationChart ? this.elements.allocationChart.getContext('2d') : null;
		if (!ctx) return;

		// Filter for expenses
		const expenses = this.state.transactions.filter(t => t.type === 'expense');

		// Aggregate by category and source
		const categoryData = {};

		expenses.forEach(t => {
			if (!categoryData[t.category]) {
				categoryData[t.category] = { cash: 0, bank: 0 };
			}
			const source = t.source === 'bank' ? 'bank' : 'cash';
			categoryData[t.category][source] += t.amount;
		});

		const labels = Object.keys(categoryData).map(cat => this.getCategoryName(cat));
		const cashData = Object.values(categoryData).map(d => d.cash);
		const bankData = Object.values(categoryData).map(d => d.bank);

		if (this.state.chart) {
			this.state.chart.destroy();
		}

		this.state.chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [
					{
						label: 'Tiền mặt',
						data: cashData,
						backgroundColor: '#4BC0C0',
					},
					{
						label: 'Ngân hàng',
						data: bankData,
						backgroundColor: '#36A2EB',
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						stacked: true,
					},
					y: {
						stacked: true,
						beginAtZero: true
					}
				},
				plugins: {
					tooltip: {
						callbacks: {
							label: (context) => {
								// Add percentage logic if desired, or just amount as planned
								let label = context.dataset.label || '';
								if (label) {
									label += ': ';
								}
								if (context.parsed.y !== null) {
									label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.parsed.y);
								}
								return label;
							}
						}
					}
				}
			}
		});
	},

	formatCurrency(amount) {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
	},

	getCategoryIcon(category) {
		const icons = {
			'Food': '🍜',
			'Transport': '🚗',
			'Shopping': '🛍️',
			'Bills': '💡',
			'Entertainment': '🎬',
			'Health': '💊',
			'Salary': '💰',
			'Other': '📝'
		};
		return icons[category] || '📝';
	},

	getCategoryName(categoryKey) {
		const names = {
			'Food': 'Ăn uống',
			'Transport': 'Di chuyển',
			'Shopping': 'Mua sắm',
			'Bills': 'Hóa đơn',
			'Entertainment': 'Giải trí',
			'Health': 'Sức khỏe',
			'Salary': 'Lương',
			'Other': 'Khác'
		};
		return names[categoryKey] || categoryKey;
	},

	showModal() {
		this.elements.transactionModal.classList.remove('hidden');
		// If opening for add (no id set), ensure form is cleared if needed; or just rely on reset() call after submit? 
		// Better to check: if user clicked "Add", form might need reset if previously edited.
		// But here we can't distinguish who called showModal easily without args.
	},

	hideModal() {
		this.elements.transactionModal.classList.add('hidden');
	},

	showToast(message, type = 'info') {
		const toast = document.createElement('div');
		toast.className = 'toast';
		toast.textContent = message;
		if (type === 'error') toast.style.borderColor = 'var(--danger)';
		if (type === 'success') toast.style.borderColor = 'var(--success)';

		this.elements.toastContainer.appendChild(toast);

		setTimeout(() => {
			toast.remove();
		}, 3000);
	},

	applyTheme(theme) {
		this.state.theme = theme;
		localStorage.setItem('parfin_theme', theme);

		// Remove existing theme attributes
		document.documentElement.removeAttribute('data-theme');

		if (theme === 'dark') {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else if (theme === 'light') {
			document.documentElement.setAttribute('data-theme', 'light');
		}
		// 'system' uses no attribute, falling back to media query
	}
};

document.addEventListener('DOMContentLoaded', () => {
	App.init();
});
