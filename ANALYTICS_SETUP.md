# 📊 TeleCRM Analytics Setup Guide

## Overview

This guide explains how to set up and use the new analytics features in TeleCRM, specifically the leads by sector and region charts.

## 🚀 Quick Start

### 1. Add Sample Data

To test the analytics charts with sample data, run:

```bash
npm run seed
```

This will add 40+ sample leads with different sectors, regions, and statuses to test all the charts.

### 2. Access Analytics

1. Start the server: `npm start`
2. Navigate to: `http://localhost:5000/admin.html`
3. Click on "Advanced Analytics" in the sidebar
4. View the various charts showing lead distribution

## 📈 Available Charts

### 1. **Leads by Sector** (Bar Chart)
- Shows total number of leads for each sector
- Sectors: Technology, Healthcare, Finance, Education, Retail, Manufacturing, Real Estate, Other

### 2. **Leads by Region** (Bar Chart)
- Shows total number of leads for each region
- Regions: North, South, East, West, Central, International

### 3. **Hot Leads by Sector** (Doughnut Chart)
- Shows distribution of "Hot" status leads across sectors
- Helps identify which sectors have the most promising leads

### 4. **Interested Leads by Sector** (Doughnut Chart)
- Shows distribution of "Interested" status leads across sectors
- Helps track engagement by sector

### 5. **Hot Leads by Region** (Pie Chart)
- Shows distribution of "Hot" status leads across regions
- Helps identify high-potential geographic areas

### 6. **Interested Leads by Region** (Pie Chart)
- Shows distribution of "Interested" status leads across regions
- Helps track regional engagement

### 7. **Monthly Lead Trend** (Line Chart)
- Shows lead creation trend over time
- Helps track growth and seasonality

### 8. **Sector-Region Matrix** (Stacked Bar Chart)
- Shows combined Hot and Interested leads by sector and region
- Provides detailed cross-analysis

## 🔧 API Endpoints

### Get Lead Analytics
```
GET /api/admin/leads/analytics
```

**Response:**
```json
{
  "statusDistribution": {
    "New": 15,
    "Interested": 12,
    "Hot": 8,
    "Follow-up": 3,
    "Won": 2,
    "Lost": 1
  },
  "sectorDistribution": {
    "Technology": 12,
    "Healthcare": 8,
    "Finance": 6,
    "Education": 3,
    "Retail": 3,
    "Manufacturing": 3,
    "Real Estate": 3,
    "Other": 2
  },
  "regionDistribution": {
    "North": 10,
    "South": 8,
    "East": 6,
    "West": 6,
    "Central": 6,
    "International": 4
  },
  "hotLeadsBySector": {
    "Technology": 4,
    "Healthcare": 2,
    "Finance": 2
  },
  "interestedLeadsBySector": {
    "Technology": 3,
    "Healthcare": 3,
    "Finance": 2,
    "Education": 2,
    "Retail": 2
  },
  "hotLeadsByRegion": {
    "North": 3,
    "South": 2,
    "East": 2,
    "West": 1
  },
  "interestedLeadsByRegion": {
    "North": 3,
    "South": 3,
    "East": 2,
    "West": 2,
    "Central": 2
  },
  "monthlyLeadTrend": {
    "January 2024": 15,
    "February 2024": 18,
    "March 2024": 12
  },
  "sectorRegionMatrix": {
    "Technology": {
      "North": { "hot": 2, "interested": 1 },
      "South": { "hot": 1, "interested": 1 },
      "East": { "hot": 1, "interested": 1 }
    }
  },
  "totalLeads": 40
}
```

## 🎨 Chart Features

### Interactive Elements
- **Hover Effects**: Hover over chart elements to see detailed values
- **Responsive Design**: Charts adapt to different screen sizes
- **Theme Support**: Charts work with light, semi-dark, and dark themes
- **Real-time Updates**: Click "Refresh Analytics" to update data

### Chart Types Used
- **Bar Charts**: For comparing quantities across categories
- **Doughnut Charts**: For showing proportions of a whole
- **Pie Charts**: For simple proportion visualization
- **Line Charts**: For showing trends over time
- **Stacked Bar Charts**: For showing composition of categories

## 🔄 Data Refresh

### Manual Refresh
- Click the "Refresh Analytics" button in the Analytics section
- This fetches the latest data from the server and updates all charts

### Automatic Refresh
- Charts are loaded when the page loads
- Data is refreshed when navigating to the Analytics section

## 🛠️ Customization

### Adding New Sectors
1. Update the Lead model in `models/Lead.js`
2. Add the new sector to the enum array
3. Update the frontend dropdown in `public/addlead.html`

### Adding New Regions
1. Update the Lead model in `models/Lead.js`
2. Add the new region to the enum array
3. Update the frontend dropdown in `public/addlead.html`

### Modifying Chart Colors
Edit the `backgroundColor` arrays in the chart initialization functions in `public/admin.html`:

```javascript
backgroundColor: [
    '#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444'
]
```

## 📱 Mobile Support

All charts are responsive and work well on mobile devices:
- Charts automatically resize to fit the screen
- Touch interactions are supported
- Legends are positioned for optimal mobile viewing

## 🚨 Troubleshooting

### Charts Not Loading
1. Check browser console for JavaScript errors
2. Verify that Chart.js is loaded correctly
3. Ensure the API endpoint is accessible
4. Check authentication token is valid

### No Data Showing
1. Run `npm run seed` to add sample data
2. Check if leads exist in the database
3. Verify that leads have sector and region fields populated

### Performance Issues
1. Limit the number of data points for large datasets
2. Consider implementing pagination for very large datasets
3. Use data aggregation for better performance

## 🔮 Future Enhancements

Planned improvements:
- **Real-time Updates**: WebSocket integration for live data
- **Export Features**: PDF/Excel export of charts
- **Advanced Filtering**: Date range, status, and custom filters
- **Drill-down Capability**: Click on chart elements to see detailed data
- **Custom Dashboards**: User-configurable chart layouts
- **Predictive Analytics**: AI-powered lead scoring and forecasting

---

**Need Help?** Check the main README.md or create an issue in the repository.
