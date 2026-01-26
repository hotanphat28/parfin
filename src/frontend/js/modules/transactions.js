
import { Api } from '../api.js';
import { state } from '../state.js';
import { t, formatCurrency, getCategoryIcon, getCategoryName, showToast, convertAmount } from '../utils.js';

export const Transactions = {
	init() {
		// Static Header Actions (Always in index.html)
		const addBtn = document.getElementById('add-transaction-btn');
		if (addBtn) {
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
			if (!document.getElementById('view-monthly').classList.contains('hidden')) {
				this.fetchAndRender();
			}
		});
		document.addEventListener('settings:updated', () => {
			this.fetchAndRender(); // Re-fetch stats with new currency/rate
		});
	},

	onViewLoaded() {
		this.bindTableEvents();
		this.bindChartEvents();
		this.fetchAndRender(); // Fetch new data
	},

	bindChartEvents() {
		const toggleBtn = document.getElementById('toggle-chart-btn');
		const chartContainer = document.getElementById('chart-container');

		if (toggleBtn && chartContainer) {
			const isVisible = localStorage.getItem('parfin_chart_visible') !== 'false';
			if (!isVisible) {
				chartContainer.classList.add('chart-collapsed');
				toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i>';
			} else {
				toggleBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
			}

			if (toggleBtn.dataset.bound) return;

			toggleBtn.addEventListener('click', () => {
				const isHidden = chartContainer.classList.contains('chart-collapsed');
				if (isHidden) {
					chartContainer.classList.remove('chart-collapsed');
					toggleBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
					this.updateChart();
				} else {
					chartContainer.classList.add('chart-collapsed');
					toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i>';
				}
				localStorage.setItem('parfin_chart_visible', !isHidden);
			});
			toggleBtn.dataset.bound = "true";
		}
	},

	bindModalEvents() {
		const form = document.getElementById('transaction-form');
		if (!form || form.dataset.bound) return;

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
		const filterStartDate = document.getElementById('filter-start-date');
		const filterEndDate = document.getElementById('filter-end-date');
		const filterCategory = document.getElementById('filter-category');

		if (filterPeriod && !filterPeriod.dataset.bound) {
			filterPeriod.value = state.filterParams.period || 'this_month';
			filterPeriod.addEventListener('change', (e) => {
				const period = e.target.value;
				state.filterParams.period = period;

				// Reset custom dates if switching away from custom
				if (period !== 'custom') {
					state.filterParams.start_date = null;
					state.filterParams.end_date = null;
				}

				this.updateFilterUI();
				this.fetchAndRender();
			});
			filterPeriod.dataset.bound = "true";
		}

		// Populate Categories
		if (filterCategory && !filterCategory.dataset.populated) {
			const categories = ['Salary', 'Rent', 'Utilities', 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Debt', 'Personal', 'Saving', 'Support', 'Investment', 'Other'];
			filterCategory.innerHTML = '<option value="all" data-i18n="filter_all_categories">All Categories</option>';
			categories.forEach(cat => {
				const option = document.createElement('option');
				option.value = cat;
				option.textContent = getCategoryName(cat);
				filterCategory.appendChild(option);
			});
			if (state.filterParams.category) filterCategory.value = state.filterParams.category;

			filterCategory.addEventListener('change', (e) => {
				state.filterParams.category = e.target.value;
				this.fetchAndRender();
			});
			filterCategory.dataset.populated = "true";
		}

		const dateChangeHandler = () => {
			state.filterParams.start_date = filterStartDate.value;
			state.filterParams.end_date = filterEndDate.value;
			if (state.filterParams.start_date && state.filterParams.end_date) {
				this.fetchAndRender();
			}
		};

		if (filterStartDate && !filterStartDate.dataset.bound) {
			filterStartDate.addEventListener('change', dateChangeHandler);
			filterStartDate.dataset.bound = "true";
		}
		if (filterEndDate && !filterEndDate.dataset.bound) {
			filterEndDate.addEventListener('change', dateChangeHandler);
			filterEndDate.dataset.bound = "true";
		}

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
		const filterCustomDates = document.getElementById('filter-custom-dates');
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
			this.render();
			this.renderStats(stats);
		} catch (err) {
			console.error('Error fetching data:', err);
			const tbody = document.getElementById('transaction-list-body');
			if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center p-4">Error loading data.</td></tr>`;
		}
	},

	computeParams() {
		// Simply merge filters and sort params
		const params = {
			...state.filterParams,
			...state.sortParams
		};
		// No date calculation here anymore. Passed as 'period' or 'start_date/end_date'
		return params;
	},

	// Legacy method support if needed
	async fetchTransactions() {
		this.fetchAndRender();
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
		const { field, direction } = state.sortParams;

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

		// Render Rows (Data is already sorted from backend)
		transactions.forEach(transaction => {
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

		form.dataset.targetFund = transaction.fund || '';
		form.dataset.targetSource = transaction.source || 'cash';

		if (transaction.type === 'allocation') {
			form.dataset.targetDestCategory = transaction.destination_category || '';
		}

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

		const sourceSection = document.getElementById('source-section');
		const destGroup = document.getElementById('destination-group');
		const sourceTitle = document.getElementById('source-title');

		if (type === 'allocation') {
			sourceSection.classList.add('source-section');
			sourceSection.classList.add('modal-section');
			sourceTitle.classList.remove('hidden');
			sourceTitle.textContent = t('source_from_title');

			destGroup.classList.remove('hidden');
			destGroup.classList.add('modal-section');
		} else {
			sourceSection.classList.remove('source-section');
			sourceSection.classList.remove('modal-section');
			sourceTitle.textContent = t('source_details_title');

			destGroup.classList.add('hidden');
			destGroup.classList.remove('modal-section');
		}

		categorySelect.innerHTML = '';
		let categories = [];
		if (type === 'income') {
			categories = ['Salary', 'Saving', 'Support', 'Investment', 'Other'];
		} else if (type === 'allocation') {
			categories = ['Salary', 'Other', 'Saving', 'Support', 'Investment', 'Together'];
		} else {
			categories = ['Rent', 'Utilities', 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Debt', 'Personal', 'Other'];
		}

		categories.forEach(cat => {
			const option = document.createElement('option');
			option.value = cat;
			option.textContent = getCategoryName(cat);
			categorySelect.appendChild(option);
		});

		const useFundGroup = document.getElementById('use-fund-group');
		if (type === 'expense') {
			useFundGroup.classList.remove('hidden');
		} else {
			useFundGroup.classList.add('hidden');
			form.fund.value = '';
		}

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
				this.fetchAndRender();
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
		// Update sort state only, api called in fetchAndRender
		if (state.sortParams.field === field) {
			state.sortParams.order = state.sortParams.order === 'asc' ? 'desc' : 'asc';
			// Sync with 'direction' for frontend legacy if needed
			state.sortParams.direction = state.sortParams.order;
		} else {
			state.sortParams.field = field;
			state.sortParams.order = 'desc';
			state.sortParams.direction = 'desc';
		}
		this.fetchAndRender();
	},

	renderStats(stats) {
		const { balances, period_stats, chart_data } = stats;
		const targetCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

		// Helper to format without conversion (since backend already converted)
		const fmtDirect = (val) => {
			const locale = state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
			return new Intl.NumberFormat(locale, { style: 'currency', currency: targetCurrency }).format(val);
		};
		const updateTextDirect = (id, val) => {
			const el = document.getElementById(id);
			if (el) el.textContent = fmtDirect(val);
		};

		// Use Grand Total from backend
		updateTextDirect('total-balance', balances.grand_total);
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

		state.balances = balances;

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

		const totals = chartData.datasets.cash.map((c, i) => c + chartData.datasets.bank[i]);

		state.chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [
					{
						label: t('chart_total'),
						data: totals,
						type: 'line',
						borderColor: '#FFC90E',
						backgroundColor: '#FFC90E',
						borderWidth: 2,
						fill: false,
						order: 1
					},
					{
						label: t('chart_cash'),
						data: chartData.datasets.cash,
						backgroundColor: '#10b981',
						order: 2
					},
					{
						label: t('chart_bank'),
						data: chartData.datasets.bank,
						backgroundColor: '#3b82f6',
						order: 3
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
									return label + new Intl.NumberFormat(locale, { style: 'currency', currency: targetCurrency }).format(context.parsed.y);
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
