import BatteryOverview from '../models/BatteryOverview.js';

// Get all battery overview entries
export const getAllEntries = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    
    // Convert page and limit to numbers and apply reasonable limits
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit))); // Max 1000 records per request
    const skip = (pageNum - 1) * limitNum;

    // Get paginated records
    const [entries, totalCount] = await Promise.all([
      BatteryOverview.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      BatteryOverview.countDocuments()
    ]);
    
    res.json({
      data: entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ message: 'Server error fetching entries' });
  }
};

// Create new entry
export const createEntry = async (req, res) => {
  try {
    const { batterySN, flights, cycleCount, peakTemperature } = req.body;

    // Validate required fields
    if (!batterySN || flights === undefined || cycleCount === undefined || peakTemperature === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Create new entry
    const entry = new BatteryOverview({
      batterySN,
      flights: Number(flights),
      cycleCount: Number(cycleCount),
      peakTemperature: Number(peakTemperature)
    });

    await entry.save();

    res.status(201).json({
      message: 'Entry created successfully',
      entry
    });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ message: 'Server error creating entry' });
  }
};

// Update entry
export const updateEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    const { batterySN, flights, cycleCount, peakTemperature } = req.body;

    const entry = await BatteryOverview.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    // Update fields
    if (batterySN) entry.batterySN = batterySN;
    if (flights !== undefined) entry.flights = Number(flights);
    if (cycleCount !== undefined) entry.cycleCount = Number(cycleCount);
    if (peakTemperature !== undefined) entry.peakTemperature = Number(peakTemperature);

    await entry.save();

    res.json({
      message: 'Entry updated successfully',
      entry
    });
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ message: 'Server error updating entry' });
  }
};

// Delete entry
export const deleteEntry = async (req, res) => {
  try {
    const { entryId } = req.params;

    const entry = await BatteryOverview.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    await BatteryOverview.findByIdAndDelete(entryId);

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ message: 'Server error deleting entry' });
  }
};
