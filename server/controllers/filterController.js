import FilterOption from '../models/FilterOption.js';

// Get all filter options grouped by type
export const getAllFilters = async (req, res) => {
  try {
    const filters = await FilterOption.find().sort({ type: 1, value: 1 });

    // Group by type
    const grouped = {
      uaNames: [],
      tickets: []
    };

    filters.forEach(filter => {
      switch (filter.type) {
        case 'uaName':
          grouped.uaNames.push({ id: filter._id, value: filter.value });
          break;
        case 'ticket':
          grouped.tickets.push({ id: filter._id, value: filter.value, ticketLink: filter.ticketLink });
          break;
      }
    });

    res.json(grouped);
  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({ message: 'Server error fetching filters' });
  }
};

// Add a new filter option
export const addFilter = async (req, res) => {
  try {
    const { type, value, ticketLink } = req.body;
    const userId = req.user.id;

    if (!type || !value) {
      return res.status(400).json({ message: 'Type and value are required' });
    }

    if (type === 'ticket' && !ticketLink) {
      return res.status(400).json({ message: 'Ticket link is required for ticket type' });
    }

    // Check if already exists
    const existing = await FilterOption.findOne({ type, value });
    if (existing) {
      return res.status(400).json({ message: 'This filter option already exists' });
    }

    const filter = new FilterOption({
      type,
      value: value.trim(),
      ticketLink: ticketLink ? ticketLink.trim() : undefined,
      createdBy: userId
    });

    await filter.save();

    res.status(201).json({
      message: 'Filter option added successfully',
      filter: {
        id: filter._id,
        type: filter.type,
        value: filter.value,
        ticketLink: filter.ticketLink
      }
    });
  } catch (error) {
    console.error('Add filter error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This filter option already exists' });
    }
    res.status(500).json({ message: 'Server error adding filter' });
  }
};

// Delete a filter option
export const deleteFilter = async (req, res) => {
  try {
    const { id } = req.params;

    const filter = await FilterOption.findByIdAndDelete(id);

    if (!filter) {
      return res.status(404).json({ message: 'Filter option not found' });
    }

    res.json({ message: 'Filter option deleted successfully' });
  } catch (error) {
    console.error('Delete filter error:', error);
    res.status(500).json({ message: 'Server error deleting filter' });
  }
};

// Initialize default filter options (for first-time setup)
export const initializeDefaultFilters = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if filters already exist
    const existingCount = await FilterOption.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({ message: 'Filters already initialized' });
    }

    const defaultFilters = [
      { type: 'uaName', value: 'SN045 - FGT Germany', createdBy: userId },
      { type: 'ticket', value: 'MTSP-57', createdBy: userId },
    ];

    await FilterOption.insertMany(defaultFilters);

    res.json({ message: 'Default filters initialized successfully' });
  } catch (error) {
    console.error('Initialize filters error:', error);
    res.status(500).json({ message: 'Server error initializing filters' });
  }
};
