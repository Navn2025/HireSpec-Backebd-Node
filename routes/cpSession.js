import express from 'express';
import sessionManager from '../services/sessionManager.js';

const router=express.Router();

router.post('/create', async (req, res) =>
{
    try
    {
        const {userId, problemId, timeLimit, maxSubmissions}=req.body;
        const session=sessionManager.createSession({userId: userId||'anonymous', problemId: problemId||'default', timeLimit, maxSubmissions: maxSubmissions||10});
        res.json({success: true, session: {sessionId: session.sessionId, startTime: session.startTime, timeLimit: session.timeLimit, maxSubmissions: session.maxSubmissions}});
    } catch (error)
    {
        console.error('Session creation error:', error);
        res.status(500).json({success: false, error: 'Failed to create session', message: error.message});
    }
});

router.get('/:sessionId', async (req, res) =>
{
    try
    {
        const session=sessionManager.getSession(req.params.sessionId);
        if (!session) return res.status(404).json({success: false, error: 'Session not found'});
        res.json({success: true, session});
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to get session', message: error.message});
    }
});

router.post('/violation', async (req, res) =>
{
    try
    {
        const {sessionId, violationType, details}=req.body;
        if (!sessionId||!violationType) return res.status(400).json({success: false, error: 'sessionId and violationType are required'});
        const session=sessionManager.recordViolation(sessionId, violationType, details);
        res.json({success: true, violations: session.violations, totalViolations: Object.values(session.violations).reduce((s, c) => s+c, 0), status: session.status});
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to record violation', message: error.message});
    }
});

router.post('/metrics', async (req, res) =>
{
    try
    {
        const {sessionId, metrics}=req.body;
        if (!sessionId||!metrics) return res.status(400).json({success: false, error: 'Missing required fields'});
        const session=sessionManager.updateMetrics(sessionId, metrics);
        res.json({success: true, metrics: session.metrics});
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to update metrics', message: error.message});
    }
});

router.post('/check-cooldown', async (req, res) =>
{
    try
    {
        const {sessionId, cooldownMs}=req.body;
        if (!sessionId) return res.status(400).json({success: false, error: 'sessionId is required'});
        const result=sessionManager.checkSubmissionCooldown(sessionId, cooldownMs||3000);
        if (!result.allowed) return res.status(429).json({success: false, allowed: false, remainingTime: result.remainingTime, message: result.message});
        res.json({success: true, allowed: true});
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to check cooldown', message: error.message});
    }
});

router.post('/complete', async (req, res) =>
{
    try
    {
        const {sessionId}=req.body;
        if (!sessionId) return res.status(400).json({success: false, error: 'sessionId is required'});
        sessionManager.completeSession(sessionId);
        const summary=sessionManager.getSessionSummary(sessionId);
        res.json({success: true, summary});
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to complete session', message: error.message});
    }
});

router.post('/terminate', async (req, res) =>
{
    try
    {
        const {sessionId, reason}=req.body;
        if (!sessionId) return res.status(400).json({success: false, error: 'sessionId is required'});
        sessionManager.terminateSession(sessionId, reason||'manual');
        const summary=sessionManager.getSessionSummary(sessionId);
        res.json({success: true, summary});
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to terminate session', message: error.message});
    }
});

router.get('/:sessionId/summary', async (req, res) =>
{
    try
    {
        const summary=sessionManager.getSessionSummary(req.params.sessionId);
        res.json({success: true, summary});
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to get summary', message: error.message});
    }
});

export default router;
