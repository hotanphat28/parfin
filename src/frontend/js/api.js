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
		const response = await fetch('/api/auth/check');
		return response.ok;
	},

	async getTransactions(params = {}) {
		let url = '/api/transactions';
		const queryParams = [];
		if (params.month) queryParams.push(`month=${params.month}`); // Legacy
		if (params.period) queryParams.push(`period=${params.period}`);
		if (params.start_date) queryParams.push(`start_date=${params.start_date}`);
		if (params.end_date) queryParams.push(`end_date=${params.end_date}`);
		if (params.category && params.category !== 'all') queryParams.push(`category=${params.category}`);
		if (params.type && params.type !== 'all') queryParams.push(`type=${params.type}`);
		if (params.sort_by) queryParams.push(`sort_by=${params.sort_by}`);
		if (params.order) queryParams.push(`order=${params.order}`);

		if (queryParams.length > 0) {
			url += '?' + queryParams.join('&');
		}
		const response = await fetch(url);
		if (!response.ok) throw new Error('Failed to fetch transactions');
		return await response.json();
	},

	async getStats(params = {}) {
		let url = '/api/stats';
		const queryParams = [];
		if (params.period) queryParams.push(`period=${params.period}`);
		if (params.start_date) queryParams.push(`start_date=${params.start_date}`);
		if (params.end_date) queryParams.push(`end_date=${params.end_date}`);
		if (params.currency) queryParams.push(`currency=${params.currency}`);

		if (queryParams.length > 0) {
			url += '?' + queryParams.join('&');
		}
		const response = await fetch(url);
		if (!response.ok) throw new Error('Failed to fetch stats');
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
		return { ok: response.ok, status: response.status, data: await response.json() };
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

	async getInvestmentPortfolio(params = {}) {
		let url = '/api/investments/portfolio';
		const queryParams = [];
		if (params.currency) queryParams.push(`currency=${params.currency}`);

		if (queryParams.length > 0) {
			url += '?' + queryParams.join('&');
		}

		const response = await fetch(url);
		if (!response.ok) throw new Error('Failed to fetch portfolio');
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
	},

	// Admin / User Management
	async getUsers() {
		const response = await fetch('/api/users');
		if (!response.ok) throw new Error('Failed to fetch users');
		return await response.json();
	},

	async createUser(data) {
		const response = await fetch('/api/users/create', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return { ok: response.ok, status: response.status, data: await response.json() };
	},

	async deleteUser(id) {
		const response = await fetch('/api/users/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		return response.ok;
	}
};
