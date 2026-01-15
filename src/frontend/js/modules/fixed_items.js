
import { Api } from '../api.js';
import { state } from '../state.js';
import { t, showToast, formatCurrency, getCategoryName } from '../utils.js';

export const FixedItems = {
	init() {
		const btn = document.getElementById('fixed-items-btn');
		if (btn) btn.addEventListener('click', () => this.showModal());

		document.addEventListener('modals:loaded', () => this.bindEvents());
		if (document.getElementById('fixed-items-modal')) this.bindEvents();

		document.addEventListener('settings:updated', () => this.render());
	},

	bindEvents() {
		const modal = document.getElementById('fixed-items-modal');
		if (!modal || modal.dataset.bound) return;

		document.getElementById('close-fixed-modal-btn').addEventListener('click', () => {
			modal.classList.add('hidden');
		});

		document.getElementById('add-fixed-item-btn').addEventListener('click', () => {
			this.openForm();
		});

		document.getElementById('generate-fixed-btn').addEventListener('click', () => {
			this.generateTransactions();
		});

		// Form
		const formModal = document.getElementById('fixed-item-form-modal');
		const form = document.getElementById('fixed-item-form');

		document.getElementById('cancel-fixed-form-btn').addEventListener('click', () => {
			formModal.classList.add('hidden');
		});

		form.addEventListener('submit', (e) => this.handleSubmit(e));

		// Type toggle logic
		form.querySelectorAll('input[name="type"]').forEach(r => {
			r.addEventListener('change', () => this.updateFormState());
		});

		modal.dataset.bound = "true";
	},

	showModal() {
		document.getElementById('fixed-items-modal').classList.remove('hidden');
		this.fetchAndRender();
	},

	async fetchAndRender() {
		try {
			const items = await Api.getFixedItems();
			state.fixedItems = items;
			this.render();
		} catch (e) {
			console.error(e);
		}
	},

	render() {
		const tbody = document.getElementById('fixed-items-list-body');
		if (!tbody) return;
		tbody.innerHTML = '';

		const items = state.fixedItems || [];

		const generateBtn = document.getElementById('generate-fixed-btn');
		if (generateBtn) {
			if (items.length === 0) {
				generateBtn.disabled = true;
				generateBtn.classList.add('opacity-50', 'cursor-not-allowed');
			} else {
				generateBtn.disabled = false;
				generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
			}
		}

		if (items.length === 0) {
			tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-secondary">${t('no_transactions')}</td></tr>`;
			return;
		}

		items.forEach(item => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm';
			tr.style.borderColor = 'var(--bg-accent)';

			tr.innerHTML = `
                <td class="p-4">${getCategoryName(item.category)}</td>
                <td class="p-4">${item.description}</td>
                <td class="p-4 text-right font-bold">${formatCurrency(item.amount, item.currency || 'VND')}</td>
                <td class="p-4 capitalize">${item.type}</td>
                <td class="p-4 text-right">
                    <button class="btn-icon delete-btn"><i class="fa-solid fa-trash"></i></button>
                </td>
             `;

			tr.querySelector('.delete-btn').addEventListener('click', () => this.handleDelete(item.id));
			tbody.appendChild(tr);
		});
	},

	openForm() {
		const form = document.getElementById('fixed-item-form');
		form.reset();
		form.querySelector('input[name="id"]').value = '';
		this.updateFormState();
		document.getElementById('fixed-item-form-modal').classList.remove('hidden');
	},

	updateFormState() {
		const form = document.getElementById('fixed-item-form');
		const typeRadios = form.querySelectorAll('input[name="type"]');
		let type = 'expense';
		typeRadios.forEach(r => { if (r.checked) type = r.value; });

		const categorySelect = document.getElementById('fixed-category-select');

		// Grid Logic
		const sourceSection = document.getElementById('fixed-source-section');
		const destGroup = document.getElementById('fixed-destination-group');
		const sourceTitle = document.getElementById('fixed-source-title');
		const transferGrid = document.getElementById('fixed-transfer-grid');


		if (type === 'allocation') {
			sourceSection.classList.add('source-section');
			transferGrid.classList.remove('transfer-grid-default');
			transferGrid.classList.add('transfer-grid');

			sourceTitle.classList.remove('hidden');
			sourceTitle.textContent = t('source_from_title');
			destGroup.classList.remove('hidden');
		} else {
			sourceSection.classList.remove('source-section');
			transferGrid.classList.add('transfer-grid-default');
			transferGrid.classList.remove('transfer-grid');

			sourceTitle.textContent = t('source_details_title');
			if (type === 'income') {
				sourceTitle.classList.add('hidden');
			} else {
				sourceTitle.classList.remove('hidden');
			}
			destGroup.classList.add('hidden');
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
		const useFundGroup = document.getElementById('fixed-use-fund-group');
		if (type === 'expense') {
			useFundGroup.classList.remove('hidden');
		} else {
			useFundGroup.classList.add('hidden');
			form.fund.value = '';
		}

		// Dest Category (Allocation)
		if (type === 'allocation') {
			const destSelect = form.querySelector('select[name="destination_category"]');
			// Check if we have a preserved value if needed, but for fixed items usually clean slate or edit.
			// On Edit, we should probably set value after this call.

			destSelect.innerHTML = '<option value="" disabled selected>Select Destination Category</option>';
			const destCats = ['Saving', 'Support', 'Investment', 'Together', 'Salary', 'Other'];
			destCats.forEach(cat => {
				const option = document.createElement('option');
				option.value = cat;
				option.textContent = getCategoryName(cat);
				destSelect.appendChild(option);
			});
		}
	},

	async handleSubmit(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());
		data.user_id = 1;

		try {
			const response = await Api.saveFixedItem(data);
			if (response) { // saveFixedItem returns bool true/false or object? Api.js says: return response.ok
				document.getElementById('fixed-item-form-modal').classList.add('hidden');
				this.fetchAndRender();
				showToast(t('toast_save_success'), 'success');
			} else {
				showToast(t('toast_save_error'), 'error');
			}
		} catch (err) {
			showToast(t('toast_error'), 'error');
		}
	},

	async handleDelete(id) {
		if (!confirm(t('toast_delete_confirm'))) return;
		await Api.deleteFixedItem(id);
		this.fetchAndRender();
	},

	async generateTransactions() {
		if (!confirm('Generate transactions for this month?')) return;
		const date = new Date().toISOString().slice(0, 10);
		try {
			const res = await Api.generateFixedTransactions({ date, user_id: 1 });
			if (res.ok && res.data.success) {
				showToast(`Generated ${res.data.count} transactions`, 'success');
				document.getElementById('fixed-items-modal').classList.add('hidden');
				document.dispatchEvent(new Event('transactions:updated'));
			} else {
				showToast(res.data.message || t('toast_error'), 'error');
			}
		} catch (e) {
			showToast(t('toast_error'), 'error');
		}
	}
};
