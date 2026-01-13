
export const Api = {
	async login(data) {
		const response = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return { ok: response.ok, status: response.status, data: await response.json() };
	},

	async checkAuth() {
		// Since we are using localStorage mock in frontend for now, 
		// this might just call an endpoint if we had sessions.
		// For now, minimal.
		const response = await fetch('/api/auth/check');
		return response.ok;
	},

	async getTransactions(params = {}) {
		let url = '/api/transactions';
		if (params.month) {
			url += `?month=${params.month}`;
		}
		const response = await fetch(url);
		if (!response.ok) throw new Error('Failed to fetch transactions');
		return await response.json();
	},

	async saveTransaction(data) {
		const isEdit = !!data.id;
		const url = isEdit ? '/api/transactions/update' : '/api/transactions/create';
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return { ok: response.ok, status: response.status, data: await response.json() }; // Some endpoints return empty body or basic success
	},

	async deleteTransaction(id) {
		const response = await fetch('/api/transactions/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		return response.ok;
	},

	async getInvestments() {
		const response = await fetch('/api/investments');
		if (!response.ok) throw new Error('Failed to fetch investments');
		return await response.json();
	},

	async saveInvestment(data) {
		const response = await fetch('/api/investments/create', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return response.ok;
	},

	async deleteInvestment(id) {
		const response = await fetch('/api/investments/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		return response.ok;
	},

	async getSettings() {
		const response = await fetch('/api/settings');
		if (!response.ok) throw new Error('Failed to fetch settings');
		return await response.json();
	},

	async updateSettings(data) {
		const response = await fetch('/api/settings/update', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return response.ok;
	},

	async getFixedItems() {
		const response = await fetch('/api/fixed_items');
		if (!response.ok) throw new Error('Failed to fetch fixed items');
		return await response.json();
	},

	async saveFixedItem(data) {
		const isEdit = !!data.id;
		const url = isEdit ? '/api/fixed_items/update' : '/api/fixed_items/create';
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return response.ok;
	},

	async deleteFixedItem(id) {
		const response = await fetch('/api/fixed_items/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		return response.ok;
	},

	async generateFixedTransactions(data) {
		const response = await fetch('/api/fixed_items/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return { ok: response.ok, data: await response.json() };
	},

	async importData(data) {
		const response = await fetch('/api/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return { ok: response.ok, status: response.status, data: await response.json() };
	}
};
