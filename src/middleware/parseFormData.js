export const parseFormDataTypes = (req, res, next) => {
    if (!req.body) return next();
    
    const parsers = {
      boolean: (value) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return ['true', '1', 'yes'].includes(value.toLowerCase());
        }
        return false;
      },
      number: (value) => {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? value : parsed;
      },
      date: (value) => {
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date;
      }
    };
  
    // Define field types
    const fieldTypes = {
      paymentRequired: 'boolean',
      maxAttendees: 'number',
      dateTime: 'date'
    };
  
    // Parse fields
    Object.keys(fieldTypes).forEach(field => {
      if (req.body[field] !== undefined) {
        const type = fieldTypes[field];
        const parser = parsers[type];
        if (parser) {
          req.body[field] = parser(req.body[field]);
        }
      }
    });
  
    
    
    next();
  };