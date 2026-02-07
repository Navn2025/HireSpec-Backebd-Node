import express from 'express';
import codeExecutor from '../services/codeExecutor.js';
import sessionManager from '../services/sessionManager.js';

const router=express.Router();

// Execute code with session tracking
router.post('/execute', async (req, res) =>
{
    try
    {
        const {code, language, input, sessionId}=req.body;
        if (!code||!language) return res.status(400).json({error: 'Missing required fields', message: 'Code and language are required'});

        if (sessionId)
        {
            try
            {
                const cooldownCheck=sessionManager.checkSubmissionCooldown(sessionId, 3000);
                if (!cooldownCheck.allowed) return res.status(429).json({success: false, error: 'Cooldown active', message: cooldownCheck.message, remainingTime: cooldownCheck.remainingTime});
            } catch (err) {console.warn('Session check failed:', err.message);}
        }

        const result=await codeExecutor.execute(code, language, input||'');

        if (sessionId)
        {
            try {sessionManager.recordSubmission(sessionId, {code, language, result, executionTime: result.executionTime});}
            catch (err) {console.warn('Failed to record submission:', err.message);}
        }

        res.json({success: true, output: result.output, errors: result.errors, executionTime: result.executionTime, hasError: result.hasError});
    } catch (error)
    {
        console.error('Execution error:', error);
        res.status(500).json({success: false, error: 'Execution failed', message: error.message});
    }
});

// Validate syntax
router.post('/validate', async (req, res) =>
{
    try
    {
        const {code, language}=req.body;
        if (!code||!language) return res.status(400).json({error: 'Missing required fields'});
        const validation=await codeExecutor.validateSyntax(code, language);
        res.json({valid: validation.valid, errors: validation.errors});
    } catch (error)
    {
        res.status(500).json({error: 'Validation failed', message: error.message});
    }
});

export default router;
