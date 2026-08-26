import axios from 'axios';
import logger from '../config/logger.js';
import JiraConfig from '../models/JiraConfig.js';

// Simple in-memory cache to prevent rate limiting
const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Get JIRA Configuration from database or environment variables
const getJiraConfig = async () => {
  try {
    // Try to get from database first
    const config = await JiraConfig.findOne({ key: 'config' });
    
    return {
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
      baseUrl: process.env.JIRA_BASE_URL,
      parentTicketKey: config?.parentTicketKey || process.env.JIRA_PARENT_TICKET_KEY,
    };
  } catch (error) {
    logger.error('Error fetching JIRA config from database:', error);
    // Fallback to environment variables
    return {
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
      baseUrl: process.env.JIRA_BASE_URL,
      parentTicketKey: process.env.JIRA_PARENT_TICKET_KEY,
    };
  }
};

// Validate JIRA configuration
const validateConfig = async () => {
  const config = await getJiraConfig();
  const missing = [];
  if (!config.email) missing.push('JIRA_EMAIL');
  if (!config.apiToken) missing.push('JIRA_API_TOKEN');
  if (!config.baseUrl) missing.push('JIRA_BASE_URL');
  if (!config.parentTicketKey) missing.push('JIRA_PARENT_TICKET_KEY');
  
  if (missing.length > 0) {
    throw new Error(`Missing JIRA configuration: ${missing.join(', ')}`);
  }
  
  return config;
};

// Create axios instance with JIRA auth
const createJiraClient = async () => {
  const config = await getJiraConfig();
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  
  return axios.create({
    baseURL: config.baseUrl,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
};

// Get parent issue details
export const getParentIssue = async (req, res) => {
  try {
    const config = await validateConfig();
    const jiraClient = await createJiraClient();
    
    const response = await jiraClient.get(
      `/rest/api/3/issue/${config.parentTicketKey}`
    );
    
    const data = response.data;
    const fields = data.fields || {};
    
    const parentIssue = {
      key: data.key,
      summary: fields.summary,
      status: fields.status?.name,
      priority: fields.priority?.name,
      assignee: fields.assignee?.displayName || 'Unassigned',
      description: fields.description,
      created: fields.created,
      updated: fields.updated,
    };
    
    res.json(parentIssue);
  } catch (error) {
    logger.error('Error fetching parent JIRA issue:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch parent issue',
      message: error.message 
    });
  }
};

// Get all child issues with pagination
export const getChildIssues = async (req, res) => {
  try {
    const config = await validateConfig();
    const jiraClient = await createJiraClient();
    
    const jqlQuery = `parent = "${config.parentTicketKey}" order by created`;
    const allIssues = [];
    let nextPageToken = null;
    const maxResults = 100; // JIRA API max per page
    
    do {
      const params = {
        jql: jqlQuery,
        fields: 'summary,status,priority,assignee,created,updated,description',
        expand: 'names,schema',
        maxResults
      };
      
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }
      
      const response = await jiraClient.get('/rest/api/3/search/jql', { params });
      const data = response.data;
      
      const pageIssues = data.issues || [];
      allIssues.push(...pageIssues);
      
      nextPageToken = data.nextPageToken;
      const isLast = data.isLast;
      
      if (isLast || !nextPageToken) {
        break;
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } while (nextPageToken);
    
    // Transform issues and deduplicate
    const seenKeys = new Set();
    const transformedIssues = [];
    
    for (const issue of allIssues) {
      // Skip duplicates
      if (seenKeys.has(issue.key)) {
        logger.warn(`Duplicate issue key found: ${issue.key}, skipping`);
        continue;
      }
      seenKeys.add(issue.key);
      
      transformedIssues.push({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name || 'None',
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        created: issue.fields.created,
        updated: issue.fields.updated,
        description: issue.fields.description,
        url: `${config.baseUrl}/browse/${issue.key}`,
      });
    }
    
    res.json({
      total: transformedIssues.length,
      issues: transformedIssues,
    });
  } catch (error) {
    logger.error('Error fetching child JIRA issues:', error.message);
    if (error.response) {
      logger.error('JIRA API Response:', error.response.data);
    }
    res.status(500).json({ 
      error: 'Failed to fetch child issues',
      message: error.message,
      details: error.response?.data || null
    });
  }
};

// Get combined parent and child data
export const getAllTickets = async (req, res) => {
  try {
    // Debug: Log configuration status
    logger.info('JIRA getAllTickets called');
    const config = await getJiraConfig();
    logger.info('JIRA Config Status:', {
      email: config.email ? 'SET' : 'MISSING',
      token: config.apiToken ? 'SET (length: ' + (config.apiToken?.length || 0) + ')' : 'MISSING',
      baseUrl: config.baseUrl ? 'SET' : 'MISSING',
      parentKey: config.parentTicketKey ? 'SET' : 'MISSING',
    });
    
    // Check cache first
    const cacheKey = 'jira-all-tickets';
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      logger.info('Returning cached JIRA data');
      return res.json(cached.data);
    }
    
    const validatedConfig = await validateConfig();
    const jiraClient = await createJiraClient();
    
    // Step 1: Get parent issue details
    const parentResponse = await jiraClient.get(
      `/rest/api/3/issue/${validatedConfig.parentTicketKey}`
    );
    
    const parentData = parentResponse.data;
    const parentFields = parentData.fields || {};
    
    const parentIssue = {
      key: parentData.key,
      summary: parentFields.summary,
      status: parentFields.status?.name,
      priority: parentFields.priority?.name,
      assignee: parentFields.assignee?.displayName || 'Unassigned',
      created: parentFields.created,
      updated: parentFields.updated,
      url: `${validatedConfig.baseUrl}/browse/${parentData.key}`,
    };
    
    // Step 2: Fetch child issues using JQL endpoint with expansion
    const jqlQuery = `parent = "${validatedConfig.parentTicketKey}" order by created`;
    const allIssues = [];
    let nextPageToken = null;
    const maxResults = 100; // JIRA API max per page
    const maxTotalIssues = 1000; // Safety limit to prevent infinite loops
    
    do {
      const params = {
        jql: jqlQuery,
        fields: 'summary,status,priority,assignee,created,updated',
        expand: 'names,schema',
        maxResults
      };
      
      // Add pagination token if available
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }
      
      const response = await jiraClient.get('/rest/api/3/search/jql', { params });
      const data = response.data;
      
      const pageIssues = data.issues || [];
      allIssues.push(...pageIssues);
      
      // Update pagination
      nextPageToken = data.nextPageToken;
      const isLast = data.isLast;
      
      logger.info(`Fetched ${allIssues.length} JIRA issues, isLast: ${isLast}, nextPageToken: ${nextPageToken ? 'exists' : 'null'}`);
      
      // Safety check to prevent infinite loops
      if (allIssues.length >= maxTotalIssues) {
        logger.warn(`Reached safety limit of ${maxTotalIssues} issues, stopping fetch`);
        break;
      }
      
      // Break if this is the last page
      if (isLast || !nextPageToken) {
        break;
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } while (nextPageToken && allIssues.length < maxTotalIssues);
    
    // Transform issues to match our format and deduplicate
    const seenKeys = new Set();
    const transformedIssues = [];
    
    for (const issue of allIssues) {
      // Skip duplicates
      if (seenKeys.has(issue.key)) {
        logger.warn(`Duplicate issue key found: ${issue.key}, skipping`);
        continue;
      }
      seenKeys.add(issue.key);
      
      const fields = issue.fields;
      transformedIssues.push({
        key: issue.key,
        summary: fields.summary,
        status: fields.status?.name,
        priority: fields.priority?.name || 'None',
        assignee: fields.assignee?.displayName || 'Unassigned',
        created: fields.created,
        updated: fields.updated,
        url: `${validatedConfig.baseUrl}/browse/${issue.key}`,
      });
    }
    
    const result = {
      parent: parentIssue,
      children: {
        total: transformedIssues.length,
        issues: transformedIssues,
      },
    };
    
    // Cache the result
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    logger.info(`Successfully fetched ${transformedIssues.length} child work items`);
    
    // Log first few issues for debugging
    if (transformedIssues.length > 0) {
      logger.info('Sample issues:', transformedIssues.slice(0, 3).map(i => `${i.key}: ${i.summary}`));
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error fetching JIRA tickets:', error.message);
    if (error.response) {
      logger.error('JIRA API Response:', error.response.data);
    }
    
    // Handle rate limiting specifically
    if (error.response?.status === 429) {
      res.status(429).json({ 
        error: 'Rate limited by JIRA API',
        message: 'Too many requests. Please wait a moment and try again.',
        retryAfter: error.response.headers['retry-after'] || 60
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch JIRA tickets',
        message: error.message,
        details: error.response?.data || null
      });
    }
  }
};

// Get current parent ticket key
export const getParentTicketKey = async (req, res) => {
  try {
    const config = await getJiraConfig();
    res.json({ parentTicketKey: config.parentTicketKey });
  } catch (error) {
    logger.error('Error fetching parent ticket key:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch parent ticket key',
      message: error.message 
    });
  }
};

// Update parent ticket key
export const updateParentTicketKey = async (req, res) => {
  try {
    const { parentTicketKey } = req.body;
    
    if (!parentTicketKey || typeof parentTicketKey !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid parent ticket key',
        message: 'Parent ticket key must be a non-empty string' 
      });
    }

    // Validate the ticket key format (basic validation)
    const ticketKeyPattern = /^[A-Z]+-\d+$/;
    if (!ticketKeyPattern.test(parentTicketKey)) {
      return res.status(400).json({ 
        error: 'Invalid ticket key format',
        message: 'Ticket key must be in format: PROJECT-123' 
      });
    }

    // Update or create the config in database
    const updatedConfig = await JiraConfig.findOneAndUpdate(
      { key: 'config' },
      { 
        parentTicketKey,
        updatedAt: new Date(),
        updatedBy: req.user?.email || 'unknown'
      },
      { upsert: true, new: true }
    );

    // Clear cache to force refresh
    cache.clear();

    logger.info(`Parent ticket key updated to: ${parentTicketKey} by ${req.user?.email || 'unknown'}`);

    res.json({ 
      success: true,
      parentTicketKey: updatedConfig.parentTicketKey,
      message: 'Parent ticket key updated successfully' 
    });
  } catch (error) {
    logger.error('Error updating parent ticket key:', error.message);
    res.status(500).json({ 
      error: 'Failed to update parent ticket key',
      message: error.message 
    });
  }
};

// Natural Language Query endpoint
export const queryTickets = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid query',
        message: 'Query must be a non-empty string' 
      });
    }

    // Import the parser
    const { parseNaturalLanguageQuery, getQuerySuggestions } = await import('../utils/nlQueryParser.js');
    
    // Parse the natural language query
    const parsed = parseNaturalLanguageQuery(query);
    logger.info('Parsed NL query:', { 
      query, 
      entities: parsed.entities, 
      validation: parsed.validation,
      jql: parsed.jql 
    });
    
    // If validation failed, return error with suggestions
    if (!parsed.validation.isValid) {
      return res.status(400).json({
        error: 'Query validation failed',
        message: 'The query contains invalid entities',
        query: parsed.query,
        entities: parsed.entities,
        validation: parsed.validation,
        suggestions: getQuerySuggestions(parsed.entities, parsed.validation),
      });
    }
    
    // Get JIRA config
    const config = await validateConfig();
    const jiraClient = await createJiraClient();
    
    // First, fetch all fields to discover custom field IDs
    const fieldsResponse = await jiraClient.get('/rest/api/3/field');
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
            // Prefer customfield_x format
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
    
    // Build fields list to request
    const requestedFields = [
      'issuetype',
      'summary',
      'status',
      'priority',
      'assignee',
      'created',
      'updated',
      'duedate'
    ];
    
    // Add discovered custom fields
    Object.values(customFieldMap).forEach(fieldId => {
      if (fieldId) requestedFields.push(fieldId);
    });
    
    // Use the parent ticket from query or fall back to config
    const parentTicket = parsed.entities.parentTicket || config.parentTicketKey;
    
    // Build final JQL - if parent ticket wasn't in query, add it
    let finalJQL = parsed.jql;
    if (!parsed.entities.parentTicket && parentTicket) {
      // Check if there are other filters in the JQL
      if (finalJQL && finalJQL !== 'ORDER BY rank') {
        // Insert parent at the beginning
        finalJQL = `parent = ${parentTicket} AND ${finalJQL}`;
      } else {
        // Only parent ticket
        finalJQL = `parent = ${parentTicket} ORDER BY rank`;
      }
    }
    
    logger.info('Executing JQL:', { jql: finalJQL });
    
    // Fetch issues using the generated JQL
    const allIssues = [];
    let nextPageToken = null;
    const maxResults = 100;
    const maxTotalIssues = 1000;
    
    do {
      const params = {
        jql: finalJQL,
        fields: requestedFields.join(','),
        expand: 'names,schema',
        maxResults
      };
      
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }
      
      const response = await jiraClient.get('/rest/api/3/search/jql', { params });
      const data = response.data;
      
      const pageIssues = data.issues || [];
      allIssues.push(...pageIssues);
      
      nextPageToken = data.nextPageToken;
      const isLast = data.isLast;
      
      if (isLast || !nextPageToken || allIssues.length >= maxTotalIssues) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } while (nextPageToken && allIssues.length < maxTotalIssues);
    
    // Helper function to normalize JIRA field values
    const normalizeValue = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'object') {
        // Common JIRA structures
        if (value.displayName) return value.displayName;
        if (value.value) return value.value;
        if (value.name) return value.name;
        return JSON.stringify(value);
      }
      if (Array.isArray(value)) {
        return value.map(v => normalizeValue(v)).join(', ');
      }
      return value;
    };
    
    // Transform issues with all custom fields
    const transformedIssues = allIssues.map(issue => {
      const fields = issue.fields;
      
      return {
        key: issue.key,
        id: issue.id,
        issueType: normalizeValue(fields.issuetype),
        summary: normalizeValue(fields.summary),
        status: normalizeValue(fields.status),
        priority: normalizeValue(fields.priority) || 'None',
        assignee: normalizeValue(fields.assignee) || 'Unassigned',
        created: fields.created,
        updated: fields.updated,
        dueDate: fields.duedate,
        url: `${config.baseUrl}/browse/${issue.key}`,
        // Custom fields
        componentTask: customFieldMap.component_task ? normalizeValue(fields[customFieldMap.component_task]) : null,
        completionDate: customFieldMap.completion_date ? normalizeValue(fields[customFieldMap.completion_date]) : null,
        affectedComponent: customFieldMap.affected_failed_component ? normalizeValue(fields[customFieldMap.affected_failed_component]) : null,
        offComponentPN: customFieldMap.off_component_pn ? normalizeValue(fields[customFieldMap.off_component_pn]) : null,
        offComponentSN: customFieldMap.off_component_sn ? normalizeValue(fields[customFieldMap.off_component_sn]) : null,
        onComponentPN: customFieldMap.on_component_pn ? normalizeValue(fields[customFieldMap.on_component_pn]) : null,
        onComponentSN: customFieldMap.on_component_sn ? normalizeValue(fields[customFieldMap.on_component_sn]) : null,
      };
    });
    
    // Get suggestions if confidence is low or there are warnings
    const suggestions = parsed.confidence < 0.7 || parsed.validation.warnings.length > 0 
      ? getQuerySuggestions(parsed.entities, parsed.validation) 
      : [];
    
    res.json({
      query: parsed.query,
      entities: parsed.entities,
      validation: parsed.validation,
      jql: finalJQL,
      confidence: parsed.confidence,
      suggestions,
      customFields: customFieldMap, // Include field mapping for reference
      results: {
        total: transformedIssues.length,
        issues: transformedIssues,
      },
    });
    
  } catch (error) {
    logger.error('Error processing natural language query:', error.message);
    res.status(500).json({ 
      error: 'Failed to process query',
      message: error.message,
      details: error.response?.data || null
    });
  }
};

// Direct JQL Query endpoint
export const queryTicketsJQL = async (req, res) => {
  try {
    const { jql } = req.body;
    
    if (!jql || typeof jql !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid JQL',
        message: 'JQL must be a non-empty string' 
      });
    }
    
    logger.info('Executing direct JQL query:', { jql });
    
    // Get JIRA config
    const config = await validateConfig();
    const jiraClient = await createJiraClient();
    
    // First, fetch all fields to discover custom field IDs
    const fieldsResponse = await jiraClient.get('/rest/api/3/field');
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
    
    // Build fields list to request
    const requestedFields = [
      'issuetype',
      'summary',
      'status',
      'priority',
      'assignee',
      'created',
      'updated',
      'duedate'
    ];
    
    // Add discovered custom fields
    Object.values(customFieldMap).forEach(fieldId => {
      if (fieldId) requestedFields.push(fieldId);
    });
    
    // Fetch issues using the provided JQL
    const allIssues = [];
    let nextPageToken = null;
    const maxResults = 100;
    const maxTotalIssues = 1000;
    
    do {
      const params = {
        jql: jql,
        fields: requestedFields.join(','),
        expand: 'names,schema',
        maxResults
      };
      
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }
      
      const response = await jiraClient.get('/rest/api/3/search/jql', { params });
      const data = response.data;
      
      const pageIssues = data.issues || [];
      allIssues.push(...pageIssues);
      
      nextPageToken = data.nextPageToken;
      const isLast = data.isLast;
      
      if (isLast || !nextPageToken || allIssues.length >= maxTotalIssues) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } while (nextPageToken && allIssues.length < maxTotalIssues);
    
    // Helper function to normalize JIRA field values
    const normalizeValue = (value) => {
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
      return value;
    };
    
    // Transform issues with all custom fields
    const transformedIssues = allIssues.map(issue => {
      const fields = issue.fields;
      
      return {
        key: issue.key,
        id: issue.id,
        issueType: normalizeValue(fields.issuetype),
        summary: normalizeValue(fields.summary),
        status: normalizeValue(fields.status),
        priority: normalizeValue(fields.priority) || 'None',
        assignee: normalizeValue(fields.assignee) || 'Unassigned',
        created: fields.created,
        updated: fields.updated,
        dueDate: fields.duedate,
        url: `${config.baseUrl}/browse/${issue.key}`,
        // Custom fields
        componentTask: customFieldMap.component_task ? normalizeValue(fields[customFieldMap.component_task]) : null,
        completionDate: customFieldMap.completion_date ? normalizeValue(fields[customFieldMap.completion_date]) : null,
        affectedComponent: customFieldMap.affected_failed_component ? normalizeValue(fields[customFieldMap.affected_failed_component]) : null,
        offComponentPN: customFieldMap.off_component_pn ? normalizeValue(fields[customFieldMap.off_component_pn]) : null,
        offComponentSN: customFieldMap.off_component_sn ? normalizeValue(fields[customFieldMap.off_component_sn]) : null,
        onComponentPN: customFieldMap.on_component_pn ? normalizeValue(fields[customFieldMap.on_component_pn]) : null,
        onComponentSN: customFieldMap.on_component_sn ? normalizeValue(fields[customFieldMap.on_component_sn]) : null,
      };
    });
    
    res.json({
      query: jql,
      jql: jql,
      results: {
        total: transformedIssues.length,
        issues: transformedIssues,
      },
    });
    
  } catch (error) {
    logger.error('Error processing JQL query:', error.message);
    res.status(500).json({ 
      error: 'Failed to process JQL query',
      message: error.message,
      details: error.response?.data || null
    });
  }
};
