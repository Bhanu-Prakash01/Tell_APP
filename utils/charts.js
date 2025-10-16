// Chart utilities for Telecalling Dashboard
// Provides helper functions for Frappe Charts integration

class ChartUtils {
    constructor() {
        this.colorSchemes = {
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

        this.chartDefaults = {
            height: 250,
            animate: true,
            barOptions: {
                spaceRatio: 0.1,
                height: 200
            },
            lineOptions: {
                regionFill: 1,
                hideDots: 0
            }
        };
    }

    // Data formatting functions
    formatChartData(rawData, chartType) {
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

        // Sort by date if dealing with time series data
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

    // Color scheme management
    getColorScheme(type, count) {
        const scheme = this.colorSchemes[type] || this.colorSchemes.primary;
        if (count && count > scheme.length) {
            return this.extendColorScheme(scheme, count);
        }
        return scheme;
    }

    extendColorScheme(baseScheme, targetLength) {
        const extended = [...baseScheme];
        while (extended.length < targetLength) {
            // Generate additional colors by adjusting brightness
            const lastColor = extended[extended.length - 1];
            const adjustedColor = this.adjustColorBrightness(lastColor, 0.8);
            extended.push(adjustedColor);
        }
        return extended;
    }

    adjustColorBrightness(hexColor, factor) {
        // Convert hex to RGB
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Adjust brightness
        const newR = Math.min(255, Math.max(0, Math.floor(r * factor)));
        const newG = Math.min(255, Math.max(0, Math.floor(g * factor)));
        const newB = Math.min(255, Math.max(0, Math.floor(b * factor)));

        // Convert back to hex
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    // Chart configuration helpers
    getChartConfig(type, options = {}) {
        const baseConfig = {
            height: options.height || this.chartDefaults.height,
            animate: options.animate !== false ? this.chartDefaults.animate : false,
            ...options
        };

        switch (type) {
            case 'pie':
            case 'donut':
                return this.getPieConfig(baseConfig);
            case 'bar':
                return this.getBarConfig(baseConfig);
            case 'line':
                return this.getLineConfig(baseConfig);
            default:
                return baseConfig;
        }
    }

    getPieConfig(options) {
        return {
            ...options,
            type: 'pie',
            colors: options.colors || this.colorSchemes.primary,
            data: options.data,
            barOptions: {},
            lineOptions: {}
        };
    }

    getBarConfig(options) {
        return {
            ...options,
            type: 'bar',
            colors: options.colors || this.colorSchemes.primary,
            data: options.data,
            barOptions: {
                ...this.chartDefaults.barOptions,
                ...options.barOptions
            },
            lineOptions: {}
        };
    }

    getLineConfig(options) {
        return {
            ...options,
            type: 'line',
            colors: options.colors || this.colorSchemes.primary,
            data: options.data,
            barOptions: {},
            lineOptions: {
                ...this.chartDefaults.lineOptions,
                ...options.lineOptions
            }
        };
    }

    // Chart update utilities
    updateChartData(chart, newData, animate = true) {
        if (!chart || !chart.update) return;

        try {
            chart.update({
                data: newData,
                animate: animate
            });
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }

    destroyChart(chart) {
        if (chart && chart.destroy) {
            try {
                chart.destroy();
            } catch (error) {
                console.error('Error destroying chart:', error);
            }
        }
    }

    // Data aggregation helpers
    aggregateDataByDate(data, dateField = 'createdAt', days = 7) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const aggregated = {};
        const currentDate = new Date(startDate);

        // Initialize all dates with 0 count
        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            aggregated[dateKey] = 0;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Count actual data
        data.forEach(item => {
            if (item[dateField]) {
                const itemDate = new Date(item[dateField]);
                const dateKey = itemDate.toISOString().split('T')[0];
                if (aggregated[dateKey] !== undefined) {
                    aggregated[dateKey]++;
                }
            }
        });

        return Object.entries(aggregated).map(([date, count]) => ({
            date,
            count
        }));
    }

    aggregateDataByField(data, field) {
        const aggregated = {};

        data.forEach(item => {
            const key = item[field] || 'Unknown';
            aggregated[key] = (aggregated[key] || 0) + 1;
        });

        return Object.entries(aggregated).map(([label, count]) => ({
            _id: label,
            label,
            count
        }));
    }

    // Chart interaction handlers
    addChartInteractivity(chart, callbacks = {}) {
        if (!chart || !chart.svg) return;

        const { onDataPointClick, onLegendClick } = callbacks;

        if (onDataPointClick) {
            // Add click handlers to data points
            const dataPoints = chart.svg.querySelectorAll('.data-point, .bar');
            dataPoints.forEach((point, index) => {
                point.style.cursor = 'pointer';
                point.addEventListener('click', () => onDataPointClick(index));
            });
        }

        if (onLegendClick) {
            // Add click handlers to legend items
            const legendItems = chart.svg.querySelectorAll('.legend-item');
            legendItems.forEach((item, index) => {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => onLegendClick(index));
            });
        }
    }

    // Export utilities
    exportChartData(chart, format = 'json') {
        if (!chart || !chart.data) return null;

        switch (format) {
            case 'csv':
                return this.exportToCSV(chart.data);
            case 'json':
            default:
                return JSON.stringify(chart.data, null, 2);
        }
    }

    exportToCSV(data) {
        if (!data.labels || !data.datasets) return '';

        const headers = ['Label', ...data.datasets.map((_, index) => `Dataset ${index + 1}`)];
        const rows = [headers.join(',')];

        data.labels.forEach((label, index) => {
            const values = data.datasets.map(dataset => dataset.values[index] || 0);
            rows.push([label, ...values].join(','));
        });

        return rows.join('\n');
    }

    // Responsive utilities
    getResponsiveHeight(containerWidth) {
        if (containerWidth < 480) {
            return 200;
        } else if (containerWidth < 768) {
            return 220;
        } else {
            return this.chartDefaults.height;
        }
    }

    // Error handling
    handleChartError(error, chartType) {
        console.error(`Chart error (${chartType}):`, error);

        // Return safe fallback data
        return {
            labels: ['Error'],
            datasets: [{ values: [0] }]
        };
    }
}

// Export singleton instance
module.exports = new ChartUtils();