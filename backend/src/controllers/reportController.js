import Report from '../models/Report.js';
import Mission from '../models/Mission.js';

// Helper: owner filter
const ownerFilter = (req) => {
  if (!req.user) return {};
  if (req.user.role === 'admin') return {};
  return { createdBy: req.user.id };
};

// Get all reports (scoped to user unless admin)
export const getReports = async (req, res) => {
  try {
    const filter = ownerFilter(req);
    const reports = await Report.find(filter).populate('mission').populate('drone');
    res.json(reports);
  } catch (error) {
    console.error('getReports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Create a report
export const createReport = async (req, res) => {
  try {
    const createdBy = req.user && (req.user.id ?? req.user._id);
    if (!createdBy) return res.status(403).json({ error: 'Not allowed' });

    // Basic ownership check: ensure mission belongs to user (unless admin)
    const missionId = req.body.mission;
    if (!missionId) return res.status(400).json({ error: 'mission is required' });

    if (req.user.role !== 'admin') {
      const mission = await Mission.findById(missionId);
      if (!mission) return res.status(404).json({ error: 'Mission not found' });
      if (String(mission.createdBy) !== String(createdBy)) {
        return res.status(403).json({ error: 'Not allowed to create report for this mission' });
      }
    }

    const payload = { ...req.body, createdBy };
    const report = await Report.create(payload);

    // Update mission status to completed when report is created
    try {
      await Mission.findByIdAndUpdate(req.body.mission, { status: 'completed', progress: 100 });
    } catch (e) {
      console.warn('Failed to update mission status after report creation', e);
    }

    res.status(201).json(report);
  } catch (error) {
    console.error('createReport error:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
};

// Get analytics summary (only for user's reports unless admin)
export const getAnalytics = async (req, res) => {
  try {
    const filter = ownerFilter(req);

    const totalReports = await Report.countDocuments(filter);
    const totalDistance = await Report.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$distance" } } },
    ]);
    const totalCoverage = await Report.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$coverage" } } },
    ]);

    res.json({
      totalReports,
      totalDistance: totalDistance[0]?.total || 0,
      totalCoverage: totalCoverage[0]?.total || 0
    });
  } catch (error) {
    console.error('getAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
