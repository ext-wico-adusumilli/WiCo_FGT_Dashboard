import MTTFData from '../models/MTTFData.js';
import MTTFCategory from '../models/MTTFCategory.js';
import LogDetail from '../models/LogDetail.js';
import axios from 'axios';
import logger from '../config/logger.js';

// Get all categories
export const getCategories = async (req, res) => {
  try {
    const categories = await MTTFCategory.find({ isActive: true }).sort({ order: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error fetching categories' });
  }
};

// Initialize default categories
export const initializeCategories = async (req, res) => {
  try {
    const existingCount = await MTTFCategory.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({ message: 'Categories already initialized' });
    }

    const defaultCategories = [
      { id: 'structure', label: 'Structure/Airframe', order: 1 },
      { id: 'propulsion', label: 'Propulsion System', order: 2 },
      { id: 'actuators', label: 'Actuators (Tilt and Control Surface)', order: 3 },
      { id: 'controller', label: 'Controller and Sensor', order: 4 },
      { id: 'communication', label: 'Communication Unit', order: 5 },
    ];

    await MTTFCategory.insertMany(defaultCategories);
    res.json({ message: 'Categories initialized successfully' });
  } catch (error) {
    console.error('Initialize categories error:', error);
    res.status(500).json({ message: 'Server error initializing categories' });
  }
};

// Get MTTF data with filters
export const getMTTFData = async (req, res) => {
  try {
    const { category, uaSpecification, uaName, serialNumber, ticket } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (uaSpecification) filter.uaSpecification = uaSpecification;
    if (uaName) filter.uaName = uaName;
    if (serialNumber) filter.serialNumber = serialNumber;
    if (ticket) filter.ticket = ticket;

    const data = await MTTFData.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(data);
  } catch (error) {
    console.error('Get MTTF data error:', error);
    res.status(500).json({ message: 'Server error fetching MTTF data' });
  }
};

// Create new MTTF data entry
export const createMTTFData = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = new MTTFData({
      ...req.body,
      createdBy: userId,
      updatedBy: userId
    });

    await data.save();

    const populatedData = await MTTFData.findById(data._id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.status(201).json({
      message: 'MTTF data created successfully',
      data: populatedData
    });
  } catch (error) {
    console.error('Create MTTF data error:', error);
    res.status(500).json({ message: 'Server error creating MTTF data' });
  }
};

// Update MTTF data entry
export const updateMTTFData = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const data = await MTTFData.findByIdAndUpdate(
      id,
      { ...req.body, updatedBy: userId },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!data) {
      return res.status(404).json({ message: 'MTTF data not found' });
    }

    res.json({
      message: 'MTTF data updated successfully',
      data
    });
  } catch (error) {
    console.error('Update MTTF data error:', error);
    res.status(500).json({ message: 'Server error updating MTTF data' });
  }
};

// Delete MTTF data entry
export const deleteMTTFData = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await MTTFData.findByIdAndDelete(id);

    if (!data) {
      return res.status(404).json({ message: 'MTTF data not found' });
    }

    res.json({ message: 'MTTF data deleted successfully' });
  } catch (error) {
    console.error('Delete MTTF data error:', error);
    res.status(500).json({ message: 'Server error deleting MTTF data' });
  }
};

// Get flight time analysis data from LogDetail
export const getFlightTimeAnalysis = async (req, res) => {
  try {
    const { sn } = req.query;

    if (!sn) {
      return res.status(400).json({ message: 'Serial number is required' });
    }

    // Fetch flight data for the specified serial number
    const logs = await LogDetail.find({
      sn: { $regex: sn, $options: 'i' },
      flight: true
    }).sort({ date: 1 });

    if (logs.length === 0) {
      return res.json({
        summary: [],
        lookup: {},
        firstFlight: null
      });
    }

    // Group by date and calculate totals
    const dateMap = new Map();

    logs.forEach(log => {
      const date = log.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, 0);
      }
      dateMap.set(date, dateMap.get(date) + ((log.filtered_flight_time || 0) / 3600));
    });

    // Convert to array and calculate cumulative
    const summary = [];
    let cumulative = 0;

    const sortedDates = Array.from(dateMap.keys()).sort();

    sortedDates.forEach(date => {
      const totalDuration = dateMap.get(date);
      cumulative += totalDuration;

      // Parse date from YYMMDD format
      const year = parseInt('20' + date.substring(0, 2));
      const month = parseInt(date.substring(2, 4));
      const day = parseInt(date.substring(4, 6));
      const formattedDate = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).slice(-2)}`;

      summary.push({
        date: formattedDate,
        totalDuration: parseFloat(totalDuration.toFixed(2)),
        cumulativeDuration: parseFloat(cumulative.toFixed(2))
      });
    });

    // Create lookup map for date -> cumulative duration
    const lookup = {};
    summary.forEach(item => {
      lookup[item.date] = item.cumulativeDuration;
    });

    // Get first flight
    const firstFlight = summary.length > 0 ? summary[0] : null;

    res.json({
      summary,
      lookup,
      firstFlight
    });

  } catch (error) {
    logger.error('Get flight time analysis error:', error);
    res.status(500).json({ message: 'Server error fetching flight time analysis' });
  }
};

// Get component replacements from JIRA
export const getComponentReplacements = async (req, res) => {
  try {
    const { parentTicket, taskTypes } = req.body;

    if (!parentTicket) {
      return res.status(400).json({ message: 'Parent ticket is required' });
    }

    // Get JIRA configuration
    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraToken = process.env.JIRA_API_TOKEN;
    const jiraBaseUrl = process.env.JIRA_BASE_URL;

    if (!jiraEmail || !jiraToken || !jiraBaseUrl) {
      return res.status(500).json({ message: 'JIRA configuration is missing' });
    }

    const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');

    // Define all component types
    const allComponents = [
      'Motor 1', 'Motor 2', 'Motor 3', 'Motor 4', 'Motor 5', 'Motor 6', 'Motor 7', 'Motor 8',
      'ESC 1', 'ESC 2', 'ESC 3', 'ESC 4', 'ESC 5', 'ESC 6', 'ESC 7', 'ESC 8',
      'Prop M1', 'Prop M2', 'Prop M3', 'Prop M4', 'Prop M5', 'Prop M6', 'Prop M7', 'Prop M8',
      'Battery', 'Battery Pack',
      'Flight Controller', 'FC', 'Controller',
      'Sensor', 'GPS', 'IMU', 'Barometer',
      'Actuator', 'Servo',
      'Airframe', 'Structure', 'Frame'
    ];

    // Build JQL query
    let jql = `parent = ${parentTicket}`;
    
    if (taskTypes && taskTypes.length > 0) {
      if (taskTypes.length === 1) {
        jql += ` AND customfield_10286 = "${taskTypes[0]}"`;
      } else {
        const taskFilter = taskTypes.map(t => `"${t}"`).join(', ');
        jql += ` AND customfield_10286 IN (${taskFilter})`;
      }
    }

    // Add component filter
    const componentFilter = allComponents.map(c => `"${c}"`).join(', ');
    jql += ` AND customfield_10188 IN (${componentFilter}) ORDER BY rank`;

    logger.info('Executing JIRA query:', { jql });

    // Fetch all fields to discover custom field IDs
    let fieldsResponse;
    try {
      fieldsResponse = await axios.get(`${jiraBaseUrl}/rest/api/3/field`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });
    } catch (axiosError) {
      logger.error('Failed to fetch JIRA fields:', { 
        message: axiosError.message,
        response: axiosError.response?.data,
        status: axiosError.response?.status
      });
      return res.status(500).json({ 
        message: 'Failed to fetch JIRA fields',
        error: axiosError.message 
      });
    }

    const allFields = fieldsResponse.data;

    // Map custom field keywords to their IDs
    const customFieldMap = {};
    const customFieldKeywords = {
      component_task: ['component task', 'componenttask'],
      completion_date: ['completion date', 'completion_date', 'completion'],
      affected_failed_component: ['affected or failed component', 'affected/failed component', 'affected failed component'],
      off_component_pn: ['off component pn', 'off component part', 'off component part number'],
      off_component_sn: ['off component sn', 'off component serial', 'off component serial number'],
      on_component_pn: ['on component pn', 'on component part number'],
      on_component_sn: ['on component sn', 'on component serial']
    };

    // Find custom field IDs
    for (const [logicalKey, keywords] of Object.entries(customFieldKeywords)) {
      for (const field of allFields) {
        const fieldName = (field.name || '').toLowerCase();
        const fieldId = field.id;

        for (const keyword of keywords) {
          if (fieldName.includes(keyword)) {
            if (fieldId && fieldId.startsWith('customfield_')) {
              customFieldMap[logicalKey] = fieldId;
              break;
            } else {
              customFieldMap[logicalKey] = field.name;
            }
          }
        }
        if (customFieldMap[logicalKey]) break;
      }
    }

    logger.info('Discovered custom fields:', customFieldMap);

    // Build fields list
    const requestedFields = [
      'issuetype',
      'summary',
      'status',
      'created',
      'updated',
      'duedate'
    ];

    Object.values(customFieldMap).forEach(fieldId => {
      if (fieldId) requestedFields.push(fieldId);
    });

    // Fetch issues with pagination
    const allIssues = [];
    let startAt = 0;
    const maxResults = 100;

    try {
      while (true) {
        logger.info(`Fetching JIRA issues: startAt=${startAt}, maxResults=${maxResults}`);
        
        const response = await axios.get(`${jiraBaseUrl}/rest/api/3/search/jql`, {
          params: {
            jql,
            startAt,
            maxResults,
            fields: requestedFields.join(',')
          },
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          },
          timeout: 15000,
          validateStatus: function (status) {
            return status >= 200 && status < 500; // Don't throw on 4xx errors
          }
        });

        // Check if response was successful
        if (response.status !== 200) {
          logger.error('JIRA API returned non-200 status:', {
            status: response.status,
            data: response.data
          });
          return res.status(500).json({ 
            message: 'JIRA API error',
            error: `JIRA returned status ${response.status}`,
            details: response.data
          });
        }

        const data = response.data;
        const issues = data.issues || [];

        logger.info(`Fetched ${issues.length} issues in this batch`);

        if (issues.length === 0) break;

        allIssues.push(...issues);
        startAt += issues.length;

        if (allIssues.length >= (data.total || 0)) break;
        
        // Safety limit
        if (allIssues.length >= 1000) {
          logger.warn('Reached safety limit of 1000 issues');
          break;
        }
      }
    } catch (axiosError) {
      logger.error('Failed to fetch JIRA issues:', { 
        message: axiosError.message,
        response: axiosError.response?.data,
        status: axiosError.response?.status,
        stack: axiosError.stack
      });
      return res.status(500).json({ 
        message: 'Failed to fetch JIRA issues',
        error: axiosError.message,
        details: axiosError.response?.data || axiosError.message
      });
    }

    logger.info(`Fetched ${allIssues.length} issues from JIRA`);

    // Helper function to normalize JIRA field values
    const normalizeValue = (value) => {
      try {
        if (value === null || value === undefined) return null;
        if (typeof value === 'object') {
          if (value.displayName) return value.displayName;
          if (value.value) return value.value;
          if (value.name) return value.name;
          return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
          return value.map(v => normalizeValue(v)).join(', ');
        }
        return String(value);
      } catch (err) {
        logger.warn('Error normalizing value:', { value, error: err.message });
        return null;
      }
    };

    // Transform issues
    const replacements = allIssues.map(issue => {
      try {
        const fields = issue.fields || {};

        return {
          key: issue.key || '',
          id: issue.id || '',
          issueType: normalizeValue(fields.issuetype),
          summary: normalizeValue(fields.summary),
          status: normalizeValue(fields.status),
          created: fields.created || null,
          updated: fields.updated || null,
          dueDate: fields.duedate || null,
          componentTask: customFieldMap.component_task ? normalizeValue(fields[customFieldMap.component_task]) : null,
          completionDate: customFieldMap.completion_date ? normalizeValue(fields[customFieldMap.completion_date]) : null,
          affectedComponent: customFieldMap.affected_failed_component ? normalizeValue(fields[customFieldMap.affected_failed_component]) : null,
          offComponentPN: customFieldMap.off_component_pn ? normalizeValue(fields[customFieldMap.off_component_pn]) : null,
          offComponentSN: customFieldMap.off_component_sn ? normalizeValue(fields[customFieldMap.off_component_sn]) : null,
          onComponentPN: customFieldMap.on_component_pn ? normalizeValue(fields[customFieldMap.on_component_pn]) : null,
          onComponentSN: customFieldMap.on_component_sn ? normalizeValue(fields[customFieldMap.on_component_sn]) : null,
        };
      } catch (err) {
        logger.error('Error transforming issue:', { issueKey: issue.key, error: err.message });
        return null;
      }
    }).filter(r => r !== null);

    logger.info(`Transformed ${replacements.length} replacements successfully`);

    res.json({
      total: replacements.length,
      replacements
    });

  } catch (error) {
    logger.error('Get component replacements error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Ensure we always send a response
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Server error fetching component replacements',
        error: error.message,
        details: error.response?.data || null
      });
    }
  }
};
