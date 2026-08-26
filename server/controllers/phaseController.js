/**
 * Phase Controller
 * Handles HTTP requests for phase and data selection management
 */

import Phase from '../models/Phase.js';

class PhaseController {
  /**
   * Get all active phases
   */
  async getPhases(req, res) {
    try {
      const phases = await Phase.findActive();
      
      res.json({
        success: true,
        data: phases,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching phases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch phases',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get specific phase details
   */
  async getPhase(req, res) {
    try {
      const { phaseId } = req.params;
      
      const phase = await Phase.findOne({ id: phaseId, isActive: true });
      
      if (!phase) {
        return res.status(404).json({
          success: false,
          message: `Phase ${phaseId} not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: phase,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error fetching phase ${req.params.phaseId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch phase ${req.params.phaseId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get blob storage structure
   */
  async getBlobStructure(req, res) {
    try {
      const { path } = req.query;
      
      // Mock blob storage structure for now
      // In production, this would query actual blob storage
      const structure = {
        name: path || 'root',
        path: path || '/',
        fileCount: 150,
        totalSize: 1024 * 1024 * 500, // 500 MB
        subfolders: [
          {
            name: 'phase1',
            path: '/phase1',
            fileCount: 50,
            totalSize: 1024 * 1024 * 150
          },
          {
            name: 'phase2',
            path: '/phase2',
            fileCount: 100,
            totalSize: 1024 * 1024 * 350
          }
        ]
      };
      
      res.json({
        success: true,
        data: structure,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching blob structure:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch blob storage structure',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get data selection summary
   */
  async getDataSummary(req, res) {
    try {
      const { phaseIds, dateRange } = req.body;
      
      if (!phaseIds || !Array.isArray(phaseIds) || phaseIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Phase IDs are required',
          timestamp: new Date().toISOString()
        });
      }
      
      // Fetch selected phases
      const phases = await Phase.find({ id: { $in: phaseIds }, isActive: true });
      
      if (phases.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No valid phases found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Calculate summary
      const totalFiles = phases.reduce((sum, phase) => sum + (phase.fileCount || 0), 0);
      const totalSize = phases.reduce((sum, phase) => sum + (phase.sizeBytes || 0), 0);
      
      // Determine date range
      const dates = phases.flatMap(p => [new Date(p.startDate), new Date(p.endDate)]);
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      
      const summary = {
        totalFiles,
        totalSize,
        dateRange: {
          start: minDate.toISOString().split('T')[0],
          end: maxDate.toISOString().split('T')[0]
        },
        sources: phases.map(p => p.name)
      };
      
      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error calculating data summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate data summary',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Validate data selection
   */
  async validateSelection(req, res) {
    try {
      const { phaseIds, dateRange } = req.body;
      
      // Validate phase IDs
      if (phaseIds && Array.isArray(phaseIds) && phaseIds.length > 0) {
        const phases = await Phase.find({ id: { $in: phaseIds }, isActive: true });
        
        if (phases.length !== phaseIds.length) {
          return res.json({
            success: true,
            data: {
              valid: false,
              message: 'Some selected phases are not available'
            },
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Validate date range
      if (dateRange) {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        
        if (start > end) {
          return res.json({
            success: true,
            data: {
              valid: false,
              message: 'Start date must be before end date'
            },
            timestamp: new Date().toISOString()
          });
        }
      }
      
      res.json({
        success: true,
        data: {
          valid: true,
          message: 'Selection is valid'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error validating selection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate selection',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Create a new phase
   */
  async createPhase(req, res) {
    try {
      const phaseData = req.body;
      
      // Validate required fields
      if (!phaseData.id || !phaseData.name || !phaseData.startDate || !phaseData.endDate || !phaseData.dataPath) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: id, name, startDate, endDate, dataPath',
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if phase already exists
      const existingPhase = await Phase.findOne({ id: phaseData.id });
      if (existingPhase) {
        return res.status(409).json({
          success: false,
          message: `Phase with ID ${phaseData.id} already exists`,
          timestamp: new Date().toISOString()
        });
      }
      
      const phase = new Phase(phaseData);
      await phase.save();
      
      res.status(201).json({
        success: true,
        data: phase,
        message: `Phase ${phaseData.name} created successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating phase:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create phase',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update an existing phase
   */
  async updatePhase(req, res) {
    try {
      const { phaseId } = req.params;
      const updateData = req.body;
      
      updateData.updatedAt = new Date().toISOString();
      
      const phase = await Phase.findOneAndUpdate(
        { id: phaseId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!phase) {
        return res.status(404).json({
          success: false,
          message: `Phase ${phaseId} not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: phase,
        message: `Phase ${phaseId} updated successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error updating phase ${req.params.phaseId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to update phase ${req.params.phaseId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Delete a phase (soft delete by setting isActive to false)
   */
  async deletePhase(req, res) {
    try {
      const { phaseId } = req.params;
      
      const phase = await Phase.findOneAndUpdate(
        { id: phaseId },
        { isActive: false, updatedAt: new Date().toISOString() },
        { new: true }
      );
      
      if (!phase) {
        return res.status(404).json({
          success: false,
          message: `Phase ${phaseId} not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        message: `Phase ${phaseId} deleted successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error deleting phase ${req.params.phaseId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to delete phase ${req.params.phaseId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default new PhaseController();
