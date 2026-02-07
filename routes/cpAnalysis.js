import express from 'express';
import groqAnalyzer from '../services/groqAnalyzer.js';
import aiDetector from '../services/aiDetector.js';

const router=express.Router();

// Analyze code with Groq AI
router.post('/analyze', async (req, res) =>
{
    try
    {
        const {code, language, executionResult}=req.body;
        if (!code||!language) return res.status(400).json({error: 'Missing required fields', message: 'Code and language are required'});
        const analysis=await groqAnalyzer.analyzeCode({code, language, executionResult});
        res.json({success: true, analysis});
    } catch (error)
    {
        console.error('Analysis error:', error);
        res.status(500).json({success: false, error: 'Analysis failed', message: error.message});
    }
});

// Get improvement suggestions
router.post('/suggestions', async (req, res) =>
{
    try
    {
        const {code, language}=req.body;
        const suggestions=await groqAnalyzer.getSuggestions(code, language);
        res.json({success: true, suggestions});
    } catch (error)
    {
        res.status(500).json({error: 'Failed to get suggestions', message: error.message});
    }
});

// AI-generated code detection
router.post('/detect-ai', async (req, res) =>
{
    try
    {
        const {code, language, behaviorMetrics}=req.body;
        if (!code||!language) return res.status(400).json({success: false, error: 'Code and language are required'});
        const result=await aiDetector.detectAIGenerated(code, language, behaviorMetrics||{});
        res.json({success: true, detection: result});
    } catch (error)
    {
        console.error('AI detection error:', error);
        res.status(500).json({success: false, error: 'AI detection failed', message: error.message});
    }
});

export default router;
