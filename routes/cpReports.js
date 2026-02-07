import express from 'express';
import reportGenerator from '../services/reportGenerator.js';

const router=express.Router();

// Generate markdown report
router.post('/generate', async (req, res) =>
{
    try
    {
        const {code, language, executionResult, analysis}=req.body;
        if (!code||!language) return res.status(400).json({error: 'Missing required fields'});
        const report=reportGenerator.generateReport({code, language, executionResult, analysis});
        res.json({success: true, markdown: report.markdown, filename: report.filename, timestamp: report.timestamp});
    } catch (error)
    {
        console.error('Report generation error:', error);
        res.status(500).json({success: false, error: 'Report generation failed', message: error.message});
    }
});

// Download report as file
router.post('/download', async (req, res) =>
{
    try
    {
        const {markdown, filename}=req.body;
        if (!markdown) return res.status(400).json({error: 'Missing markdown content'});
        const reportFilename=filename||`report_${Date.now()}.md`;
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFilename}"`);
        res.send(markdown);
    } catch (error)
    {
        res.status(500).json({error: 'Download failed', message: error.message});
    }
});

export default router;
