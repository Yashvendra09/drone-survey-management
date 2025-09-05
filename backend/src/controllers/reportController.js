import Report from '../models/Report.js';
import Mission from '../models/Mission.js';

// Get all reports
export const getReports = async (req, res) => {
  try {
    const reports = await Report.find().populate('mission').populate('drone');
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Create a report
export const createReport = async (req, res) => {
  try {
    const report = await Report.create(req.body);

    // Update mission status to completed when report is created
    await Mission.findByIdAndUpdate(req.body.mission, { status: 'completed', progress: 100 });

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create report' });
  }
};

// Get analytics summary
export const getAnalytics = async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const totalDistance = await Report.aggregate([{ $group: { _id: null, total: { $sum: "$distance" } } }]);
    const totalCoverage = await Report.aggregate([{ $group: { _id: null, total: { $sum: "$coverage" } } }]);

    res.json({
      totalReports,
      totalDistance: totalDistance[0]?.total || 0,
      totalCoverage: totalCoverage[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
