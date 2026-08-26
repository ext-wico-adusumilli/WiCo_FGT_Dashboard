/**
 * Natural Language Query Parser for JIRA Tickets
 * Extracts entities from plain English queries and converts them to JQL
 * 
 * Pipeline:
 * 1. User Input
 * 2. Query Parser (extract entities)
 * 3. Query Validator (validate entities)
 * 4. JQL Generator (build query)
 * 5. JIRA Fetch (execute query)
 */

// Component types mapping
const COMPONENT_TYPES = {
  motor: ['motor', 'motors'],
  esc: ['esc', 'escs', 'electronic speed controller'],
  propeller: ['propeller', 'propellers', 'prop', 'props'],
  battery: ['battery', 'batteries'],
  controller: ['controller', 'controllers', 'fc', 'flight controller'],
  sensor: ['sensor', 'sensors'],
  communication: ['communication', 'comm', 'lte', 'modem'],
  actuator: ['actuator', 'actuators', 'servo', 'servos'],
  structure: ['structure', 'airframe', 'frame'],
};

// Task types mapping
const TASK_TYPES = {
  replacement: ['replacement', 'replace', 'replaced', 'swap', 'swapped'],
  repair: ['repair', 'repaired', 'fix', 'fixed'],
  maintenance: ['maintenance', 'maintain', 'service', 'serviced'],
  inspection: ['inspection', 'inspect', 'inspected', 'check', 'checked'],
  upgrade: ['upgrade', 'upgraded', 'update', 'updated'],
};

// Valid MTSP ticket patterns
const VALID_TICKET_PATTERNS = {
  mtsp: /^MTSP-\d+$/i,
  // Add more project patterns as needed
};

// Supported component types (for validation)
const SUPPORTED_COMPONENTS = Object.keys(COMPONENT_TYPES);

// Supported task types (for validation)
const SUPPORTED_TASKS = Object.keys(TASK_TYPES);

// Component field values for JQL (based on Python scripts)
const COMPONENT_FIELD_VALUES = {
  motor: ['Motor 1', 'Motor 2', 'Motor 3', 'Motor 4', 'Motor 5', 'Motor 6', 'Motor 7', 'Motor 8'],
  esc: ['ESC 1', 'ESC 2', 'ESC 3', 'ESC 4', 'ESC 5', 'ESC 6', 'ESC 7', 'ESC 8'],
  propeller: ['Propeller 1', 'Propeller 2', 'Propeller 3', 'Propeller 4', 'Propeller 5', 'Propeller 6', 'Propeller 7', 'Propeller 8'],
  battery: ['Battery', 'Battery Pack'],
  controller: ['Flight Controller', 'FC', 'Controller'],
  sensor: ['Sensor', 'GPS', 'IMU', 'Barometer'],
  communication: ['Communication Unit', 'LTE Module', 'Modem'],
  actuator: ['Actuator', 'Servo'],
  structure: ['Airframe', 'Structure', 'Frame'],
};

/**
 * Extract parent ticket key from query
 * @param {string} query - Natural language query
 * @returns {string|null} - Parent ticket key (e.g., MTSP-52)
 */
function extractParentTicket(query) {
  // Match patterns like MTSP-52, PROJ-123, etc.
  const ticketPattern = /([A-Z][A-Z0-9]+-\d+)/i;
  const match = query.match(ticketPattern);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Extract component type from query
 * @param {string} query - Natural language query
 * @returns {string|null} - Component type key
 */
function extractComponentType(query) {
  const lowerQuery = query.toLowerCase();
  
  for (const [componentKey, keywords] of Object.entries(COMPONENT_TYPES)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        return componentKey;
      }
    }
  }
  
  return null;
}

/**
 * Extract task type from query
 * @param {string} query - Natural language query
 * @returns {string|null} - Task type key
 */
function extractTaskType(query) {
  const lowerQuery = query.toLowerCase();
  
  for (const [taskKey, keywords] of Object.entries(TASK_TYPES)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        return taskKey;
      }
    }
  }
  
  return null;
}

/**
 * Extract specific component number from query
 * @param {string} query - Natural language query
 * @param {string} componentType - Component type
 * @returns {number|null} - Component number (1-8)
 */
function extractComponentNumber(query, componentType) {
  const lowerQuery = query.toLowerCase();
  
  // Look for patterns like "motor 3", "esc 5", etc.
  const numberPattern = new RegExp(`${componentType}\\s*(\\d+)`, 'i');
  const match = lowerQuery.match(numberPattern);
  
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 8) {
      return num;
    }
  }
  
  return null;
}

/**
 * Build JQL query from extracted entities
 * @param {Object} entities - Extracted entities
 * @returns {string} - JQL query string
 */
function buildJQL(entities) {
  const { parentTicket, componentType, taskType, componentNumber } = entities;
  
  let jqlParts = [];
  
  // Parent ticket filter
  if (parentTicket) {
    jqlParts.push(`parent = ${parentTicket}`);
  }
  
  // Task type filter (should come before component filter for better performance)
  if (taskType) {
    const taskValue = taskType.charAt(0).toUpperCase() + taskType.slice(1);
    jqlParts.push(`"component task[dropdown]" = "${taskValue}"`);
  }
  
  // Component filter - ONLY use affected or failed component field, NOT summary
  if (componentType) {
    const componentValues = COMPONENT_FIELD_VALUES[componentType];
    if (componentValues && componentValues.length > 0) {
      // If specific component number is mentioned
      if (componentNumber !== null) {
        const specificComponent = componentValues.find(v => 
          v.toLowerCase().includes(`${componentType} ${componentNumber}`)
        );
        if (specificComponent) {
          jqlParts.push(`"affected or failed component[dropdown]" = "${specificComponent}"`);
        }
      } else {
        // All components of this type
        const quotedValues = componentValues.map(v => `"${v}"`).join(',');
        jqlParts.push(`"affected or failed component[dropdown]" IN (${quotedValues})`);
      }
    }
  }
  
  // Build the query with proper AND placement
  let jql = jqlParts.join(' AND ');
  
  // Add ordering at the end (not with AND)
  if (jql) {
    jql += ' ORDER BY rank';
  } else {
    jql = 'ORDER BY rank';
  }
  
  return jql;
}

/**
 * Validate extracted entities
 * @param {Object} entities - Extracted entities
 * @returns {Object} - Validation result with errors and warnings
 */
function validateEntities(entities) {
  const errors = [];
  const warnings = [];
  let isValid = true;
  
  // Validate parent ticket format
  if (entities.parentTicket) {
    const ticketUpper = entities.parentTicket.toUpperCase();
    let validFormat = false;
    
    for (const [projectKey, pattern] of Object.entries(VALID_TICKET_PATTERNS)) {
      if (pattern.test(ticketUpper)) {
        validFormat = true;
        break;
      }
    }
    
    if (!validFormat) {
      errors.push(`Invalid ticket format: ${entities.parentTicket}. Expected format: MTSP-XX`);
      isValid = false;
    }
  } else {
    warnings.push('No parent ticket specified. Results may be too broad.');
  }
  
  // Validate component type
  if (entities.componentType) {
    if (!SUPPORTED_COMPONENTS.includes(entities.componentType)) {
      errors.push(`Unsupported component type: ${entities.componentType}. Supported: ${SUPPORTED_COMPONENTS.join(', ')}`);
      isValid = false;
    }
  } else {
    warnings.push('No component type specified. Showing all components.');
  }
  
  // Validate task type
  if (entities.taskType) {
    if (!SUPPORTED_TASKS.includes(entities.taskType)) {
      errors.push(`Unsupported task type: ${entities.taskType}. Supported: ${SUPPORTED_TASKS.join(', ')}`);
      isValid = false;
    }
  } else {
    warnings.push('No task type specified. Showing all task types.');
  }
  
  // Validate component number
  if (entities.componentNumber !== null) {
    if (entities.componentNumber < 1 || entities.componentNumber > 8) {
      errors.push(`Invalid component number: ${entities.componentNumber}. Must be between 1 and 8.`);
      isValid = false;
    }
    
    // Check if component type supports numbering
    const componentType = entities.componentType;
    if (componentType && !['motor', 'esc', 'propeller'].includes(componentType)) {
      warnings.push(`Component type "${componentType}" typically doesn't use numbers. Number may be ignored.`);
    }
  }
  
  return {
    isValid,
    errors,
    warnings,
  };
}

/**
 * Parse natural language query and extract entities
 * @param {string} query - Natural language query
 * @returns {Object} - Parsed entities, validation results, and generated JQL
 */
export function parseNaturalLanguageQuery(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  
  // Step 1: Parse - Extract entities from query
  const parentTicket = extractParentTicket(query);
  const componentType = extractComponentType(query);
  const taskType = extractTaskType(query);
  const componentNumber = componentType ? extractComponentNumber(query, componentType) : null;
  
  const entities = {
    parentTicket,
    componentType,
    taskType,
    componentNumber,
  };
  
  // Step 2: Validate - Check if entities are valid
  const validation = validateEntities(entities);
  
  // Step 3: Generate JQL - Only if validation passes
  let jql = '';
  if (validation.isValid) {
    jql = buildJQL(entities);
  }
  
  // Step 4: Calculate confidence
  const confidence = calculateConfidence(entities, validation);
  
  return {
    query: query.trim(),
    entities,
    validation,
    jql,
    confidence,
  };
}

/**
 * Calculate confidence score for parsed query
 * @param {Object} entities - Extracted entities
 * @param {Object} validation - Validation results
 * @returns {number} - Confidence score (0-1)
 */
function calculateConfidence(entities, validation) {
  let score = 0;
  let maxScore = 0;
  
  // If validation failed, confidence is very low
  if (!validation.isValid) {
    return 0.1;
  }
  
  // Parent ticket is most important
  maxScore += 40;
  if (entities.parentTicket) score += 40;
  
  // Component type
  maxScore += 30;
  if (entities.componentType) score += 30;
  
  // Task type
  maxScore += 20;
  if (entities.taskType) score += 20;
  
  // Specific component number
  maxScore += 10;
  if (entities.componentNumber !== null) score += 10;
  
  // Reduce confidence for warnings
  const warningPenalty = validation.warnings.length * 0.05;
  const finalScore = (score / maxScore) - warningPenalty;
  
  return Math.max(0, Math.min(1, finalScore));
}

/**
 * Get suggestions for query improvement
 * @param {Object} entities - Extracted entities
 * @param {Object} validation - Validation results
 * @returns {Array<string>} - Suggestions
 */
export function getQuerySuggestions(entities, validation) {
  const suggestions = [];
  
  // Add validation errors as suggestions
  if (validation && validation.errors) {
    suggestions.push(...validation.errors);
  }
  
  // Add validation warnings as suggestions
  if (validation && validation.warnings) {
    suggestions.push(...validation.warnings);
  }
  
  // Add improvement suggestions
  if (!entities.parentTicket) {
    suggestions.push('Add a parent ticket key (e.g., MTSP-52) for better results');
  }
  
  if (!entities.componentType) {
    suggestions.push('Specify a component type (e.g., Motor, ESC, Propeller)');
  }
  
  if (!entities.taskType) {
    suggestions.push('Specify a task type (e.g., Replacement, Repair, Maintenance)');
  }
  
  return suggestions;
}

/**
 * Get example queries
 * @returns {Array<string>} - Example queries
 */
export function getExampleQueries() {
  return [
    'show ESC replacements under MTSP-52',
    'motor replacements in MTSP-52',
    'find all motor 3 replacements under MTSP-52',
    'show battery repairs under MTSP-45',
    'propeller maintenance in MTSP-52',
    'list all ESC 5 replacements',
    'show flight controller upgrades under MTSP-52',
    'find sensor inspections in MTSP-52',
  ];
}
