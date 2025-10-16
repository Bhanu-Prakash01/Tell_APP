// Admin Frontend JavaScript - Frappe UI Integration

class AdminApp {
    constructor() {
        this.authBaseURL = '/api/v1/auth';
        this.adminBaseURL = '/api/v1/admin';
        this.token = null;
        this.user = null;
        this.currentPage = this.getCurrentPage();
        console.log('AdminApp initialized for page:', this.currentPage);
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
        if (this.currentPage !== 'login') {
            this.loadPageData();
        }
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('login')) return 'login';
        if (path.includes('dashboard')) return 'dashboard';
        if (path.includes('leads')) return 'leads';
        if (path.includes('lead-assignment')) return 'lead-assignment';
        if (path.includes('user-management')) return 'user-management';
        return 'dashboard';
    }

    // Simple localStorage helpers
    getStoredToken() {
        return localStorage.getItem('adminToken');
    }

    getStoredUser() {
        try {
            const userData = localStorage.getItem('user');
            return userData && userData !== 'undefined' ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error parsing stored user data:', error);
            localStorage.removeItem('user');
            return null;
        }
    }

    setStoredAuth(token, user) {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    clearStoredAuth() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('user');
    }

    setupEventListeners() {
        // Global event listeners
        document.addEventListener('DOMContentLoaded', () => {
            this.initPage();
        });

        // Logout functionality
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="logout"]')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    async checkAuth() {
        console.log('checkAuth called for page:', this.currentPage);

        // Load stored auth data
        this.token = this.getStoredToken();
        this.user = this.getStoredUser();

        if (this.currentPage === 'login') {
            // On login page, if we have stored auth, redirect to dashboard
            if (this.token && this.user) {
                console.log('Found stored auth on login page, redirecting to dashboard');
                window.location.href = '/admin/dashboard';
                return;
            }
            console.log('No stored auth found on login page');
            return;
        }

        // For protected pages, check if we have valid stored auth
        if (!this.token || !this.user) {
            console.log('No stored auth found, redirecting to login');
            window.location.href = '/admin/login';
            return;
        }

        // Try to validate the token with a simple API call
        const isValid = await this.validateToken();
        if (!isValid) {
            console.log('Token validation failed, redirecting to login');
            this.clearStoredAuth();
            window.location.href = '/admin/login';
            return;
        }

        console.log('Auth check passed for user:', this.user.email);
    }

    async validateToken() {
        if (!this.token) return false;

        try {
            const response = await fetch(`${this.authBaseURL}/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.log('Token validation error:', error.message);
            return false;
        }
    }

    // API Helper Functions
    async apiRequest(endpoint, options = {}) {
        // Determine which base URL to use based on the endpoint
        const isAuthEndpoint = endpoint.includes('/login') || endpoint.includes('/register') || endpoint.includes('/refresh-token');
        const isDashboardEndpoint = endpoint.includes('/overview') || endpoint.includes('/charts') || endpoint.includes('/activity') || endpoint.includes('/real-time-stats');
        let baseURL;

        if (isAuthEndpoint) {
            baseURL = this.authBaseURL;
        } else if (isDashboardEndpoint) {
            baseURL = '/api/v1/dashboard';
        } else {
            baseURL = this.adminBaseURL;
        }

        const url = `${baseURL}${endpoint}`;
        const token = this.getStoredToken();

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers,
            },
            ...options,
        };

        console.log('API Request:', {
            url,
            hasToken: !!token,
            endpoint
        });

        try {
            this.showLoading();

            const response = await fetch(url, config);

            if (response.status === 401) {
                // Token is invalid, clear stored auth and redirect to login
                this.clearStoredAuth();
                this.showToast('Session expired. Please log in again.', 'warning');
                setTimeout(() => {
                    window.location.href = '/admin/login';
                }, 2000);
                return;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            this.showToast(error.message, 'error');
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    // Authentication Functions
    async login(email, password) {
        try {
            const response = await fetch(`${this.authBaseURL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            console.log('Login successful for user:', data.data.user.email);

            // Store authentication data
            this.token = data.data.token;
            this.user = data.data.user;
            this.setStoredAuth(this.token, this.user);

            this.showToast('Login successful!', 'success');
            window.location.href = '/admin/dashboard';

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    logout() {
        this.clearStoredAuth();
        this.showToast('Logged out successfully', 'info');
        window.location.href = '/admin/login';
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const container = document.querySelector('.toast-container') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="btn btn-sm btn-secondary" onclick="this.parentElement.remove()">
                ×
            </button>
        `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    // Loading States
    showLoading() {
        const loader = document.querySelector('.loading-overlay') || this.createLoadingOverlay();
        loader.style.display = 'flex';
    }

    hideLoading() {
        const loader = document.querySelector('.loading-overlay');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        overlay.innerHTML = `
            <div class="spinner">
                <div class="loading"></div>
                <span>Loading...</span>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    // Form Validation
    validateForm(form) {
        const inputs = form.querySelectorAll('.form-control[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                this.showFieldError(input, 'This field is required');
                isValid = false;
            } else {
                this.clearFieldError(input);
            }
        });

        // Email validation
        const emailInputs = form.querySelectorAll('input[type="email"]');
        emailInputs.forEach(input => {
            if (input.value && !this.isValidEmail(input.value)) {
                this.showFieldError(input, 'Please enter a valid email address');
                isValid = false;
            }
        });

        return isValid;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showFieldError(input, message) {
        this.clearFieldError(input);
        input.classList.add('is-invalid');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;

        input.parentNode.appendChild(errorDiv);
    }

    clearFieldError(input) {
        input.classList.remove('is-invalid');
        const errorDiv = input.parentNode.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    // Modal Functions
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    // Page-specific initialization
    initPage() {
        switch (this.currentPage) {
            case 'login':
                this.initLoginPage();
                break;
            case 'dashboard':
                this.initDashboardPage();
                break;
            case 'leads':
                this.initLeadsPage();
                break;
            case 'lead-assignment':
                this.initLeadAssignmentPage();
                break;
            case 'user-management':
                this.initUserManagementPage();
                break;
        }
    }

    async loadPageData() {
        if (this.currentPage === 'login') return;

        try {
            switch (this.currentPage) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'leads':
                    await this.loadLeadsData();
                    break;
                case 'lead-assignment':
                    await this.loadLeadAssignmentData();
                    break;
                case 'user-management':
                    await this.loadUserManagementData();
                    break;
            }
        } catch (error) {
            console.error('Error loading page data:', error);
        }
    }

    // Login Page Functions
    initLoginPage() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!this.validateForm(loginForm)) return;

                const email = loginForm.querySelector('#email').value;
                const password = loginForm.querySelector('#password').value;

                try {
                    await this.login(email, password);
                } catch (error) {
                    // Error is handled by apiRequest
                }
            });
        }
    }

    // Chart utilities and configurations
    getChartConfig(type, options = {}) {
        const colorSchemes = {
            primary: ['#2490ef', '#13c296', '#f39c12', '#f44336', '#9b59b6', '#e67e22'],
            status: {
                'New': '#2490ef',
                'Hot': '#f39c12',
                'Interested': '#13c296',
                'Not Interested': '#f44336'
            },
            sector: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'],
            assignment: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6']
        };

        const baseConfig = {
            height: options.height || 250,
            animate: options.animate !== false,
            ...options
        };

        switch (type) {
            case 'pie':
            case 'donut':
                return {
                    ...baseConfig,
                    type: 'pie',
                    colors: options.colors || colorSchemes.primary,
                    data: options.data
                };
            case 'bar':
                return {
                    ...baseConfig,
                    type: 'bar',
                    colors: options.colors || colorSchemes.primary,
                    data: options.data,
                    barOptions: {
                        spaceRatio: 0.1,
                        height: 200,
                        ...options.barOptions
                    }
                };
            case 'line':
                return {
                    ...baseConfig,
                    type: 'line',
                    colors: options.colors || colorSchemes.primary,
                    data: options.data,
                    lineOptions: {
                        regionFill: 1,
                        hideDots: 0,
                        ...options.lineOptions
                    }
                };
            default:
                return baseConfig;
        }
    }

    formatChartData(rawData, chartType) {
        if (!rawData) return { labels: [], datasets: [{ values: [] }] };

        switch (chartType) {
            case 'pie':
            case 'donut':
                return this.formatPieData(rawData);
            case 'bar':
                return this.formatBarData(rawData);
            case 'line':
                return this.formatLineData(rawData);
            default:
                return rawData;
        }
    }

    formatPieData(data) {
        if (!Array.isArray(data)) return { labels: [], datasets: [{ values: [] }] };

        const labels = data.map(item => item._id || item.label || 'Unknown');
        const values = data.map(item => item.count || item.value || 0);

        return {
            labels: labels,
            datasets: [{ values: values }]
        };
    }

    formatBarData(data) {
        if (!Array.isArray(data)) return { labels: [], datasets: [{ values: [] }] };

        const labels = data.map(item => item._id || item.label || 'Unknown');
        const values = data.map(item => item.count || item.value || 0);

        return {
            labels: labels,
            datasets: [{ values: values }]
        };
    }

    formatLineData(data) {
        if (!Array.isArray(data)) return { labels: [], datasets: [{ values: [] }] };

        const sortedData = data.sort((a, b) => {
            if (a.date && b.date) {
                return new Date(a.date) - new Date(b.date);
            }
            return 0;
        });

        const labels = sortedData.map(item => {
            if (item.date) {
                return new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            return item._id || item.label || 'Unknown';
        });

        const values = sortedData.map(item => item.count || item.value || 0);

        return {
            labels: labels,
            datasets: [{ values: values }]
        };
    }

    exportChartData(chartType) {
        // Get chart data based on chart type
        let chartData = null;

        switch (chartType) {
            case 'statusChart':
                chartData = this.getStatusChartData();
                break;
            case 'assignmentChart':
                chartData = this.getAssignmentChartData();
                break;
            case 'trendChart':
                chartData = this.getTrendChartData();
                break;
            case 'sectorChart':
                chartData = this.getSectorChartData();
                break;
            default:
                this.showToast('Unknown chart type for export', 'error');
                return;
        }

        if (!chartData) {
            this.showToast('No chart data available for export', 'error');
            return;
        }

        const dataStr = JSON.stringify(chartData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${chartType}_data.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast(`${chartType} data exported successfully`, 'success');
    }

    // Helper methods to get chart data for export
    async getStatusChartData() {
        try {
            const data = await this.apiRequest('/charts?chartType=statusDistribution');
            return data && data.data ? this.formatChartData(data.data, 'pie') : null;
        } catch (error) {
            console.error('Error getting status chart data:', error);
            return null;
        }
    }

    async getAssignmentChartData() {
        try {
            const data = await this.apiRequest('/charts?chartType=assignmentDistribution');
            return data && data.data ? this.formatChartData(data.data, 'bar') : null;
        } catch (error) {
            console.error('Error getting assignment chart data:', error);
            return null;
        }
    }

    async getTrendChartData() {
        try {
            const data = await this.apiRequest('/charts?chartType=dailyTrend&days=7');
            return data && data.data ? this.formatChartData(data.data, 'line') : null;
        } catch (error) {
            console.error('Error getting trend chart data:', error);
            return null;
        }
    }

    async getSectorChartData() {
        try {
            const data = await this.apiRequest('/charts?chartType=sectorDistribution');
            return data && data.data ? this.formatChartData(data.data, 'bar') : null;
        } catch (error) {
            console.error('Error getting sector chart data:', error);
            return null;
        }
    }

    // Dashboard Functions
    async initDashboardPage() {
        // Initialize charts if Frappe Charts is available
        this.charts = {};
        await this.initCharts();
        await this.loadRecentActivity();
    }

    async loadDashboardData() {
        try {
            const [statsResponse, usersData] = await Promise.all([
                this.apiRequest('/overview'),
                this.apiRequest('/users')
            ]);

            // Extract data from response objects
            const statsData = statsResponse.data || statsResponse;

            this.renderStatsCards(statsData);
            this.renderUsersTable(usersData);

            // Load chart data for all charts
            await Promise.all([
                this.loadStatusChart(),
                this.loadAssignmentChart(),
                this.loadTrendChart(),
                this.loadSectorChart()
            ]);

            // Load call time statistics
            await this.loadCallTimeStats();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    renderStatsCards(stats) {
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;

        statsGrid.innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${stats.totalUsers || 0}</span>
                <span class="stat-label">Total Users</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.totalLeads || 0}</span>
                <span class="stat-label">Total Leads</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.activeLeads || 0}</span>
                <span class="stat-label">Active Leads</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.completedLeads || 0}</span>
                <span class="stat-label">Completed Leads</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.pendingLeads || 0}</span>
                <span class="stat-label">Pending Leads</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.totalCompletedCalls || 0}</span>
                <span class="stat-label">Completed Calls</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.totalCallTime || '0s'}</span>
                <span class="stat-label">Total Call Time</span>
            </div>
        `;
    }

    renderUsersTable(users) {
        const usersTable = document.querySelector('#usersTable');
        if (!usersTable) return;

        const tbody = usersTable.querySelector('tbody');
        if (!tbody) return;

        // Handle API response format - extract users array from response
        let usersArray = [];
        if (Array.isArray(users)) {
            usersArray = users;
        } else if (users && users.data && Array.isArray(users.data.users)) {
            usersArray = users.data.users;
        } else if (users && users.data && Array.isArray(users.data)) {
            usersArray = users.data;
        }

        tbody.innerHTML = usersArray.map(user => `
            <tr>
                <td>${user.name || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td><span class="badge badge-primary">${user.role || 'User'}</span></td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    async initCharts() {
        // Check if Frappe Charts library is loaded
        if (typeof frappe !== 'undefined' && frappe.Chart) {
            console.log('Frappe Charts library loaded, initializing charts...');
            await Promise.all([
                this.createStatusChart(),
                this.createAssignmentChart(),
                this.createTrendChart(),
                this.createSectorChart()
            ]);
        } else {
            console.warn('Frappe Charts library not loaded, using fallback rendering...');
            // Use fallback rendering for all charts
            await Promise.all([
                this.createStatusChart(),
                this.createAssignmentChart(),
                this.createTrendChart(),
                this.createSectorChart()
            ]);
        }
    }

    async createStatusChart() {
        const chartElement = document.getElementById('statusChart');
        if (!chartElement) return;

        try {
            // Check if Frappe Charts library is loaded
            if (typeof frappe === 'undefined' || typeof frappe.Chart === 'undefined') {
                console.warn('Frappe Charts library not loaded, using fallback rendering');
                await this.renderStatusChartFallback();
                return;
            }

            const data = await this.apiRequest('/charts?chartType=statusDistribution');

            if (data && data.data && data.data.length > 0) {
                const chartData = this.formatChartData(data.data, 'pie');
                const config = this.getChartConfig('pie', {
                    data: chartData,
                    colors: ['#2490ef', '#f39c12', '#13c296', '#f44336']
                });

                this.charts.statusChart = new frappe.Chart(chartElement, config);
                this.renderChartLegend('statusChartLegend', chartData, config.colors);
            } else {
                this.renderChartError('statusChart', 'No data available for status chart');
            }
        } catch (error) {
            console.error('Error creating status chart:', error);
            this.renderChartError('statusChart', 'Failed to load status chart');
        }
    }

    async renderStatusChartFallback() {
        const chartElement = document.getElementById('statusChart');
        if (!chartElement) return;

        try {
            const data = await this.apiRequest('/charts?chartType=statusDistribution');

            if (data && data.data && data.data.length > 0) {
                const chartData = this.formatChartData(data.data, 'pie');
                this.renderSimpleChart(chartElement, chartData, 'pie');
                this.renderChartLegend('statusChartLegend', chartData, ['#2490ef', '#f39c12', '#13c296', '#f44336']);
            } else {
                this.renderChartError('statusChart', 'No data available for status chart');
            }
        } catch (error) {
            console.error('Error rendering status chart fallback:', error);
            this.renderChartError('statusChart', 'Failed to load status chart');
        }
    }

    async createAssignmentChart() {
        const chartElement = document.getElementById('assignmentChart');
        if (!chartElement) return;

        try {
            // Check if Frappe Charts library is loaded
            if (typeof frappe === 'undefined' || typeof frappe.Chart === 'undefined') {
                console.warn('Frappe Charts library not loaded, using fallback rendering');
                await this.renderAssignmentChartFallback();
                return;
            }

            const data = await this.apiRequest('/charts?chartType=assignmentDistribution');

            if (data && data.data && data.data.length > 0) {
                const chartData = this.formatChartData(data.data, 'bar');
                const config = this.getChartConfig('bar', {
                    data: chartData,
                    colors: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']
                });

                this.charts.assignmentChart = new frappe.Chart(chartElement, config);
                this.renderChartLegend('assignmentChartLegend', chartData, config.colors);
            } else {
                this.renderChartError('assignmentChart', 'No data available for assignment chart');
            }
        } catch (error) {
            console.error('Error creating assignment chart:', error);
            this.renderChartError('assignmentChart', 'Failed to load assignment chart');
        }
    }

    async renderAssignmentChartFallback() {
        const chartElement = document.getElementById('assignmentChart');
        if (!chartElement) return;

        try {
            const data = await this.apiRequest('/charts?chartType=assignmentDistribution');

            if (data && data.data && data.data.length > 0) {
                const chartData = this.formatChartData(data.data, 'bar');
                this.renderSimpleChart(chartElement, chartData, 'bar');
                this.renderChartLegend('assignmentChartLegend', chartData, ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']);
            } else {
                this.renderChartError('assignmentChart', 'No data available for assignment chart');
            }
        } catch (error) {
            console.error('Error rendering assignment chart fallback:', error);
            this.renderChartError('assignmentChart', 'Failed to load assignment chart');
        }
    }

    async createTrendChart() {
        const chartElement = document.getElementById('trendChart');
        if (!chartElement) return;

        try {
            // Check if Frappe Charts library is loaded
            if (typeof frappe === 'undefined' || typeof frappe.Chart === 'undefined') {
                console.warn('Frappe Charts library not loaded, using fallback rendering');
                await this.renderTrendChartFallback();
                return;
            }

            const data = await this.apiRequest('/charts?chartType=dailyTrend&days=7');

            if (data && data.data && data.data.length > 0) {
                const chartData = this.formatChartData(data.data, 'line');
                const config = this.getChartConfig('line', {
                    data: chartData,
                    colors: ['#2490ef']
                });

                this.charts.trendChart = new frappe.Chart(chartElement, config);
                this.renderChartLegend('trendChartLegend', chartData, config.colors);
            } else {
                this.renderChartError('trendChart', 'No data available for trend chart');
            }
        } catch (error) {
            console.error('Error creating trend chart:', error);
            this.renderChartError('trendChart', 'Failed to load trend chart');
        }
    }

    async renderTrendChartFallback() {
        const chartElement = document.getElementById('trendChart');
        if (!chartElement) return;

        try {
            const data = await this.apiRequest('/charts?chartType=dailyTrend&days=7');

            if (data && data.data && data.data.length > 0) {
                const chartData = this.formatChartData(data.data, 'line');
                this.renderSimpleChart(chartElement, chartData, 'line');
                this.renderChartLegend('trendChartLegend', chartData, ['#2490ef']);
            } else {
                this.renderChartError('trendChart', 'No data available for trend chart');
            }
        } catch (error) {
            console.error('Error rendering trend chart fallback:', error);
            this.renderChartError('trendChart', 'Failed to load trend chart');
        }
    }

    async createSectorChart() {
        const chartElement = document.getElementById('sectorChart');
        if (!chartElement) return;

        try {
            // Check if Frappe Charts library is loaded
            if (typeof frappe === 'undefined' || typeof frappe.Chart === 'undefined') {
                console.warn('Frappe Charts library not loaded, using fallback rendering');
                await this.renderSectorChartFallback();
                return;
            }

            const data = await this.apiRequest('/charts?chartType=sectorDistribution');

            if (data && data.data && data.data.length > 0) {
                const chartData = this.formatChartData(data.data, 'bar');
                const config = this.getChartConfig('bar', {
                    data: chartData,
                    colors: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
                });

                this.charts.sectorChart = new frappe.Chart(chartElement, config);
                this.renderChartLegend('sectorChartLegend', chartData, config.colors);
            } else {
                this.renderChartError('sectorChart', 'No data available for sector chart');
            }
        } catch (error) {
            console.error('Error creating sector chart:', error);
            this.renderChartError('sectorChart', 'Failed to load sector chart');
        }
    }

    async renderSectorChartFallback() {
        const chartElement = document.getElementById('sectorChart');
        if (!chartElement) return;

        try {
            const data = await this.apiRequest('/charts?chartType=sectorDistribution');

            if (data && data.data && data.data.length > 0) {
                const chartData = this.formatChartData(data.data, 'bar');
                this.renderSimpleChart(chartElement, chartData, 'bar');
                this.renderChartLegend('sectorChartLegend', chartData, ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']);
            } else {
                this.renderChartError('sectorChart', 'No data available for sector chart');
            }
        } catch (error) {
            console.error('Error rendering sector chart fallback:', error);
            this.renderChartError('sectorChart', 'Failed to load sector chart');
        }
    }

    renderChartLegend(legendElementId, chartData, colors) {
        const legendElement = document.getElementById(legendElementId);
        if (!legendElement || !chartData.labels) return;

        legendElement.innerHTML = chartData.labels.map((label, index) => `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${colors[index % colors.length]}"></span>
                <span>${label}</span>
            </div>
        `).join('');
    }

    renderChartError(chartElementId, message) {
        const chartElement = document.getElementById(chartElementId);
        if (!chartElement) return;

        chartElement.innerHTML = `
            <div class="loading-chart">
                <span style="color: var(--frappe-text-muted);">${message}</span>
            </div>
        `;
    }

    // Fallback chart rendering when Frappe Charts is not available
    renderSimpleChart(chartElement, chartData, chartType) {
        if (!chartElement || !chartData) return;

        let html = '';

        switch (chartType) {
            case 'pie':
                html = this.renderSimplePieChart(chartData);
                break;
            case 'bar':
                html = this.renderSimpleBarChart(chartData);
                break;
            case 'line':
                html = this.renderSimpleLineChart(chartData);
                break;
            default:
                html = '<div class="loading-chart"><span>Unsupported chart type</span></div>';
        }

        chartElement.innerHTML = html;
    }

    renderSimplePieChart(chartData) {
        if (!chartData.labels || !chartData.datasets || !chartData.datasets[0]) {
            return '<div class="loading-chart"><span>No data available</span></div>';
        }

        const labels = chartData.labels;
        const values = chartData.datasets[0].values;
        const total = values.reduce((sum, val) => sum + val, 0);

        let html = '<div style="display: flex; flex-direction: column; align-items: center; height: 200px;">';

        labels.forEach((label, index) => {
            const value = values[index] || 0;
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

            html += `
                <div style="display: flex; align-items: center; margin: 5px 0; width: 100%;">
                    <div style="width: 12px; height: 12px; background: ${['#2490ef', '#f39c12', '#13c296', '#f44336'][index % 4]}; border-radius: 2px; margin-right: 8px;"></div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px;">
                            <span>${label}</span>
                            <span>${value} (${percentage}%)</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: #f0f0f0; border-radius: 4px; margin-top: 2px;">
                            <div style="width: ${percentage}%; height: 100%; background: ${['#2490ef', '#f39c12', '#13c296', '#f44336'][index % 4]}; border-radius: 4px;"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    renderSimpleBarChart(chartData) {
        if (!chartData.labels || !chartData.datasets || !chartData.datasets[0]) {
            return '<div class="loading-chart"><span>No data available</span></div>';
        }

        const labels = chartData.labels;
        const values = chartData.datasets[0].values;
        const maxValue = Math.max(...values);

        let html = '<div style="padding: 10px;">';

        labels.forEach((label, index) => {
            const value = values[index] || 0;
            const height = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;

            html += `
                <div style="margin: 10px 0;">
                    <div style="font-size: 12px; margin-bottom: 5px;">${label}: ${value}</div>
                    <div style="width: 100%; height: 20px; background: #f0f0f0; border-radius: 4px;">
                        <div style="width: ${height}%; height: 100%; background: ${['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'][index % 5]}; border-radius: 4px;"></div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    renderSimpleLineChart(chartData) {
        if (!chartData.labels || !chartData.datasets || !chartData.datasets[0]) {
            return '<div class="loading-chart"><span>No data available</span></div>';
        }

        const labels = chartData.labels;
        const values = chartData.datasets[0].values;

        let html = '<div style="padding: 10px; font-size: 12px;">';

        labels.forEach((label, index) => {
            const value = values[index] || 0;
            html += `<div>${label}: ${value}</div>`;
        });

        html += '</div>';
        return html;
    }

    async loadRecentActivity() {
        try {
            const data = await this.apiRequest('/activity?limit=10');
            this.renderRecentActivity(data.data || []);
        } catch (error) {
            console.error('Error loading recent activity:', error);
            this.renderActivityError('Failed to load recent activity');
        }
    }

    renderRecentActivity(activities) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        if (!activities || activities.length === 0) {
            activityList.innerHTML = `
                <div class="activity-item">
                    <div class="activity-content">
                        <div class="activity-title">No recent activity</div>
                        <div class="activity-meta">No activities to display</div>
                    </div>
                </div>
            `;
            return;
        }

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-title">
                        <span style="margin-right: 0.5rem;">${activity.icon}</span>
                        ${activity.title}
                    </div>
                    <div class="activity-meta">${activity.description}</div>
                </div>
                <div class="activity-time">
                    ${new Date(activity.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>
        `).join('');
    }

    renderActivityError(message) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        activityList.innerHTML = `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-title" style="color: var(--frappe-text-muted);">${message}</div>
                </div>
            </div>
        `;
    }

    async refreshActivity() {
        await this.loadRecentActivity();
        this.showToast('Activity refreshed successfully', 'success');
    }

    async loadCallTimeStats() {
        try {
            const callTimeData = await this.apiRequest('/call-time-stats');
            this.renderCallTimeStats(callTimeData.data || callTimeData);
        } catch (error) {
            console.error('Error loading call time stats:', error);
            this.renderCallTimeStatsError('Failed to load call time statistics');
        }
    }

    renderCallTimeStats(callTimeStats) {
        const statsList = document.getElementById('callTimeStatsList');
        if (!statsList) return;

        if (!callTimeStats || callTimeStats.length === 0) {
            statsList.innerHTML = `
                <div class="activity-item">
                    <div class="activity-content">
                        <div class="activity-title">No call time data available</div>
                        <div class="activity-meta">No calls have been logged yet</div>
                    </div>
                </div>
            `;
            return;
        }

        statsList.innerHTML = callTimeStats.map(stat => `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-title">
                        <strong>${stat.employee}</strong>
                    </div>
                    <div class="activity-meta">
                        Total Leads: ${stat.totalLeads} |
                        Completed: ${stat.completedLeads} |
                        Total Call Time: ${stat.totalCallTime} |
                        Average: ${stat.averageCallTime}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderCallTimeStatsError(message) {
        const statsList = document.getElementById('callTimeStatsList');
        if (!statsList) return;

        statsList.innerHTML = `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-title" style="color: var(--frappe-text-muted);">${message}</div>
                </div>
            </div>
        `;
    }

    // Chart refresh functions
    async loadStatusChart() {
        if (this.charts.statusChart) {
            this.charts.statusChart.destroy();
        }
        await this.createStatusChart();
    }

    async loadAssignmentChart() {
        if (this.charts.assignmentChart) {
            this.charts.assignmentChart.destroy();
        }
        await this.createAssignmentChart();
    }

    async loadTrendChart() {
        if (this.charts.trendChart) {
            this.charts.trendChart.destroy();
        }
        await this.createTrendChart();
    }

    async loadSectorChart() {
        if (this.charts.sectorChart) {
            this.charts.sectorChart.destroy();
        }
        await this.createSectorChart();
    }

    // Leads Page Functions
    async initLeadsPage() {
        this.initLeadsFilters();
        this.initLeadsSearch();
    }

    async loadLeadsData(filters = {}) {
        try {
            // Remove limit to fetch all leads
            const queryParams = new URLSearchParams(filters).toString();
            const leads = await this.apiRequest(`/leads?${queryParams}`);
            
            this.renderLeadsTable(leads);
            this.updatePaginationControls(leads);
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    }

    renderLeadsTable(leads) {
        const leadsTable = document.querySelector('#leadsTable');
        if (!leadsTable) return;

        const tbody = leadsTable.querySelector('tbody');
        if (!tbody) return;

        // Handle API response format - extract leads array from response
        let leadsArray = [];
        if (Array.isArray(leads)) {
            leadsArray = leads;
        } else if (leads && leads.data && Array.isArray(leads.data.leads)) {
            leadsArray = leads.data.leads;
        } else if (leads && leads.data && Array.isArray(leads.data)) {
            leadsArray = leads.data;
        }

        if (leadsArray.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10">
                        <div class="empty-state">
                            <div class="empty-state-icon">📋</div>
                            <p>No leads found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = leadsArray.map(lead => `
            <tr>
                <td>${lead.name || 'N/A'}</td>
                <td>${lead.phone || 'N/A'}</td>
                <td>${lead.description || 'N/A'}</td>
                <td>${lead.website ? `<a href="${lead.website}" target="_blank" rel="noopener noreferrer">${lead.website}</a>` : 'N/A'}</td>
                <td>${lead.notes || 'N/A'}</td>
                <td><span class="badge badge-${this.getStatusBadgeClass(lead.status)}">${lead.status || 'New'}</span></td>
                <td>${lead.callTime ? (typeof window.formatCallTime === 'function' ? window.formatCallTime(lead.callTime) : lead.callTime) : 'Not recorded'}</td>
                <td>${lead.assignedTo || 'Unassigned'}</td>
                <td>${new Date(lead.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="adminApp.editLead('${lead._id || lead.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="adminApp.deleteLead('${lead._id || lead.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    getStatusBadgeClass(status) {
        const statusMap = {
            'new': 'primary',
            'interested': 'success',
            'not interested': 'secondary',
            'hot': 'warning',
            'pending': 'info',
            'completed': 'success'
        };
        return statusMap[status?.toLowerCase()] || 'primary';
    }

    initLeadsFilters() {
        const filterForm = document.getElementById('leadsFilters');
        if (filterForm) {
            filterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(filterForm);
                const filters = Object.fromEntries(formData.entries());
                this.loadLeadsData(filters);
            });
        }
    }

    initLeadsSearch() {
        const searchInput = document.getElementById('leadsSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.loadLeadsData({ search: e.target.value });
                }, 500);
            });
        }
    }

    // Lead Assignment Page Functions
    async initLeadAssignmentPage() {
        this.initFileUpload();
        // Employees are loaded as part of loadLeadAssignmentData()
    }

    async loadLeadAssignmentData() {
        try {
            const [employees, assignments] = await Promise.all([
                this.apiRequest('/employees'),
                this.apiRequest('/lead-assignments')
            ]);

            this.renderEmployees(employees);
            this.renderAssignments(assignments);
        } catch (error) {
            console.error('Error loading lead assignment data:', error);
        }
    }

    renderEmployees(employees) {
        const employeesGrid = document.querySelector('.employees-grid');
        if (!employeesGrid) return;

        // Handle API response format - extract employees array from response
        let employeesArray = [];
        if (Array.isArray(employees)) {
            employeesArray = employees;
        } else if (employees && employees.data && Array.isArray(employees.data.employees)) {
            employeesArray = employees.data.employees;
        } else if (employees && employees.data && Array.isArray(employees.data)) {
            employeesArray = employees.data;
        }

        if (employeesArray.length === 0) {
            employeesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <p>No employees found</p>
                </div>
            `;
            return;
        }

        employeesGrid.innerHTML = employeesArray.map(employee => `
            <div class="employee-card card" onclick="adminApp.selectEmployee('${employee._id || employee.id}')">
                <div class="card-body text-center">
                    <h6 class="card-title">${employee.name || 'N/A'}</h6>
                    <p class="text-muted">${employee.email || 'N/A'}</p>
                    <p class="text-muted">${employee.department || 'General'}</p>
                    <span class="badge badge-primary">${employee.activeLeads || 0} Active Leads</span>
                </div>
            </div>
        `).join('');
    }

    renderAssignments(assignments) {
        const assignmentsList = document.querySelector('#assignmentsList');
        if (!assignmentsList) return;

        // Handle API response format - extract assignments array from response
        let assignmentsArray = [];
        if (Array.isArray(assignments)) {
            assignmentsArray = assignments;
        } else if (assignments && assignments.data && Array.isArray(assignments.data.assignments)) {
            assignmentsArray = assignments.data.assignments;
        } else if (assignments && assignments.data && Array.isArray(assignments.data)) {
            assignmentsArray = assignments.data;
        }

        if (assignmentsArray.length === 0) {
            assignmentsList.innerHTML = `
                <div class="assignment-item">
                    <div class="text-muted">No assignments found</div>
                </div>
            `;
            return;
        }

        assignmentsList.innerHTML = assignmentsArray.map(assignment => `
            <div class="assignment-item">
                <strong>${assignment.name || assignment.leadName || 'N/A'}</strong> → ${assignment.assignedTo || assignment.employeeName || 'Unassigned'}
                <span class="text-muted">(${new Date(assignment.assignedDate || assignment.assignedAt).toLocaleDateString()})</span>
            </div>
        `).join('');
    }

    initFileUpload() {
        const fileInput = document.getElementById('excelFile');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    await this.handleFileUploadWithAssignment(e.target.files[0]);
                }
            });
        }
    }

    async handleFileUploadWithAssignment(file) {
        if (!file) return;

        // Validate file type
        const validTypes = ['text/csv'];

        if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
            this.showToast('Please upload a valid CSV file', 'error');
            return;
        }

        // Check if any employees are selected before allowing upload
        if (typeof selectedEmployees !== 'undefined' && selectedEmployees.length === 0) {
            this.showToast('Please select at least one employee before uploading leads', 'warning');
            return;
        }

        try {
            const result = await this.uploadExcelFile(file);

            // Store the uploaded leads data for automatic assignment
            if (result && result.data && result.data.leads) {
                uploadedLeads = result.data.leads;
            } else {
                uploadedLeads = [];
            }

            // Automatically assign leads to selected employees
            if (uploadedLeads.length > 0 && selectedEmployees.length > 0) {
                await this.confirmAssignment();
            } else {
                this.updateAssignmentProgress();
                const count = result && result.data ? (result.data.uploadedCount || (result.data.leads ? result.data.leads.length : 0)) : 0;
                this.showToast(`Successfully uploaded ${count} leads`, 'success');
            }
        } catch (error) {
            this.showToast('Failed to upload file: ' + error.message, 'error');
        }
    }

    async confirmAssignment() {
        try {
            // Distribute leads among selected employees
            const leadsPerEmployee = Math.floor(uploadedLeads.length / selectedEmployees.length);
            const remainder = uploadedLeads.length % selectedEmployees.length;

            let assignedCount = 0;

            // Assign leads to each employee
            for (let i = 0; i < selectedEmployees.length; i++) {
                const employeeId = selectedEmployees[i];
                const leadsToAssign = leadsPerEmployee + (i < remainder ? 1 : 0);

                if (leadsToAssign > 0) {
                    // Get the leads for this employee
                    const startIdx = i * leadsPerEmployee + Math.min(i, remainder);
                    const endIdx = startIdx + leadsToAssign;
                    const employeeLeads = uploadedLeads.slice(startIdx, endIdx);

                    // Extract lead IDs
                    const leadIds = employeeLeads.map(lead => lead.id || lead._id);

                    // Assign leads to employee
                    const result = await this.apiRequest('/leads/assign', {
                        method: 'POST',
                        body: JSON.stringify({
                            leadIds: leadIds,
                            employeeId: employeeId
                        }),
                    });

                    assignedCount += result.data.assignedCount;
                }
            }

            this.showToast(`Successfully assigned ${assignedCount} leads to ${selectedEmployees.length} employees`, 'success');

            // Reset selections
            selectedEmployees = [];
            uploadedLeads = [];
            this.updateSelectedEmployeesIndicator();
            this.updateAssignmentProgress();

            // Reload data
            this.loadLeadAssignmentData();

        } catch (error) {
            this.showToast('Failed to assign leads: ' + error.message, 'error');
        }
    }

    updateAssignmentProgress() {
        const totalLeads = uploadedLeads.length;
        const assignedLeads = totalLeads; // All leads are assigned automatically
        const remainingLeads = 0;

        const totalLeadsElement = document.getElementById('totalLeads');
        const assignedLeadsElement = document.getElementById('assignedLeads');
        const remainingLeadsElement = document.getElementById('remainingLeads');
        const progressElement = document.getElementById('assignmentProgress');

        if (totalLeadsElement) totalLeadsElement.textContent = `${totalLeads} Total`;
        if (assignedLeadsElement) assignedLeadsElement.textContent = `${assignedLeads} Assigned`;
        if (remainingLeadsElement) remainingLeadsElement.textContent = `${remainingLeads} Remaining`;

        const progressPercentage = totalLeads > 0 ? 100 : 0; // Always 100% since assignment is automatic
        if (progressElement) {
            progressElement.style.width = `${progressPercentage}%`;
        }
    }

    updateSelectedEmployeesIndicator() {
        const indicator = document.getElementById('selectedEmployees');
        const count = document.getElementById('selectedCount');

        if (selectedEmployees.length > 0) {
            count.textContent = selectedEmployees.length;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    selectEmployee(employeeId) {
        const employeeCard = document.querySelector(`[data-employee-id="${employeeId}"]`);
        if (!employeeCard) return;

        if (selectedEmployees.includes(employeeId)) {
            // Deselect employee
            selectedEmployees = selectedEmployees.filter(id => id !== employeeId);
            employeeCard.classList.remove('selected');
        } else {
            // Select employee
            selectedEmployees.push(employeeId);
            employeeCard.classList.add('selected');
        }

        // Update the indicator
        this.updateSelectedEmployeesIndicator();
    }

    async uploadExcelFile(file) {
        if (!file) return;

        const formData = new FormData();
        formData.append('excel', file);

        const token = this.getStoredToken();

        // Show progress bar
        this.showUploadProgress();

        try {
            // Start progress polling
            const progressInterval = setInterval(() => {
                this.updateUploadProgress({
                    percentage: Math.min(90, Math.random() * 80 + 10), // Simulate progress
                    message: 'Processing file...',
                    stage: 'processing'
                });
            }, 500);

            const response = await fetch(`${this.adminBaseURL}/leads/bulk-upload`, {
                method: 'POST',
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                },
                body: formData,
            });

            // Clear progress polling
            clearInterval(progressInterval);

            if (response.status === 401) {
                // Token is invalid, clear stored auth and redirect to login
                this.clearStoredAuth();
                this.showToast('Session expired. Please log in again.', 'warning');
                setTimeout(() => {
                    window.location.href = '/admin/login';
                }, 2000);
                return;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'File upload failed');
            }

            // Show completion
            this.completeUploadProgress({
                message: `Successfully uploaded ${data.data?.uploadedCount || data.uploadedCount || 0} leads`,
                finalCount: data.data?.uploadedCount || data.uploadedCount || 0,
                percentage: 100
            });

            // Return the data so it can be used by the caller
            return data;
        } catch (error) {
            console.error('File upload error:', error);
            this.errorUploadProgress({
                message: error.message || 'Failed to upload file'
            });
            throw error; // Re-throw the error so it can be handled by the caller
        }
    }

    // Upload Progress Functions
    showUploadProgress() {
        const progressContainer = document.getElementById('uploadProgressContainer');
        const progressBar = document.getElementById('uploadProgress');
        const progressText = document.getElementById('progressText');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressStage = document.getElementById('progressStage');

        if (progressContainer) {
            progressContainer.style.display = 'block';
        }

        if (progressBar) {
            progressBar.style.width = '0%';
        }

        if (progressText) {
            progressText.textContent = 'Initializing upload...';
        }

        if (progressPercentage) {
            progressPercentage.textContent = '0%';
        }

        if (progressStage) {
            progressStage.textContent = 'Starting...';
        }
    }

    updateUploadProgress(progressData) {
        const progressBar = document.getElementById('uploadProgress');
        const progressText = document.getElementById('progressText');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressStage = document.getElementById('progressStage');

        if (progressBar) {
            progressBar.style.width = `${progressData.percentage || 0}%`;
        }

        if (progressText) {
            progressText.textContent = progressData.message || 'Processing...';
        }

        if (progressPercentage) {
            progressPercentage.textContent = `${progressData.percentage || 0}%`;
        }

        if (progressStage) {
            let stageText = progressData.stage || 'Processing...';
            if (progressData.duplicates > 0) {
                stageText += ` (${progressData.duplicates} duplicates skipped)`;
            }
            if (progressData.errors > 0) {
                stageText += ` (${progressData.errors} errors)`;
            }
            progressStage.textContent = stageText;
        }
    }

    completeUploadProgress(completionData) {
        const progressBar = document.getElementById('uploadProgress');
        const progressText = document.getElementById('progressText');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressStage = document.getElementById('progressStage');

        if (progressBar) {
            progressBar.style.width = '100%';
        }

        if (progressText) {
            let message = completionData.message || 'Upload completed successfully!';

            // Add detailed information if available
            if (completionData.details) {
                const { uploaded, duplicates, errors } = completionData.details;
                if (duplicates > 0 || errors > 0) {
                    message += ` (${uploaded} new, ${duplicates} skipped, ${errors} errors)`;
                }
            }

            progressText.textContent = message;
        }

        if (progressPercentage) {
            progressPercentage.textContent = '100%';
        }

        if (progressStage) {
            let stageText = 'Complete';
            if (completionData.details) {
                const { duplicates, errors } = completionData.details;
                if (duplicates > 0 || errors > 0) {
                    stageText += ` (${duplicates} skipped, ${errors} errors)`;
                }
            }
            progressStage.textContent = stageText;
        }

        // Show success toast with detailed information
        const uploadedCount = completionData.finalCount || completionData.processed || 0;
        let toastMessage = `Successfully uploaded ${uploadedCount} leads`;

        if (completionData.details) {
            const { duplicates, errors } = completionData.details;
            if (duplicates > 0) {
                toastMessage += `, skipped ${duplicates} duplicates`;
            }
            if (errors > 0) {
                toastMessage += `, ${errors} errors`;
            }
        }

        this.showToast(toastMessage, 'success');

        // Reload data after a short delay
        setTimeout(() => {
            this.loadLeadAssignmentData();
            this.hideUploadProgress();
        }, 2000);
    }

    errorUploadProgress(errorData) {
        const progressText = document.getElementById('progressText');
        const progressStage = document.getElementById('progressStage');

        if (progressText) {
            progressText.textContent = errorData.message || 'Upload failed';
        }

        if (progressStage) {
            progressStage.textContent = 'Error';
        }

        // Show error toast
        this.showToast(errorData.message || 'Failed to upload file', 'error');

        // Hide progress after a delay
        setTimeout(() => {
            this.hideUploadProgress();
        }, 3000);
    }

    hideUploadProgress() {
        const progressContainer = document.getElementById('uploadProgressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    // User Management Page Functions
    async initUserManagementPage() {
        this.initUserModals();
    }

    async loadUserManagementData() {
        try {
            const users = await this.apiRequest('/users');
            this.renderUsersManagementTable(users);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    renderUsersManagementTable(users) {
        const usersTable = document.querySelector('#usersManagementTable');
        if (!usersTable) return;

        const tbody = usersTable.querySelector('tbody');
        if (!tbody) return;

        // Handle API response format - extract users array from response
        let usersArray = [];
        if (Array.isArray(users)) {
            usersArray = users;
        } else if (users && users.data && Array.isArray(users.data.users)) {
            usersArray = users.data.users;
        } else if (users && users.data && Array.isArray(users.data)) {
            usersArray = users.data;
        }

        if (usersArray.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <div class="empty-state-icon">👥</div>
                            <p>No users found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = usersArray.map(user => `
            <tr>
                <td>${user.name || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td><span class="badge badge-primary">${user.role || 'User'}</span></td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>${user.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="adminApp.editUser('${user._id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="adminApp.deleteUser('${user._id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    initUserModals() {
        // Add user modal
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                this.showModal('addUserModal');
            });
        }

        // Edit user modal
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="edit-user"]')) {
                const userId = e.target.dataset.userId;
                this.editUser(userId);
            }
        });
    }

    async editUser(userId) {
        try {
            const user = await this.apiRequest(`/users/${userId}`);
            this.populateEditUserForm(user);
            this.showModal('editUserModal');
        } catch (error) {
            console.error('Error loading user:', error);
        }
    }

    populateEditUserForm(userResponse) {
        const form = document.getElementById('editUserForm');
        if (!form) return;

        // Handle API response format - extract user data from response
        let user = userResponse;
        if (userResponse && userResponse.data && userResponse.data.user) {
            user = userResponse.data.user;
        }

        if (!user) {
            console.error('No user data found in response:', userResponse);
            return;
        }

        form.querySelector('#editUserId').value = user._id || user.id;
        form.querySelector('#editName').value = user.name || '';
        form.querySelector('#editEmail').value = user.email || '';
        form.querySelector('#editRole').value = user.role || '';
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            await this.apiRequest(`/users/${userId}`, {
                method: 'DELETE',
            });

            this.showToast('User deleted successfully', 'success');
            this.loadUserManagementData();
        } catch (error) {
            this.showToast('Failed to delete user', 'error');
        }
    }

    async changeUserPassword(userId) {
        const newPassword = prompt('Enter new password for the user:');
        if (!newPassword || newPassword.trim().length < 6) {
            this.showToast('Password must be at least 6 characters long', 'warning');
            return;
        }

        const confirmPassword = prompt('Confirm new password:');
        if (newPassword !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        try {
            await this.apiRequest(`/users/${userId}/password`, {
                method: 'PUT',
                body: JSON.stringify({ password: newPassword })
            });

            this.showToast('Password changed successfully', 'success');
        } catch (error) {
            this.showToast('Failed to change password', 'error');
        }
    }


    // Utility Functions
    formatDate(date) {
        return new Date(date).toLocaleDateString();
    }

    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Global variables for lead assignment functionality
let selectedEmployees = [];
let uploadedLeads = [];

// Initialize the admin app
const adminApp = new AdminApp();

// Ensure adminApp is available globally for inline scripts
if (typeof window !== 'undefined') {
    window.adminApp = adminApp;
}

// Global functions for lead assignment
if (typeof window !== 'undefined') {
    window.selectEmployee = function(employeeId) {
        const employeeCard = document.querySelector(`[data-employee-id="${employeeId}"]`);
        if (!employeeCard) return;

        if (selectedEmployees.includes(employeeId)) {
            // Deselect employee
            selectedEmployees = selectedEmployees.filter(id => id !== employeeId);
            employeeCard.classList.remove('selected');
        } else {
            // Select employee
            selectedEmployees.push(employeeId);
            employeeCard.classList.add('selected');
        }

        // Update the indicator using adminApp method
        if (window.adminApp) {
            window.adminApp.updateSelectedEmployeesIndicator();
        }
    };
}

// Global functions for onclick handlers
function showModal(modalId) {
    if (window.adminApp) {
        window.adminApp.showModal(modalId);
    }
}

function hideModal(modalId) {
    if (window.adminApp) {
        window.adminApp.hideModal(modalId);
    }
}