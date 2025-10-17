const XLSX = require('xlsx');
const Lead = require('../models/Lead');

/**
 * Excel Parser Utility for Lead Uploads
 * Supports .xlsx, .xls, and .csv files with flexible column mapping
 */
class ExcelParser {
  constructor() {
    this.supportedFormats = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.template.macroEnabled.12'
    ];

    this.expectedColumns = {
      primary: ['Name', 'Phone', 'Website', 'Location', 'Sector'],
      optional: ['Status', 'Notes', 'Assigned To']
    };

    this.columnMappings = {
      // Name variations
      name: ['Name', 'name', 'Lead Name', 'Company Name', 'Company', 'Client Name', 'Contact Name', 'Business Name', 'Organization'],

      // Phone variations
      phone: ['Phone', 'phone', 'Phone Number', 'Contact Number', 'Mobile', 'Telephone', 'Tel', 'Phone No', 'Contact'],

      // Email variations
      email: ['Email', 'email', 'E-mail', 'Email Address', 'Contact Email'],

      // Website variations
      website: ['Website', 'website', 'URL', 'Company Website', 'Site', 'Web', 'Web Site'],

      // Location variations
      location: ['Location', 'location', 'City', 'Address', 'State', 'Country', 'Region', 'Area', 'Place', 'District'],

      // Sector variations
      sector: ['Sector', 'sector', 'Industry', 'Business Type', 'Category', 'Field', 'Department', 'Business'],

      // Status variations
      status: ['Status', 'status', 'Lead Status', 'State', 'Progress', 'Stage'],

      // Notes variations
      notes: ['Notes', 'notes', 'Comments', 'Remarks', 'Description', 'Additional Notes', 'Comment']
    };
  }

  /**
   * Validate file format and size
   */
  validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    // Check if file has buffer (memory storage) or path (disk storage)
    if (!file.buffer && !file.path) {
      throw new Error('Invalid file object - missing buffer or path');
    }

    if (!this.supportedFormats.includes(file.mimetype)) {
      throw new Error(`Unsupported file format: ${file.mimetype}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum limit of 10MB`);
    }

    return true;
  }

  /**
   * Read and parse Excel file
   */
  async parseExcelFile(file, options = {}) {
    try {
      this.validateFile(file);

      const {
        skipDuplicates = true,
        validateData = true,
        batchSize = 1000,
        progressCallback = null
      } = options;

      // Read file buffer
      const workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        cellDates: true,
        cellStyles: true
      });

      // Get first worksheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('No worksheets found in file');
      }

      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with header row detection
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false
      });

      if (rawData.length === 0) {
        throw new Error('File is empty or contains no data');
      }

      // Detect headers and map columns
      const { headers, columnMap } = this.detectHeaders(rawData[0]);
      
      // Check if we have at least the minimum required columns (name and phone)
      const requiredColumns = ['name', 'phone'];
      const missingRequired = requiredColumns.filter(col =>
        columnMap[col] === undefined || columnMap[col] === null
      );

      if (missingRequired.length > 0) {
        throw new Error(`Missing required columns: ${missingRequired.join(', ')}. Expected columns: ${Object.keys(this.columnMappings).join(', ')}. Found columns: ${headers.join(', ')}`);
      }

      // Log which columns were successfully mapped for debugging
      console.log(`Column mapping: ${Object.keys(columnMap).length}/${headers.length} columns mapped successfully`);

      // Process data rows
      const dataRows = rawData.slice(1);
      const parsedLeads = [];
      const errors = [];
      const duplicates = [];

      console.log(`Processing ${dataRows.length} rows from Excel file...`);

      for (let i = 0; i < dataRows.length; i++) {
        const rowIndex = i + 2; // +2 because we're 0-indexed and skipping header row

        try {
          // Debug: Log raw row data for first few rows
          if (i < 3) {
            console.log(`Row ${rowIndex} raw data:`, dataRows[i]);
            console.log(`Row ${rowIndex} headers:`, headers);
            console.log(`Row ${rowIndex} column mapping:`, columnMap);
          }

          const leadData = this.extractLeadData(dataRows[i], columnMap, headers);

          // Debug: Log extracted data for first few rows
          if (i < 3) {
            console.log(`Row ${rowIndex} extracted data:`, leadData);
          }

          if (validateData) {
            const validation = this.validateLeadData(leadData, rowIndex);
            if (!validation.isValid) {
              console.log(`Row ${rowIndex} validation failed:`, validation.errors);
              // For now, let's be more lenient and only require name and phone to be present
              if (!leadData.name || !leadData.phone) {
                errors.push({
                  row: rowIndex,
                  errors: validation.errors
                });
                continue;
              } else {
                console.log(`Row ${rowIndex} proceeding despite validation warnings`);
              }
            }
          }

          // Check for duplicates if enabled
          if (skipDuplicates) {
            const existingLead = await Lead.findOne({ phone: leadData.phone });
            if (existingLead) {
              console.log(`Row ${rowIndex} duplicate found:`, leadData.phone);
              duplicates.push({
                row: rowIndex,
                phone: leadData.phone,
                existingId: existingLead._id
              });
              continue;
            }
          }

          parsedLeads.push(leadData);

          // Debug: Log successful parsing for first few rows
          if (i < 3) {
            console.log(`Row ${rowIndex} parsed successfully:`, leadData.name, leadData.phone);
          }

          // Batch processing for large files
          if (parsedLeads.length >= batchSize) {
            if (progressCallback) {
              progressCallback({
                processed: i + 1,
                total: dataRows.length,
                parsed: parsedLeads.length,
                errors: errors.length,
                duplicates: duplicates.length
              });
            }
          }

        } catch (error) {
          errors.push({
            row: rowIndex,
            errors: [error.message]
          });
        }
      }

      // Final progress update
      if (progressCallback) {
        progressCallback({
          processed: dataRows.length,
          total: dataRows.length,
          parsed: parsedLeads.length,
          errors: errors.length,
          duplicates: duplicates.length,
          completed: true
        });
      }

      return {
        success: true,
        data: {
          headers,
          columnMap,
          leads: parsedLeads,
          summary: {
            totalRows: dataRows.length,
            parsedLeads: parsedLeads.length,
            errors: errors.length,
            duplicates: duplicates.length
          },
          errors,
          duplicates
        }
      };

    } catch (error) {
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  /**
   * Detect and map column headers with improved flexibility
   */
  detectHeaders(headerRow) {
    const headers = headerRow.map(header =>
      typeof header === 'string' ? header.trim() : String(header).trim()
    );

    const columnMap = {};

    // Map each expected field to actual column index
    Object.entries(this.columnMappings).forEach(([field, variations]) => {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];

        // Check for exact matches first
        const exactMatch = variations.find(variation =>
          header.toLowerCase() === variation.toLowerCase()
        );
        if (exactMatch) {
          columnMap[field] = i;
          break;
        }

        // Check for partial matches (contains)
        const partialMatch = variations.find(variation => {
          const matches = header.toLowerCase().includes(variation.toLowerCase()) ||
                         variation.toLowerCase().includes(header.toLowerCase());
          return matches;
        });
        if (partialMatch) {
          columnMap[field] = i;
          break;
        }

        // Check for common abbreviations and typos
        const normalizedHeader = header.toLowerCase()
          .replace(/[^a-z0-9]/g, '') // Remove special characters
          .replace(/num$/, 'number') // Handle "Phone Num" -> "Phone Number"
          .replace(/no$/, 'number')
          .replace(/addr$/, 'address');

        const normalizedMatch = variations.find(variation => {
          const normalizedVariation = variation.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedHeader.includes(normalizedVariation) ||
                 normalizedVariation.includes(normalizedHeader);
        });
        if (normalizedMatch) {
          columnMap[field] = i;
          break;
        }
      }
    });

    console.log('Final column mapping:', columnMap);
    return { headers, columnMap };
  }

  /**
   * Extract lead data from row using column mapping
   */
  extractLeadData(row, columnMap, headers) {
    const leadData = {};

    Object.entries(columnMap).forEach(([field, columnIndex]) => {
      const rawValue = row[columnIndex];
      if (rawValue !== undefined && rawValue !== '') {
        let value = String(rawValue).trim();

        // Clean and format data based on field type
        switch (field) {
          case 'name':
            value = this.cleanName(value);
            break;
          case 'phone':
            value = this.cleanPhone(value);
            break;
          case 'website':
            value = this.cleanWebsite(value);
            break;
          case 'location':
            value = this.cleanLocation(value);
            break;
          case 'sector':
            value = this.cleanSector(value);
            break;
          case 'status':
            value = this.cleanStatus(value);
            break;
          case 'notes':
            value = this.cleanNotes(value);
            break;
        }

        if (value) {
          leadData[field] = value;
        }
      }
    });

    // Set defaults
    if (!leadData.status) {
      leadData.status = 'New';
    }

    return leadData;
  }

  /**
   * Validate lead data (minimal validation only)
   */
  validateLeadData(leadData, rowIndex) {
    const errors = [];

    // Only check for required fields - no format validation
    if (!leadData.name || leadData.name.length === 0) {
      errors.push('Name is required');
    }

    if (!leadData.phone || leadData.phone.length === 0) {
      errors.push('Phone number is required');
    }

    // Accept data as-is without format validation
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean and format name
   */
  cleanName(name) {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s\-&.,]/g, '') // Remove special characters except allowed ones
      .substring(0, 100); // Limit length
  }

  /**
   * Clean and format phone number
   */
  cleanPhone(phone) {
    return phone
      .trim()
      .replace(/\D/g, '') // Remove non-digits
      .substring(0, 15); // Limit length for international numbers
  }

  /**
   * Clean and format website URL
   */
  cleanWebsite(website) {
    let cleaned = website.trim().toLowerCase();

    // Add protocol if missing
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned;
    }

    // Remove trailing slash
    cleaned = cleaned.replace(/\/$/, '');

    return cleaned;
  }

  /**
   * Clean and format location
   */
  cleanLocation(location) {
    return location
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 100);
  }

  /**
   * Clean and format sector
   */
  cleanSector(sector) {
    return sector
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 50);
  }

  /**
   * Clean and format status
   */
  cleanStatus(status) {
    const normalized = status.trim();
    
    // Map common variations to standard values
    const statusMap = {
      'new': 'New',
      'interested': 'Interested',
      'not interested': 'Not Interested',
      'hot': 'Hot',
      'cold': 'New',
      'warm': 'Interested',
      'prospect': 'New',
      'lead': 'New',
      'customer': 'Interested',
      'client': 'Interested'
    };

    return statusMap[normalized.toLowerCase()] || normalized;
  }

  /**
   * Clean and format notes
   */
  cleanNotes(notes) {
    return notes
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 1000);
  }

  /**
   * Validate phone number format
   */
  isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate website URL format
   */
  isValidWebsite(website) {
    const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    return urlRegex.test(website);
  }

  /**
   * Generate parsing report
   */
  generateReport(parseResult) {
    const { data } = parseResult;
    const { summary, errors, duplicates } = data;

    return {
      fileSummary: {
        totalRows: summary.totalRows,
        successfullyParsed: summary.parsedLeads,
        errors: summary.errors,
        duplicates: summary.duplicates,
        successRate: `${((summary.parsedLeads / summary.totalRows) * 100).toFixed(1)}%`
      },
      errors: errors.slice(0, 10), // Show first 10 errors
      duplicates: duplicates.slice(0, 10), // Show first 10 duplicates
      columnMapping: data.columnMap,
      detectedHeaders: data.headers
    };
  }
}

module.exports = new ExcelParser();