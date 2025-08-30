const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TeleCRM API Documentation',
      version: '1.0.0',
      description: 'Comprehensive API documentation for TeleCRM - SIM-Based Calling CRM System',
      contact: {
        name: 'TeleCRM Development Team',
        email: 'dev@telecrm.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://api.telecrm.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID'
            },
            name: {
              type: 'string',
              description: 'User full name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            role: {
              type: 'string',
              enum: ['admin', 'manager', 'employee'],
              description: 'User role in the system'
            },
            manager: {
              type: 'object',
              properties: {
                _id: {
                  type: 'string'
                },
                name: {
                  type: 'string'
                },
                email: {
                  type: 'string'
                }
              },
              description: 'Manager information (for employees)'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp'
            }
          }
        },
        Lead: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Lead ID'
            },
            name: {
              type: 'string',
              description: 'Lead name'
            },
            phone: {
              type: 'string',
              description: 'Lead phone number'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Lead email address'
            },
            status: {
              type: 'string',
              enum: ['New', 'Interested', 'Hot', 'Follow-up', 'Won', 'Lost'],
              description: 'Current lead status'
            },
            notes: {
              type: 'string',
              description: 'Additional notes about the lead'
            },
            sector: {
              type: 'string',
              enum: ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Real Estate', 'Other'],
              description: 'Business sector of the lead'
            },
            region: {
              type: 'string',
              enum: ['North', 'South', 'East', 'West', 'Central', 'International'],
              description: 'Geographic region of the lead'
            },
            assignedTo: {
              $ref: '#/components/schemas/User',
              description: 'Employee assigned to this lead'
            },
            createdBy: {
              $ref: '#/components/schemas/User',
              description: 'User who created this lead'
            },
            followUpDate: {
              type: 'string',
              format: 'date',
              description: 'Date for follow-up action'
            },
            sellingPrice: {
              type: 'number',
              description: 'Selling price when lead is won'
            },
            lossReason: {
              type: 'string',
              description: 'Reason when lead is lost'
            },
            recordingUrl: {
              type: 'string',
              description: 'URL of uploaded call recording'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Lead creation timestamp'
            }
          }
        },
        Campaign: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Campaign ID'
            },
            name: {
              type: 'string',
              description: 'Campaign name'
            },
            description: {
              type: 'string',
              description: 'Campaign description'
            },
            startDate: {
              type: 'string',
              format: 'date',
              description: 'Campaign start date'
            },
            endDate: {
              type: 'string',
              format: 'date',
              description: 'Campaign end date'
            },
            targetAudience: {
              type: 'string',
              enum: ['all', 'new', 'hot', 'follow-up', 'custom'],
              description: 'Target audience for the campaign'
            },
            campaignType: {
              type: 'string',
              enum: ['email', 'sms', 'social', 'phone', 'multi'],
              description: 'Type of campaign'
            },
            status: {
              type: 'string',
              enum: ['Draft', 'Active', 'Paused', 'Completed', 'Cancelled'],
              description: 'Current campaign status'
            },
            budget: {
              type: 'number',
              description: 'Campaign budget'
            },
            metrics: {
              type: 'object',
              properties: {
                reach: { type: 'number' },
                impressions: { type: 'number' },
                clicks: { type: 'number' },
                conversions: { type: 'number' },
                engagementRate: { type: 'number' },
                conversionRate: { type: 'number' },
                ctr: { type: 'number' },
                roi: { type: 'number' },
                cost: { type: 'number' },
                revenue: { type: 'number' }
              }
            },
            createdBy: {
              $ref: '#/components/schemas/User',
              description: 'User who created this campaign'
            },
            assignedTo: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/User'
              },
              description: 'Users assigned to this campaign'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Campaign creation timestamp'
            }
          }
        },
        SimCard: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'SIM card ID'
            },
            simNumber: {
              type: 'string',
              description: 'SIM card number'
            },
            carrier: {
              type: 'string',
              enum: ['Airtel', 'Jio', 'Vodafone', 'BSNL', 'MTNL', 'Other'],
              description: 'Mobile network carrier'
            },
            status: {
              type: 'string',
              enum: ['Active', 'Inactive', 'Suspended', 'Blocked', 'Recharge Required'],
              description: 'Current SIM card status'
            },
            balance: {
              type: 'number',
              description: 'Current balance in rupees'
            },
            dataBalance: {
              type: 'number',
              description: 'Data balance in MB'
            },
            validity: {
              type: 'string',
              format: 'date',
              description: 'SIM card validity date'
            },
            assignedTo: {
              $ref: '#/components/schemas/User',
              description: 'Employee assigned to this SIM'
            },
            assignedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Assignment timestamp'
            },
            totalCalls: {
              type: 'number',
              description: 'Total calls made using this SIM'
            },
            totalMinutes: {
              type: 'number',
              description: 'Total minutes used'
            },
            lastUsed: {
              type: 'string',
              format: 'date-time',
              description: 'Last usage timestamp'
            },
            plan: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                monthlyRental: { type: 'number' },
                freeMinutes: { type: 'number' },
                freeData: { type: 'number' },
                validityDays: { type: 'number' }
              }
            },
            createdBy: {
              $ref: '#/components/schemas/User',
              description: 'User who created this SIM card'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'SIM card creation timestamp'
            }
          }
        },
        CallLog: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Call log ID'
            },
            lead: {
              $ref: '#/components/schemas/Lead',
              description: 'Lead associated with this call'
            },
            employee: {
              $ref: '#/components/schemas/User',
              description: 'Employee who made the call'
            },
            simCard: {
              $ref: '#/components/schemas/SimCard',
              description: 'SIM card used for the call'
            },
            callStatus: {
              type: 'string',
              enum: ['completed', 'missed', 'declined', 'not_lifted', 'wrong_number', 'busy', 'unreachable', 'voicemail'],
              description: 'Status of the call'
            },
            callDuration: {
              type: 'number',
              description: 'Call duration in seconds'
            },
            callStartTime: {
              type: 'string',
              format: 'date-time',
              description: 'Call start timestamp'
            },
            callEndTime: {
              type: 'string',
              format: 'date-time',
              description: 'Call end timestamp'
            },
            callQuality: {
              type: 'object',
              properties: {
                signalStrength: {
                  type: 'string',
                  enum: ['Excellent', 'Good', 'Fair', 'Poor']
                },
                networkType: {
                  type: 'string',
                  enum: ['2G', '3G', '4G', '5G']
                },
                audioQuality: {
                  type: 'string',
                  enum: ['Crystal Clear', 'Clear', 'Fair', 'Poor', 'Unusable']
                }
              }
            },
            outcome: {
              type: 'string',
              enum: ['Positive', 'Neutral', 'Negative', 'Follow-up Required', 'Not Interested', 'Interested', 'Hot Lead', 'Converted'],
              description: 'Call outcome'
            },
            notes: {
              type: 'string',
              description: 'Call notes'
            },
            followUpRequired: {
              type: 'boolean',
              description: 'Whether follow-up is required'
            },
            followUpDate: {
              type: 'string',
              format: 'date',
              description: 'Follow-up date'
            },
            recordingUrl: {
              type: 'string',
              description: 'URL of call recording'
            },
            callCost: {
              type: 'number',
              description: 'Cost of the call'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['Sales Call', 'Support Call', 'Follow-up', 'Cold Call', 'Warm Call', 'Hot Lead', 'Demo Call', 'Survey Call']
              }
            },
            effectiveness: {
              type: 'object',
              properties: {
                engagement: { type: 'number', minimum: 1, maximum: 10 },
                interest: { type: 'number', minimum: 1, maximum: 10 },
                conversion: { type: 'number', minimum: 1, maximum: 10 }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Call log creation timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'string',
              description: 'Detailed error information'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Admin',
        description: 'Administrator-only endpoints for system management'
      },
      {
        name: 'Manager',
        description: 'Manager endpoints for team and lead management'
      },
      {
        name: 'Employee',
        description: 'Employee endpoints for lead and call management'
      },
      {
        name: 'Lead Management',
        description: 'Lead creation, updates, and management'
      },
      {
        name: 'Campaign Management',
        description: 'Marketing campaign management'
      },
      {
        name: 'SIM Management',
        description: 'SIM card management and assignment'
      },
      {
        name: 'Call Management',
        description: 'Call logging and analytics'
      },
      {
        name: 'Performance',
        description: 'Performance metrics and analytics'
      },
      {
        name: 'Dashboard',
        description: 'Dashboard data and summaries'
      }
    ]
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './models/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TeleCRM API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      deepLinking: true
    }
  })
};
