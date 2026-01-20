
import { Api } from '../api.js';
import { state } from '../state.js';
import { t, formatCurrency, getCategoryIcon, getCategoryName, showToast, convertAmount } from '../utils.js';

export const Transactions = {
	init() {
		// Static Header Actions (Always in index.html)
		const addBtn = document.getElementById('add-transaction-btn');
		if (addBtn) {
			// Remove existing to be safe (optional, but good practice if called multiple times)
			const newBtn = addBtn.cloneNode(true);
			addBtn.parentNode.replaceChild(newBtn, addBtn);
			newBtn.addEventListener('click', () => this.openAddModal());
		}

		// Handle Form (Modals might be loaded later)
		if (document.getElementById('transaction-form')) {
			this.bindModalEvents();
		}
		document.addEventListener('modals:loaded', () => this.bindModalEvents());

		// Listen for other events
		document.addEventListener('auth:login_success', () => {
			// If view is already active, fetch
			if (!document.getElementById('view-monthly').classList.contains('hidden')) {
				this.fetchAndRender();
			}
		});
		document.addEventListener('settings:updated', () => {
			this.fetchAndRender(); // Re-fetch stats with new currency/rate
		});
	},

	onViewLoaded() {
		// Called when Monthly View is injected
		this.bindTableEvents();
		this.bindChartEvents();
		this.fetchAndRender(); // Fetch new data
	},

	bindChartEvents() {
		const toggleBtn = document.getElementById('toggle-chart-btn');
		const chartContainer = document.getElementById('chart-container');

		if (toggleBtn && chartContainer) {
			// Restore state
			const isVisible = localStorage.getItem('parfin_chart_visible') !== 'false';
			if (!isVisible) {
				chartContainer.classList.add('hidden');
				toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i>';
			} else {
				toggleBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
			}

			// Prevent duplicate binding
			if (toggleBtn.dataset.bound) return;

			toggleBtn.addEventListener('click', () => {
				const isHidden = chartContainer.classList.contains('hidden');
				if (isHidden) {
					chartContainer.classList.remove('hidden');
					toggleBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
					this.updateChart();
				} else {
					chartContainer.classList.add('hidden');
					toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i>';
				}
				localStorage.setItem('parfin_chart_visible', !isHidden);
			});
			toggleBtn.dataset.bound = "true";
		}
	},

	bindModalEvents() {
		const form = document.getElementById('transaction-form');
		if (!form || form.dataset.bound) return; // Prevent double binding

		const cancelBtn = document.getElementById('cancel-transaction-btn');
		if (cancelBtn) {
			const newBtn = cancelBtn.cloneNode(true);
			cancelBtn.parentNode.replaceChild(newBtn, cancelBtn);
			newBtn.addEventListener('click', () => this.hideModal());
		}

		form.addEventListener('submit', (e) => this.handleSubmit(e));

		const typeRadios = form.querySelectorAll('input[name="type"]');
		typeRadios.forEach(radio => {
			radio.addEventListener('change', () => this.updateFormState());
		});

		form.dataset.bound = "true";
	},

	bindTableEvents() {
		// Filter Elements
		const filterPeriod = document.getElementById('filter-period');
		const filterCustomDates = document.getElementById('filter-custom-dates');
		const filterStartDate = document.getElementById('filter-start-date');
		const filterEndDate = document.getElementById('filter-end-date');
		const filterCategory = document.getElementById('filter-category');

		// Only bind if filterPeriod exists and hasn't been bound
		if (filterPeriod && !filterPeriod.dataset.bound) {
			filterPeriod.value = state.filterParams.period || 'this_month';
			filterPeriod.addEventListener('change', (e) => {
				console.log('Filter changed:', e.target.value);
				const period = e.target.value;
				state.filterParams.period = period;
				this.updateFilterUI();
				this.fetchAndRender();
			});
			filterPeriod.dataset.bound = "true";
		}

		// Populate Categories
		if (filterCategory && !filterCategory.dataset.populated) {
			const categories = ['Salary', 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Debt', 'Personal', 'Saving', 'Support', 'Investment', 'Other'];
			filterCategory.innerHTML = '<option value="all" data-i18n="filter_all_categories">All Categories</option>';
			categories.forEach(cat => {
				const option = document.createElement('option');
				option.value = cat;
				option.textContent = getCategoryName(cat);
				filterCategory.appendChild(option);
			});
			// Restore value
			if (state.filterParams.category) filterCategory.value = state.filterParams.category;

			filterCategory.addEventListener('change', (e) => {
				console.log('Category changed:', e.target.value);
				state.filterParams.category = e.target.value;
				this.fetchAndRender();
			});
			filterCategory.dataset.populated = "true";
		}

		const dateChangeHandler = () => {
			console.log('Custom dates changed');
			state.filterParams.startDate = filterStartDate.value;
			state.filterParams.endDate = filterEndDate.value;
			this.fetchAndRender();
		};

		if (filterStartDate && !filterStartDate.dataset.bound) {
			filterStartDate.addEventListener('change', dateChangeHandler);
			filterStartDate.dataset.bound = "true";
		}
		if (filterEndDate && !filterEndDate.dataset.bound) {
			filterEndDate.addEventListener('change', dateChangeHandler);
			filterEndDate.dataset.bound = "true";
		}

		// Initial UI State
		this.updateFilterUI();

		// Sorting
		document.querySelectorAll('th[data-sort]').forEach(th => {
			if (!th.dataset.bound) {
				th.addEventListener('click', () => {
					this.handleSort(th.dataset.sort);
				});
				th.dataset.bound = "true";
			}
		});
	},

	updateFilterUI() {
		const filterPeriod = document.getElementById('filter-period');
		const filterCustomDates = document.getElementById('filter-custom-dates');

		// Check if elements exist before trying to access classList
		if (!filterCustomDates) return;

		if (state.filterParams.period === 'custom') {
			filterCustomDates.classList.remove('hidden');
		} else {
			filterCustomDates.classList.add('hidden');
		}
	},

	async fetchAndRender() {
		const params = this.computeParams();
		// Add currency to params for Stats
		const statsParams = { ...params, currency: state.currentLanguage === 'vi' ? 'VND' : 'USD' };

		try {
			const [transactions, stats] = await Promise.all([
				Api.getTransactions(params),
				Api.getStats(statsParams)
			]);

			state.transactions = transactions;
			console.log('Stats received:', stats);

			this.render();
			this.renderStats(stats);
		} catch (err) {
			console.error('Error fetching data:', err);
			const tbody = document.getElementById('transaction-list-body');
			if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center p-4">Error loading data.</td></tr>`;
		}
	},

	computeParams() {
		const params = { ...state.filterParams };
		const period = params.period || 'this_month';
		const today = new Date();

		const formatDate = (date) => {
			const offset = date.getTimezoneOffset();
			const localDate = new Date(date.getTime() - (offset * 60 * 1000));
			return localDate.toISOString().split('T')[0];
		};

		if (period === 'this_month') {
			const start = new Date(today.getFullYear(), today.getMonth(), 1);
			const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
			params.start_date = formatDate(start);
			params.end_date = formatDate(end);
		} else if (period === 'last_month') {
			const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
			const end = new Date(today.getFullYear(), today.getMonth(), 0);
			params.start_date = formatDate(start);
			params.end_date = formatDate(end);
		} else if (period === 'this_year') {
			const start = new Date(today.getFullYear(), 0, 1);
			const end = new Date(today.getFullYear(), 11, 31);
			params.start_date = formatDate(start);
			params.end_date = formatDate(end);
		} else if (period === 'last_year') {
			const start = new Date(today.getFullYear() - 1, 0, 1);
			const end = new Date(today.getFullYear() - 1, 11, 31);
			params.start_date = formatDate(start);
			params.end_date = formatDate(end);
		} else if (period === 'custom') {
			params.start_date = params.startDate;
			params.end_date = params.endDate;
		}

		console.log('Computed API params:', params);
		return params;
	},

	async fetchTransactions() {
		// Legacy support if called directly, though fetchAndRender is preferred
		const params = this.computeParams();
		try {
			const data = await Api.getTransactions(params);
			state.transactions = data;
			this.render();
		} catch (e) { console.error(e); }
	},

	render() {
		const tbody = document.getElementById('transaction-list-body');
		if (!tbody) return;
		tbody.innerHTML = '';

		const transactions = Array.isArray(state.transactions) ? state.transactions : [];

		if (transactions.length === 0) {
			tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding: 2rem">${t('no_transactions')}</td></tr>`;
			return;
		}

		const locale = state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
		const sortParams = state.sortParams;
		const { field, direction } = sortParams;

		const sortedTransactions = [...transactions].sort((a, b) => {
			if (!a || !b) return 0;
			if (field === 'date') {
				const dateA = new Date(a.date);
				const dateB = new Date(b.date);
				if (isNaN(dateA)) return 1;
				if (isNaN(dateB)) return -1;
				if (dateA < dateB) return direction === 'asc' ? -1 : 1;
				if (dateA > dateB) return direction === 'asc' ? 1 : -1;
				return direction === 'asc' ? ((a.id || 0) - (b.id || 0)) : ((b.id || 0) - (a.id || 0));
			}
			if (field === 'amount') {
				return direction === 'asc' ? (a.amount - b.amount) : (b.amount - a.amount);
			}
			return 0;
		});

		// Update Sort Icons
		document.querySelectorAll('th[data-sort]').forEach(th => {
			const sortField = th.dataset.sort;
			const icon = th.querySelector('.sort-icon');
			if (sortField === field) {
				icon.innerHTML = direction === 'asc' ? ' <i class="fa-solid fa-sort-up"></i>' : ' <i class="fa-solid fa-sort-down"></i>';
				th.classList.add('text-primary');
			} else {
				icon.innerHTML = '';
				th.classList.remove('text-primary');
			}
		});

		sortedTransactions.forEach(transaction => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm hovering-row';
			tr.style.borderColor = 'var(--bg-accent)';

			const isExpense = transaction.type === 'expense';
			let sign = isExpense ? '-' : '+';
			let colorClass = isExpense ? 'text-danger' : 'text-success';

			const categoryName = getCategoryName(transaction.category);
			const sourceName = (transaction.source === 'bank' ? t('source_bank') : t('source_cash'));

			let destName = '';
			if (transaction.type === 'allocation') {
				const destCatName = getCategoryName(transaction.destination_category || 'Transfer');
				destName = ' ➔ ' + destCatName + ' (' + (transaction.destination === 'bank' ? t('source_bank') : t('source_cash')) + ')';
			}

			let fundBadge = '';
			if (transaction.fund) {
				const fundKey = `fund_${transaction.fund.toLowerCase()}`;
				const fundLabel = t(fundKey);
				fundBadge = `<span class="badge badge-info" style="margin-left: 0.5rem; font-size: 0.75rem;">${fundLabel}</span>`;
			} else if (transaction.type === 'allocation') {
				const destCatName = getCategoryName(transaction.destination_category || 'Transfer');
				fundBadge = `<span class="badge badge-warning" style="margin-left: 0.5rem; font-size: 0.75rem;">➔ ${destCatName}</span>`;
			}

			const sourceClass = transaction.source === 'bank' ? 'badge-info' : 'badge-success';
			// Badge-like appearance for Source
			const sourceBadge = `<span class="badge ${sourceClass} bg-opacity-10" style="font-size: 0.75rem;">${sourceName}</span>`;

			tr.innerHTML = `
                <td class="p-4">
                    <input type="checkbox" class="accent-primary cursor-pointer w-4 h-4">
                </td>
                <td class="p-4 font-medium">${new Date(transaction.date).toLocaleDateString(locale)}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        <span class="text-lg w-8 h-8 flex items-center justify-center rounded-full bg-secondary bg-opacity-50">${getCategoryIcon(transaction.category)}</span>
                        <span class="font-medium">${categoryName}</span>
                    </div>
                </td>
                <td class="p-4 text-secondary">${transaction.description || '-'}</td>
                <td class="p-4 text-right font-bold ${colorClass}">${sign} ${formatCurrency(transaction.amount, transaction.currency)}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        ${sourceBadge}
                        ${destName ? '<span class="text-xs text-secondary">' + destName + '</span>' : ''}
                        ${fundBadge}
                    </div>
                </td>
                <td class="p-4">
                    <button class="btn-icon edit-btn text-secondary hover:text-primary"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon delete-btn text-secondary hover:text-danger"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;

			tr.querySelector('.edit-btn').addEventListener('click', () => this.openEditModal(transaction));
			tr.querySelector('.delete-btn').addEventListener('click', () => this.handleDelete(transaction.id));

			tbody.appendChild(tr);
		});
	},

	openAddModal() {
		const form = document.getElementById('transaction-form');
		form.reset();
		form.querySelector('input[name="id"]').value = '';
		const dateInput = form.querySelector('input[name="date"]');
		if (dateInput) dateInput.valueAsDate = new Date();
		document.getElementById('modal-title').textContent = t('modal_add_title');

		delete form.dataset.targetFund;
		delete form.dataset.targetSource;
		delete form.dataset.targetDestCategory;

		this.updateFormState();
		this.showModal();
	},

	openEditModal(transaction) {
		const form = document.getElementById('transaction-form');
		form.id.value = transaction.id;

		// Conversion logic for display
		let displayAmount = convertAmount(transaction.amount, transaction.currency);
		if (state.currentLanguage === 'vi') {
			displayAmount = Math.round(displayAmount);
		} else {
			displayAmount = parseFloat(displayAmount.toFixed(2));
		}
		form.amount.value = displayAmount;

		const typeRadios = form.querySelectorAll('input[name="type"]');
		typeRadios.forEach(radio => {
			radio.checked = radio.value === transaction.type;
		});

		// Dataset for preservation
		form.dataset.targetFund = transaction.fund || '';
		form.dataset.targetSource = transaction.source || 'cash';

		if (transaction.type === 'allocation') {
			form.dataset.targetDestCategory = transaction.destination_category || '';
		}

		// Update form state (rebuilds options) BEFORE setting values
		this.updateFormState();

		form.category.value = transaction.category;
		form.description.value = transaction.description || '';
		form.date.value = transaction.date;
		form.source.value = transaction.source || 'cash';
		form.fund.value = transaction.fund || '';

		if (transaction.type === 'allocation') {
			form.destination.value = transaction.destination || 'bank';
		}

		document.getElementById('modal-title').textContent = t('modal_edit_title');
		this.showModal();
	},

	updateFormState() {
		const form = document.getElementById('transaction-form');
		const typeRadios = form.querySelectorAll('input[name="type"]');
		let type = 'expense';
		typeRadios.forEach(r => { if (r.checked) type = r.value; });

		const categorySelect = form.querySelector('select[name="category"]');

		// Grid Logic
		const sourceSection = document.getElementById('source-section');
		const destGroup = document.getElementById('destination-group');
		const sourceTitle = document.getElementById('source-title');

		if (type === 'allocation') {
			sourceSection.classList.add('source-section');
			sourceSection.classList.add('modal-section'); // Add border
			sourceTitle.classList.remove('hidden');
			sourceTitle.textContent = t('source_from_title');

			destGroup.classList.remove('hidden');
			destGroup.classList.add('modal-section'); // Add border
		} else {
			sourceSection.classList.remove('source-section');
			sourceSection.classList.remove('modal-section'); // Remove border
			sourceTitle.textContent = t('source_details_title');

			destGroup.classList.add('hidden');
			destGroup.classList.remove('modal-section'); // Remove border
		}

		// Categories
		categorySelect.innerHTML = '';
		let categories = [];
		if (type === 'income') {
			categories = ['Salary', 'Saving', 'Support', 'Investment', 'Other'];
		} else if (type === 'allocation') {
			categories = ['Salary', 'Other', 'Saving', 'Support', 'Investment', 'Together'];
		} else {
			categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Debt', 'Personal', 'Other'];
		}

		categories.forEach(cat => {
			const option = document.createElement('option');
			option.value = cat;
			option.textContent = getCategoryName(cat);
			categorySelect.appendChild(option);
		});

		// Use Fund
		const useFundGroup = document.getElementById('use-fund-group');
		if (type === 'expense') {
			useFundGroup.classList.remove('hidden');
		} else {
			useFundGroup.classList.add('hidden');
			form.fund.value = '';
		}

		// Dest Category
		if (type === 'allocation') {
			const destSelect = form.querySelector('select[name="destination_category"]');
			const targetDest = form.dataset.targetDestCategory;
			const current = targetDest !== undefined ? targetDest : destSelect.value;

			destSelect.innerHTML = `<option value="" disabled selected>${t('select_destination_category')}</option>`;
			const destCats = ['Saving', 'Support', 'Investment', 'Together', 'Salary', 'Other'];
			destCats.forEach(cat => {
				const option = document.createElement('option');
				option.value = cat;
				option.textContent = getCategoryName(cat);
				destSelect.appendChild(option);
			});
			if (current && destCats.includes(current)) destSelect.value = current;
		}
	},

	showModal() {
		document.getElementById('transaction-modal').classList.remove('hidden');
	},

	hideModal() {
		document.getElementById('transaction-modal').classList.add('hidden');
	},

	async handleSubmit(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());
		data.user_id = 1;
		data.currency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

		try {
			const result = await Api.saveTransaction(data);
			if (result.ok) {
				this.hideModal();
				showToast(t(data.id ? 'toast_update_success' : 'toast_add_success'), 'success');
				this.fetchAndRender(); // update list
			} else {
				showToast(t('toast_error'), 'error');
			}
		} catch (e) {
			showToast(t('toast_save_error'), 'error');
		}
	},

	async handleDelete(id) {
		if (!confirm(t('toast_delete_confirm'))) return;
		try {
			const ok = await Api.deleteTransaction(id);
			if (ok) {
				showToast(t('toast_delete_success'), 'success');
				this.fetchAndRender();
			} else {
				showToast(t('toast_delete_error'), 'error');
			}
		} catch (e) {
			showToast(t('toast_connect_error'), 'error');
		}
	},

	handleSort(field) {
		if (state.sortParams.field === field) {
			state.sortParams.direction = state.sortParams.direction === 'asc' ? 'desc' : 'asc';
		} else {
			state.sortParams.field = field;
			state.sortParams.direction = 'desc';
		}
		this.render();
	},

	renderStats(stats) {
		const { balances, period_stats, chart_data } = stats;

		const targetCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';
		// Helper to format
		const fmt = (val) => formatCurrency(val, targetCurrency); // Backend already converted, but formatCurrency takes amount and fromCurrency. 
		// Wait, formatCurrency signature is (amount, fromCurrency). It converts inside.
		// BUT backend already returned values in 'targetCurrency' if we requested it.
		// So we should NOT convert again.
		// function formatCurrency(amount, fromCurrency = 'VND') { ... convertAmount ... }
		// Issue: formatCurrency forces conversion.
		// Fix: Pass targetCurrency as fromCurrency to formatCurrency so it skips conversion.

		const updateText = (id, val) => {
			const el = document.getElementById(id);
			if (el) el.textContent = fmt(val);
		};
		// Override helper to avoid double conversion
		const fmtDirect = (val) => {
			const locale = state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
			return new Intl.NumberFormat(locale, { style: 'currency', currency: targetCurrency }).format(val);
		};
		const updateTextDirect = (id, val) => {
			const el = document.getElementById(id);
			if (el) el.textContent = fmtDirect(val);
		};

		const totalAll = balances.total.cash + balances.total.bank +
			balances.saving.cash + balances.saving.bank +
			balances.support.cash + balances.support.bank +
			balances.investment.cash + balances.investment.bank +
			balances.together.cash + balances.together.bank;

		updateTextDirect('total-balance', totalAll);
		updateTextDirect('balance-cash', balances.total.cash);
		updateTextDirect('balance-bank', balances.total.bank);

		// Period Stats
		updateTextDirect('monthly-income', period_stats.income.total);
		updateTextDirect('income-cash', period_stats.income.cash);
		updateTextDirect('income-bank', period_stats.income.bank);
		updateTextDirect('monthly-expense', period_stats.expense.total);
		updateTextDirect('expense-cash', period_stats.expense.cash);
		updateTextDirect('expense-bank', period_stats.expense.bank);

		// Funds
		updateTextDirect('total-saving', balances.saving.cash + balances.saving.bank);
		updateTextDirect('saving-cash', balances.saving.cash);
		updateTextDirect('saving-bank', balances.saving.bank);

		updateTextDirect('total-support', balances.support.cash + balances.support.bank);
		updateTextDirect('support-cash', balances.support.cash);
		updateTextDirect('support-bank', balances.support.bank);

		updateTextDirect('total-investment', balances.investment.cash + balances.investment.bank);
		updateTextDirect('investment-cash', balances.investment.cash);
		updateTextDirect('investment-bank', balances.investment.bank);

		if (document.getElementById('inv-available-cash')) {
			updateTextDirect('inv-available-cash', balances.investment.cash + balances.investment.bank);
		}

		updateTextDirect('total-together', balances.together.cash + balances.together.bank);
		updateTextDirect('together-cash', balances.together.cash);
		updateTextDirect('together-bank', balances.together.bank);

		state.balances = balances; // Store for other uses

		this.renderChart(chart_data);
	},

	renderChart(chartData) {
		const ctx = document.getElementById('allocation-chart');
		if (!ctx) return;

		if (state.chart) {
			state.chart.destroy();
		}
		if (typeof Chart === 'undefined') return;

		const labels = chartData.labels.map(cat => getCategoryName(cat));

		state.chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [
					{
						label: state.currentLanguage === 'vi' ? 'Tiền mặt' : 'Cash',
						data: chartData.datasets.cash,
						backgroundColor: '#4BC0C0',
					},
					{
						label: state.currentLanguage === 'vi' ? 'Ngân hàng' : 'Bank',
						data: chartData.datasets.bank,
						backgroundColor: '#36A2EB',
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
				plugins: {
					tooltip: {
						callbacks: {
							label: (context) => {
								let label = context.dataset.label || '';
								if (label) label += ': ';
								if (context.parsed.y !== null) {
									const targetCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';
									const locale = state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
									label += new Intl.NumberFormat(locale, { style: 'currency', currency: targetCurrency }).format(context.parsed.y);
								}
								return label;
							}
						}
					}
				}
			}
		});
	}
};
