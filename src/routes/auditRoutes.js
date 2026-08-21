const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { requirePermission } = require('../middleware/authMiddleware');

// GET /api/audit-logs
router.get('/', requirePermission('audit.view'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;

    const logs = auditService.getLogs(limit, offset);
    const total = auditService.count();

    res.json({
      success: true,
      logs,
      total,
      limit,
      offset
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
